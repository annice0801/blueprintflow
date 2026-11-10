import "server-only";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { BUILDINGS } from "./buildings";
import { ALL_EDIT, DEFAULT_PERMS, NO_PERMS, rank, type Level, type Membership, type ModuleId, type MyCommunity, type Perms, type RolePerms, type SysRole, type User } from "./perms";
import { insertDoc, mutateCollection, readCollection } from "./store";

/*
 * Google 登入：前端用 Google Identity Services 取得 ID token，後端驗證後發自己的 session（JWT，httpOnly cookie）。
 * 多社區：帳號全系統一個，在各社區的身分記在 memberships；權限 = 該社區該身分的權限表。
 * OWNER_EMAILS 內的信箱為系統擁有者，所有社區全部權限；其他人登入後申請加入社區，由該社區管理員核准。
 */

export const SESSION_COOKIE = "bf_session";
const SESSION_DAYS = 30;
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("未設定 SESSION_SECRET（至少 32 字元）");
  return new TextEncoder().encode(s);
}

const owners = () => (process.env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
export const communityName = (id: string) => BUILDINGS.find((b) => b.id === id)?.name ?? id;
export const isCommunity = (id: string) => BUILDINGS.some((b) => b.id === id);

export async function verifyGoogle(credential: string) {
  const aud = process.env.GOOGLE_CLIENT_ID;
  if (!aud) throw new Error("未設定 GOOGLE_CLIENT_ID");
  const { payload } = await jwtVerify(credential, GOOGLE_JWKS, { audience: aud, issuer: ["https://accounts.google.com", "accounts.google.com"] });
  if (!payload.email || payload.email_verified !== true) throw new Error("Google 帳號信箱未驗證");
  return { email: String(payload.email).toLowerCase(), name: String(payload.name ?? ""), picture: String(payload.picture ?? "") };
}

export async function signSession(email: string) {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(email).setIssuedAt().setExpirationTime(`${SESSION_DAYS}d`).sign(secret());
}

export async function readSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export const sessionCookie = (token: string) => ({
  name: SESSION_COOKIE,
  value: token,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86400,
});

/** 登入：建立或更新帳號；joinCommunity = 登入前所在的社區頁，新帳號自動申請加入 */
export async function loginUser(g: { email: string; name: string; picture: string }, joinCommunity?: string) {
  const now = new Date().toISOString();
  const user = await mutateCollection<User, User>("users", (all) => {
    let u = all.find((x) => x.id === g.email);
    if (!u) {
      u = { id: g.email, email: g.email, name: g.name, picture: g.picture, superAdmin: false, memberships: [], createdAt: now, lastLoginAt: now };
      all.push(u);
    }
    u.memberships ??= [];
    u.name = u.name || g.name;
    u.picture = g.picture;
    u.lastLoginAt = now;
    u.superAdmin = owners().includes(g.email);
    if (joinCommunity && isCommunity(joinCommunity) && !u.superAdmin && !u.memberships.some((m) => m.buildingId === joinCommunity))
      u.memberships.push({ buildingId: joinCommunity, role: "resident", status: "pending", note: "", createdAt: now });
    return u;
  });
  invalidateAuthCache();
  return user;
}

/** 申請加入社區（待該社區管理員核准） */
export async function requestJoin(email: string, buildingId: string) {
  if (!isCommunity(buildingId)) throw new Error("找不到社區");
  const now = new Date().toISOString();
  await mutateCollection<User, void>("users", (all) => {
    const u = all.find((x) => x.id === email);
    if (u && !u.memberships.some((m) => m.buildingId === buildingId)) u.memberships.push({ buildingId, role: "resident", status: "pending", note: "", createdAt: now });
  });
  invalidateAuthCache();
}

/** 讀帳號（舊格式沒有 memberships 的補成空陣列） */
export async function readUsers() {
  return (await readCollection<User>("users")).map((u) => ({ ...u, superAdmin: !!u.superAdmin, memberships: u.memberships ?? [] }));
}

/* 帳號與權限表快取：proxy 每個請求都會查，15 秒內沿用；後台修改時立即清除 */
let cache: { at: number; users: Map<string, User>; roles: Map<string, Perms> } | null = null;
export function invalidateAuthCache() {
  cache = null;
}

async function load() {
  if (cache && Date.now() - cache.at < 15_000) return cache;
  const [users, roles] = await Promise.all([readUsers(), readCollection<RolePerms>("roles")]);
  cache = { at: Date.now(), users: new Map(users.map((u) => [u.id, u])), roles: new Map(roles.map((r) => [r.id, r.perms])) };
  return cache;
}

/** 某社區各身分的權限表（未設定者用預設） */
export async function rolePerms(buildingId: string): Promise<Record<SysRole, Perms>> {
  const c = await load();
  return Object.fromEntries((Object.keys(DEFAULT_PERMS) as SysRole[]).map((r) => [r, { ...DEFAULT_PERMS[r], ...c.roles.get(`${buildingId}:${r}`) }])) as Record<SysRole, Perms>;
}

export async function getUser(email: string) {
  const hit = (await load()).users.get(email);
  if (hit) return hit;
  // 快取裡沒有（例如剛登入的新帳號，proxy 與 API 的快取各自獨立）→ 重新讀取；1 秒內不重複查
  if (cache && Date.now() - cache.at > 1000) {
    cache = null;
    return (await load()).users.get(email) ?? null;
  }
  return null;
}

export const membershipOf = (u: User, buildingId: string): Membership | undefined => u.memberships.find((m) => m.buildingId === buildingId);

export async function permsOf(user: User, buildingId: string): Promise<Perms> {
  if (user.superAdmin) return ALL_EDIT;
  const m = membershipOf(user, buildingId);
  if (!m || m.status !== "active") return NO_PERMS;
  return (await rolePerms(buildingId))[m.role];
}

/** 這個帳號可進入的社區（系統擁有者 = 全部） */
export function communitiesOf(u: User): MyCommunity[] {
  if (u.superAdmin) return BUILDINGS.map((b) => ({ id: b.id, name: b.name, role: "super", status: "active" }));
  return u.memberships.map((m) => ({ id: m.buildingId, name: communityName(m.buildingId), role: m.role, status: m.status }));
}

/** 可管理（後台）的社區 */
export async function adminCommunities(u: User) {
  const out: string[] = [];
  for (const c of communitiesOf(u)) if (c.status === "active" && rank((await permsOf(u, c.id)).admin) >= 1) out.push(c.id);
  return out;
}

/** 預設社區：唯一 / 第一個啟用中的社區 */
export const defaultCommunity = (u: User) => communitiesOf(u).find((c) => c.status === "active")?.id ?? "";

/** proxy 帶給 API 的使用者資訊（proxy 會先清掉外部傳入的同名標頭） */
export const USER_HEADER = "x-bf-user";
export const PERMS_HEADER = "x-bf-perms";
export const BUILDING_HEADER = "x-bf-building"; // 前端帶目前社區；proxy 驗證後改寫為實際判定的社區

/**
 * 這次請求的資料範圍：以 proxy 驗證後寫入的社區為準（示範模式為示範範圍），不直接信任網址參數；
 * 行事曆訂閱這類不經登入的請求沒有標頭，才用網址參數；都沒有時用預設社區，不會回傳全部資料
 */
export function dataScope(request: Request) {
  return request.headers.get(BUILDING_HEADER) || new URL(request.url).searchParams.get("buildingId") || BUILDINGS[0].id;
}
export function requestUser(request: Request) {
  const email = request.headers.get(USER_HEADER);
  const buildingId = request.headers.get(BUILDING_HEADER) ?? "";
  let perms: Perms | null = null;
  try {
    perms = JSON.parse(request.headers.get(PERMS_HEADER) ?? "null");
  } catch {}
  return { email, buildingId, perms, can: (m: ModuleId, need: Exclude<Level, "none"> = "view") => rank(perms?.[m]) >= rank(need) };
}

export async function audit(entry: { email: string; method: string; path: string; module: string; buildingId: string }) {
  await insertDoc("audit", { id: crypto.randomUUID(), at: new Date().toISOString(), ...entry }).catch(() => {});
}
