// 帳號與權限（前後端共用）：系統身分 × 功能模組 → 無 / 檢視 / 編輯
import type { RoleId } from "./mgmt";

export const LEVELS = ["none", "view", "edit"] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = { none: "—", view: "檢視", edit: "編輯" };

export const MODULES = [
  { id: "portal", label: "住戶專區（立體圖、公告、規範、會議結果、維修進度、報修）" },
  { id: "plans", label: "3D / 平面圖（完整）、問題回報管理" },
  { id: "gardens", label: "公設植栽" },
  { id: "driveway", label: "車道設備" },
  { id: "shops", label: "1F 店鋪" },
  { id: "residents", label: "住戶名冊（所有權人、承租人、車輛、車位）" },
  { id: "fees", label: "管理費（開單、繳費登記、欠繳）" },
  { id: "booking", label: "住戶預約（自己的）" },
  { id: "field", label: "現場（預約管理、訪客、值班、班表）" },
  { id: "announcements", label: "公告" },
  { id: "meetings", label: "會議紀錄" },
  { id: "todos", label: "待辦、時程、情境事件" },
  { id: "inspections", label: "年度檢測" },
  { id: "org", label: "組織架構、屆次" },
  { id: "vendors", label: "廠商資訊" },
  { id: "regulations", label: "規範條例" },
  { id: "report", label: "月報 / 年報、匯出" },
  { id: "admin", label: "系統管理（帳號、權限、紀錄）" },
] as const;
export type ModuleId = (typeof MODULES)[number]["id"];
export type Perms = Record<ModuleId, Level>;

export const SYS_ROLES = [
  { id: "admin", label: "社區管理員", note: "管委會主委、總幹事等，可核准本社區帳號與設定權限" },
  { id: "staff", label: "物業人員", note: "秘書、保全、清潔：現場、公告、待辦" },
  { id: "committee", label: "管理委員", note: "檢視全部，可處理待辦與會議" },
  { id: "vendor", label: "建商 / 廠商", note: "檢視與自己相關的待辦與平面圖" },
  { id: "resident", label: "住戶", note: "住戶專區：立體圖、報修、公告、規範、會議結果、維修進度；預約公設" },
] as const;
export type SysRole = (typeof SYS_ROLES)[number]["id"];

const all = (l: Level) => Object.fromEntries(MODULES.map((m) => [m.id, l])) as Perms;

export const ALL_EDIT = all("edit");
export const NO_PERMS = all("none");

export const DEFAULT_PERMS: Record<SysRole, Perms> = {
  admin: all("edit"),
  staff: { ...all("edit"), residents: "view", fees: "edit", org: "view", regulations: "view", report: "view", admin: "none" },
  committee: { ...all("view"), residents: "none", todos: "edit", meetings: "edit", announcements: "edit", booking: "edit", admin: "none" },
  vendor: { ...all("none"), portal: "view", plans: "view", todos: "view", inspections: "view" },
  // 住戶只看去除隱私的住戶專區，不看完整平面圖資料與名冊
  resident: { ...all("none"), portal: "edit", booking: "edit" },
};

export const USER_STATUS = ["active", "pending", "disabled"] as const;
export type UserStatus = (typeof USER_STATUS)[number];
export const STATUS_LABEL: Record<UserStatus, string> = { active: "啟用", pending: "待核准", disabled: "停用" };

/** 帳號（全系統一個）；在各社區的身分、狀態記在 memberships */
export type User = {
  id: string; // = email（小寫）
  email: string;
  name: string;
  picture: string;
  superAdmin: boolean; // 系統擁有者（OWNER_EMAILS）：所有社區全部權限
  memberships: Membership[];
  createdAt: string;
  lastLoginAt: string; // 空 = 預先邀請、尚未登入
};

/** 某帳號在某社區的身分 */
export type Membership = {
  buildingId: string;
  role: SysRole;
  status: UserStatus;
  orgRole?: RoleId; // 對應組織職務（主委、總幹事…）
  unitId?: string; // 住戶戶別
  note: string;
  createdAt: string;
};

/** 後台帳號列表的一列：帳號 + 在目前社區的身分 */
export type MemberRow = Omit<User, "memberships"> & { membership: Membership };

export type RolePerms = { id: string; buildingId: string; role: SysRole; perms: Perms; updatedAt: string }; // id = 社區:身分

export type MyCommunity = { id: string; name: string; role: SysRole | "super"; status: UserStatus };
export type Me = { user: User; buildingId: string; perms: Perms; communities: MyCommunity[]; adminOf: string[] };

