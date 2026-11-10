import { NextResponse, type NextRequest } from "next/server";
import { adminCommunities, audit, BUILDING_HEADER, defaultCommunity, getUser, isCommunity, PERMS_HEADER, permsOf, readSession, SESSION_COOKIE, USER_HEADER } from "@/lib/auth";
import { calendarTokenOk } from "@/lib/calendar-token";
import { BUILDINGS, demoScope } from "@/lib/buildings";
import { buildingOfPath, can, canManage, DEMO_PERMS, overallStatus, type ModuleId, type Perms, type User } from "@/lib/perms";

/*
 * 登入與權限檢查：所有頁面與 API 都經過這裡。
 * 先判定請求屬於哪個社區（網址 ?buildingId、/buildings/<id>、前端標頭、來源頁），再用該社區的權限檢查。
 * GET 需要「檢視」，其他方法需要「編輯」；對不到模組的 API 只有系統管理可寫。
 * 尚未核准的登入者進入示範模式（見 demoMode）：只能檢視，資料一律改讀假名示範範圍。
 */

/** 判定社區：資料範圍（?buildingId）優先，其次頁面路徑、前端標頭、來源頁，最後是帳號的預設社區 */
function communityOf(req: NextRequest, user: User) {
  const q = req.nextUrl.searchParams.get("buildingId");
  const candidates = [q, buildingOfPath(req.nextUrl.pathname), req.headers.get(BUILDING_HEADER), buildingOfPath(safePath(req.headers.get("referer")))];
  return candidates.find((c): c is string => !!c && isCommunity(c)) ?? defaultCommunity(user);
}
const safePath = (url: string | null) => {
  try {
    return url ? new URL(url).pathname : "";
  } catch {
    return "";
  }
};

const PUBLIC_PAGES = ["/login"];
const PUBLIC_API = ["/api/auth/google", "/api/auth/logout"];

// API 第一段路徑 → 模組（"auth" = 登入即可）
const API_MODULE: Record<string, ModuleId | "auth"> = {
  portal: "portal",
  issues: "plans",
  buildings: "plans",
  plants: "gardens",
  "gate-logs": "driveway",
  shops: "shops",
  residents: "residents",
  fees: "fees",
  visitors: "field",
  fieldlogs: "field",
  shifts: "field",
  field: "field",
  announcements: "announcements",
  meetings: "meetings",
  docs: "meetings",
  todos: "todos",
  events: "todos",
  inspections: "inspections",
  terms: "org",
  vendors: "vendors",
  regulations: "regulations",
  report: "report",
  export: "report",
  admin: "admin",
  holidays: "auth",
  feedback: "auth",
  uploads: "auth",
  calendar: "auth",
};

type Rule = { modules: ModuleId[]; need: "view" | "edit" } | "auth";

function apiRule(path: string, method: string, q: URLSearchParams): Rule | null {
  const [, , seg, sub] = path.split("/");
  const need = method === "GET" || method === "HEAD" ? "view" : "edit";
  if (seg === "auth") return "auth"; // /api/auth/me
  // 預約：住戶查自己的（帶戶別＋電話）、新增、取消 → 住戶預約；其餘 → 現場
  if (seg === "reservations") {
    // 住戶可新增與取消（PATCH 的其他動作由 API 再檢查現場權限）；刪除只有現場
    const resident = sub === "availability" || sub === "rules" || (need === "view" && q.has("unitId")) || method === "POST" || method === "PATCH";
    return { modules: resident ? ["booking", "field"] : ["field"], need };
  }
  const m = API_MODULE[seg];
  if (!m) return { modules: ["admin"], need: "edit" };
  // 登入者都能上傳照片、送出意見回報
  if (m === "auth") return need === "view" || seg === "uploads" || seg === "feedback" ? "auth" : { modules: ["admin"], need: "edit" };
  return { modules: [m], need };
}

function pageAllowed(path: string, perms: Perms) {
  if (path === "/") return true;
  const m = path.match(/^\/buildings\/[^/]+(\/(manage|book))?/);
  if (!m) return true;
  if (m[2] === "manage") return canManage(perms);
  if (m[2] === "book") return can(perms, "booking") || can(perms, "field");
  return can(perms, "plans") || can(perms, "portal");
}

// 示範模式不開放的 API：原始檔案、行事曆、匯出報表、名冊、管理費、後台與其他帳號功能
const DEMO_BLOCKED_API = ["docs", "uploads", "calendar", "export", "report", "residents", "fees", "admin", "auth"];
// 示範模式仍可使用：查自己的狀態、申請加入社區、記錄瀏覽、送出意見、國定假日
const DEMO_OPEN_API = ["/api/auth/me", "/api/auth/join", "/api/auth/track", "/api/feedback", "/api/holidays"];