/** 帳號整體狀態：系統擁有者或任一社區啟用 → 啟用 */
export function overallStatus(u: User): UserStatus {
  if (u.superAdmin || u.memberships.some((m) => m.status === "active")) return "active";
  return u.memberships.some((m) => m.status === "pending") || !u.memberships.length ? "pending" : "disabled";
}

export const roleLabel = (r: SysRole | "super") => (r === "super" ? "系統擁有者" : (SYS_ROLES.find((x) => x.id === r)?.label ?? r));

export const rank = (l: Level | undefined) => (l === "edit" ? 2 : l === "view" ? 1 : 0);
export const can = (perms: Perms | undefined, m: ModuleId, need: Exclude<Level, "none"> = "view") => rank(perms?.[m]) >= rank(need);

/** 管理中心分頁需要的模組（總覽、SOP 只要能看任一模組即可） */
export const TAB_MODULE: Record<string, ModuleId | null> = {
  overview: null,
  field: "field",
  announcements: "announcements",
  meetings: "meetings",
  todos: "todos",
  timeline: "todos",
  inspections: "inspections",
  org: "org",
  sop: null,
  vendors: "vendors",
  regulations: "regulations",
  report: "report",
};

/** 能進管理中心：任一管理模組可檢視 */
export const canManage = (perms: Perms | undefined) => (["field", "announcements", "meetings", "todos", "inspections", "org", "vendors", "regulations", "report", "admin"] as ModuleId[]).some((m) => can(perms, m));

export type AuditEntry = { id: string; at: string; email: string; method: string; path: string; module: string; buildingId: string };

/* 使用紀錄：每次開啟頁面 / 切換分頁一筆 */
export type UsageEvent = { id: string; at: Date | string; email: string; path: string; area: string; buildingId: string };

/** 頁面 → 使用區域（統計用） */
export const AREA_LABEL: Record<string, string> = {
  home: "首頁",
  plans: "3D / 平面圖",
  booking: "住戶預約",
  admin: "後台",
  overview: "管理中心總覽",
  field: "現場",
  announcements: "公告",
  meetings: "會議紀錄",
  todos: "待辦追蹤",
  timeline: "時程規劃",
  inspections: "年度檢測",
  org: "組織架構",
  sop: "SOP 流程",
  vendors: "廠商資訊",
  regulations: "規範條例",
  report: "月報 / 年報",
};

export function areaOf(path: string, search: string) {
  if (path === "/") return "home";
  if (path.startsWith("/admin")) return "admin";
  const m = path.match(/^\/buildings\/[^/]+(?:\/(manage|book))?/);
  if (!m) return "";
  if (m[1] === "book") return "booking";
  if (m[1] === "manage") {
    const tab = new URLSearchParams(search).get("tab") ?? "overview";
    return tab in AREA_LABEL ? tab : "overview";
  }
  return "plans";
}

/* 意見回報 */
export const FEEDBACK_TYPES = ["問題回報", "功能建議", "使用疑問", "其他"] as const;
export const FEEDBACK_STATUS = ["新回報", "處理中", "已解決", "不處理"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUS)[number];
export type Feedback = {
  id: string;
  buildingId: string;
  email: string;
  name: string;
  type: (typeof FEEDBACK_TYPES)[number];
  message: string;
  page: string; // 回報時所在頁面
  photos: string[];
  userAgent: string;
  status: FeedbackStatus;
  reply: string; // 管理員回覆（回報者看得到）
  history: { at: string; by: string; text: string }[];
  createdAt: string;
  updatedAt: string;
};

/** 網址 /buildings/<社區>/… 的社區 id */
export const buildingOfPath = (path: string) => path.match(/^\/buildings\/([^/?#]+)/)?.[1] ?? "";

export type CommunitySummary = { id: string; name: string; members: number; pending: number; admins: number; active7: number; views30: number; openFeedback: number };

/* 住戶專區（去除隱私後的資料） */
export type PortalRepair = {
  id: string;
  kind: "報修" | "維修" | "設備";
  title: string; // 不含人名、電話
  floor: string;
  tower: "A" | "B" | "S";
  x: number;
  y: number;
  label: string; // 位置
  status: string;
  since: string; // YYYY-MM-DD
  expected: string; // 預計完成（可空）
};
export type PortalAnnouncement = { id: string; title: string; body: string; titleEn: string; bodyEn: string; start: string; end: string; area: string; photos: string[]; postedAt: string };
export type PortalRegulation = { id: string; title: string; category: string; version: string; effectiveDate: string; summary: string; content: string };
export type PortalMeeting = { id: string; title: string; date: string; type: string; decisions: string[]; followUps: { title: string; status: string }[] };
export type MyRepair = { id: string; title: string; description: string; category: string; floor: string; tower: string; zone: string; status: string; photos: string[]; createdAt: string; updatedAt: string };