/** 示範模式：同一棟建築的結構，資料讀「<社區>:demo」假名示範範圍；只能檢視 */
function demoMode(req: NextRequest, headers: Headers, user: User) {
  const path = req.nextUrl.pathname;
  const real = communityOf(req, user) || BUILDINGS[0].id;
  const scope = demoScope(real);
  headers.set(BUILDING_HEADER, scope);
  headers.set(PERMS_HEADER, JSON.stringify(DEMO_PERMS));
  const pass = () => NextResponse.next({ request: { headers } });

  if (!path.startsWith("/api/")) {
    const m = path.match(/^\/buildings\/[^/]+(\/(manage|book))?\/?$/);
    return path === "/" || (m && m[2] !== "book") ? pass() : deny(req, 403, "示範模式無法使用這個頁面");
  }
  if (DEMO_OPEN_API.includes(path)) return pass();
  if (req.method !== "GET" && req.method !== "HEAD") return deny(req, 403, "示範模式只能檢視；需要完整功能請向社區管理員申請");
  const seg = path.split("/")[2];
  const rule = apiRule(path, req.method, req.nextUrl.searchParams);
  if (DEMO_BLOCKED_API.includes(seg) || !rule || rule === "auth" || !rule.modules.some((m) => can(DEMO_PERMS, m, rule.need)))
    return deny(req, 403, "示範模式無法查看這項資料");
  // 不論前端帶哪個社區，一律改讀示範範圍
  const url = req.nextUrl.clone();
  url.searchParams.set("buildingId", scope);
  return NextResponse.rewrite(url, { request: { headers } });
}

const deny = (req: NextRequest, status: 401 | 403, msg: string) => {
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: msg }, { status });
  const url = new URL("/login", req.url);
  if (status === 401) url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  else url.searchParams.set("denied", "1");
  return NextResponse.redirect(url);
};

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // 清掉外部偽造的使用者標頭
  const headers = new Headers(req.headers);
  headers.delete(USER_HEADER);
  headers.delete(PERMS_HEADER);
  headers.delete(BUILDING_HEADER); // 前端帶的社區只當參考，驗證後再寫回
  const pass = () => NextResponse.next({ request: { headers } });

  if (PUBLIC_PAGES.includes(path) || PUBLIC_API.includes(path)) return pass();
  // 行事曆訂閱：Google 日曆不會帶 cookie，用網址上的 token
  if (path === "/api/calendar" && (await calendarTokenOk(req.nextUrl.searchParams))) return pass();

  const email = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const user = email ? await getUser(email) : null;
  if (!user) return deny(req, 401, "請先登入");
  headers.set(USER_HEADER, user.email);
  const status = overallStatus(user);
  // 尚未核准（含剛登入、還沒申請）：示範模式
  if (status === "pending") return demoMode(req, headers, user);
  if (status !== "active") {
    // 停用：只能查自己的狀態、申請加入社區
    if (path === "/api/auth/me" || path === "/api/auth/join") return pass();
    if (path.startsWith("/api/")) return NextResponse.json({ error: "帳號已停用" }, { status: 403 });
    return NextResponse.redirect(new URL(`/login?status=${status}`, req.url));
  }
  const buildingId = communityOf(req, user);
  const perms = await permsOf(user, buildingId);
  headers.set(BUILDING_HEADER, buildingId);
  headers.set(PERMS_HEADER, JSON.stringify(perms));

  // 後台：任一社區的系統管理權限；跨社區比較只有系統擁有者
  if (path === "/admin" || path.startsWith("/admin/")) return (await adminCommunities(user)).length ? pass() : deny(req, 403, "沒有權限");
  if (path.startsWith("/api/admin/communities") && !user.superAdmin) return deny(req, 403, "只有系統擁有者可以查看全部社區");
  if (!path.startsWith("/api/")) return pageAllowed(path, perms) ? pass() : deny(req, 403, "你沒有這個社區的權限");

  const rule = apiRule(path, req.method, req.nextUrl.searchParams);
  if (rule && rule !== "auth" && !rule.modules.some((m) => can(perms, m, rule.need)))
    return deny(req, 403, rule.need === "edit" ? "沒有編輯權限，請洽管理員" : "沒有檢視權限，請洽管理員");
  // 個資：查看住戶名冊也留紀錄
  if (req.method === "GET" && path.startsWith("/api/residents")) void audit({ email: user.email, method: "VIEW", path: path + req.nextUrl.search, module: "residents", buildingId });
  // 列表 API 沒帶社區時補上目前社區，避免讀到其他社區的資料
  const seg = path.split("/")[2];
  if (req.method === "GET" && !req.nextUrl.searchParams.has("buildingId") && !["auth", "holidays", "uploads", "docs", "admin", "calendar"].includes(seg)) {
    const url = req.nextUrl.clone();
    url.searchParams.set("buildingId", buildingId);
    return NextResponse.rewrite(url, { request: { headers } });
  }
  if (req.method !== "GET" && req.method !== "HEAD" && !path.startsWith("/api/auth/"))
    void audit({ email: user.email, method: req.method, path: path + req.nextUrl.search, module: rule === "auth" || !rule ? "" : rule.modules[0], buildingId });
  return pass();
}

export const config = {
  // 靜態檔與 Next 內部路徑不檢查
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|glb|gltf|woff2?)$).*)"],
};
