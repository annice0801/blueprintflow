// 管理中心：會議紀錄、待辦追蹤、組織角色、廠商（前後端共用）

export type RoleGroup = "管委會" | "物業" | "建商" | "外包廠商";

export const ROLES = [
  { id: "chair", label: "主任委員", short: "主委", group: "管委會" },
  { id: "vice", label: "副主任委員", short: "副主委", group: "管委會" },
  { id: "finance", label: "財務委員", short: "財務", group: "管委會" },
  { id: "audit", label: "監察委員", short: "監察", group: "管委會" },
  { id: "member1", label: "一般委員 1", short: "委員 1", group: "管委會" },
  { id: "member2", label: "一般委員 2", short: "委員 2", group: "管委會" },
  { id: "member3", label: "一般委員 3", short: "委員 3", group: "管委會" },
  { id: "area_manager", label: "區經理", short: "區經理", group: "物業" },
  { id: "finance_advisor", label: "財務顧問", short: "財務顧問", group: "物業" },
  { id: "legal_advisor", label: "法律顧問", short: "法律顧問", group: "物業" },
  { id: "gm", label: "總幹事（社區經理）", short: "總幹事", group: "物業" },
  { id: "secretary", label: "秘書", short: "秘書", group: "物業" },
  { id: "guard", label: "保全", short: "保全", group: "物業" },
  { id: "cleaner", label: "清潔", short: "清潔", group: "物業" },
  { id: "builder", label: "建商", short: "建商", group: "建商" },
  { id: "vendor", label: "外包廠商", short: "廠商", group: "外包廠商" },
] as const satisfies readonly { id: string; label: string; short: string; group: RoleGroup }[];

export type RoleId = (typeof ROLES)[number]["id"];
export const ROLE_IDS = ROLES.map((r) => r.id) as RoleId[];
export const roleOf = (id: RoleId) => ROLES.find((r) => r.id === id)!;

export const GROUP_COLOR: Record<RoleGroup, string> = {
  管委會: "#a78bfa",
  物業: "#4cc9ff",
  建商: "#fb923c",
  外包廠商: "#34d399",
};

/** 各職務的基本職責（依公寓大廈管理條例與一般社區分工；可在成員備註補充） */
export const ROLE_DUTIES: Partial<Record<RoleId, string[]>> = {
  chair: ["對外代表管理委員會", "召集並主持管委會會議、區分所有權人會議", "核定授權額度內之支出與重大事項", "督導物業公司執行會議決議"],
  vice: ["協助主任委員處理會務", "主任委員不能執行職務時代理之", "督導待辦事項進度"],
  finance: ["管理費、公共基金收支與帳務稽核", "每月財務報表審閱與公告", "廠商請款、合約金額覆核"],
  audit: ["監督管委會會務與財務執行", "稽核帳冊、憑證與合約", "審閱管理辦法條文、調閱申請"],
  member1: ["出席會議參與議決", "協助督導分工之公共事務"],
  member2: ["出席會議參與議決", "協助督導分工之公共事務"],
  member3: ["出席會議參與議決", "協助督導分工之公共事務"],
  area_manager: ["督導駐點總幹事與現場人員", "物業公司對管委會之主要窗口", "人力調度、缺勤支援與服務品質稽核"],
  finance_advisor: ["社區財務報表與帳務稽核建議", "管理費、公共基金收支與預算規劃諮詢"],
  legal_advisor: ["規約、管理辦法條文之法律諮詢", "住戶糾紛、催繳與合約爭議之法律意見"],
  gm: ["綜理社區日常管理、執行管委會決議", "督導秘書、保全、清潔人員", "廠商聯繫、報價、派工與驗收", "列席管委會會議並報告代辦事項"],
  secretary: ["收發文件、公告、會議紀錄", "住戶報修受理與登記", "管理費收繳作業與帳務協助"],
  guard: ["門禁、訪客與車道管制", "巡邏、監視系統與防災中心值勤", "包裹代收與緊急事件通報"],
  cleaner: ["公共區域清潔與垃圾清運", "垃圾冷藏室與資源回收管理", "颱風前後排水溝清理"],
};

/** 屆次：管委會每一屆、物業每一期合約的成員名單 */
export type TermKind = "committee" | "property";
export type TermMember = {
  id: string;
  roleId: RoleId;
  name: string;
  phone: string;
  email: string;
  note: string; // 職責補充、班別
  start: string; // 中途接任 / 卸任
  end: string;
};
export type Term = {
  id: string;
  buildingId: string;
  kind: TermKind;
  name: string; // 第一屆、藍圖物業（115–116）
  companyId?: string; // 物業公司（廠商資料）
  start: string;
  end: string;
  note: string;
  members: TermMember[];
  createdAt: string;
  updatedAt: string;
};

/** 依日期找出當屆（含該日者優先，否則取最近開始的一屆） */
export function termAt(terms: Term[], kind: TermKind, date: string) {
  const list = terms.filter((t) => t.kind === kind).sort((a, b) => b.start.localeCompare(a.start));
  return list.find((t) => (!t.start || t.start <= date) && (!t.end || t.end >= date)) ?? list.find((t) => !t.start || t.start <= date) ?? list[0];
}

export const ATTENDANCE = ["出席", "請假", "缺席", "列席", "紀錄"] as const;
export type Attendance = { name: string; status: (typeof ATTENDANCE)[number]; title: string };

/** 平面圖上的位置（與問題注記同一套座標） */
export type PlanRef = { floor: string; tower: "A" | "B" | "S"; zoneId?: string; label: string; x: number; y: number };

export const TODO_STATUS = ["未開始", "進行中", "待確認", "已完成", "暫緩"] as const;
export type TodoStatus = (typeof TODO_STATUS)[number];
export const TODO_PRIORITY = ["高", "中", "低"] as const;

export type Todo = {
  id: string;
  buildingId: string;
  title: string;
  description: string;
  assignees: RoleId[];
  status: TodoStatus;
  priority: (typeof TODO_PRIORITY)[number];
  start: string; // YYYY-MM-DD
  due: string;
  meetingId?: string;
  vendorId?: string;
  location?: PlanRef;
  eventId?: string; // 由情境事件（颱風、檢測…）產生
  after?: string; // 前置待辦 id：前一步完成後才開始
  afterDays?: number; // 前一步完成後幾天到期
  link?: string; // 相關頁面：driveway / inspections / plants / announcements
  log: { at: string; text: string }[]; // 追蹤紀錄
  createdAt: string;
  updatedAt: string;
};

export const MEETING_TYPES = ["管委會例會", "管委會臨時會", "區分所有權人會議", "建商協商會議", "其他"] as const;

export type MeetingMention = PlanRef & { id: string; snippet: string };

export type Meeting = {
  id: string;
  buildingId: string;
  title: string;
  type: (typeof MEETING_TYPES)[number];
  date: string;
  place: string;
  file?: { name: string; original: string };
  text: string;
  mentions: MeetingMention[];
  attendance: Attendance[];
  createdAt: string;
  updatedAt: string;
};

export const VENDOR_CATEGORIES = ["建設 / 營造", "物業管理", "保全", "清潔", "景觀植栽", "電梯", "消防", "機電 / 水電", "弱電 / 網路", "門窗 / 帷幕", "防水", "點交檢驗", "保險", "其他"] as const;

/** 公司類型：建商、建商當時配合的廠商、管委會自行發包、物業公司 */
export const COMPANY_KINDS = ["builder", "builder-vendor", "vendor", "property"] as const;
export type CompanyKind = (typeof COMPANY_KINDS)[number];
export const COMPANY_KIND_LABEL: Record<CompanyKind, string> = {
  builder: "建商",
  "builder-vendor": "建商配合廠商",
  vendor: "自行發包廠商",
  property: "物業公司",
};

export type Contact = { id: string; name: string; title: string; dept: string; phone: string; email: string; reportsTo: string; note: string };

export const RECORD_TYPES = ["維修", "保養", "巡檢", "保固", "報價", "其他"] as const;
export type ServiceRecord = {
  id: string;
  date: string;
  type: (typeof RECORD_TYPES)[number];
  title: string;
  description: string;
  cost: string;
  handler: string; // 到場人員
  result: string; // 處理結果
  location?: PlanRef;
  createdAt: string;
};

/** 廠商 / 公司（沿用 vendors 集合） */
export type Vendor = {
  id: string;
  buildingId: string;
  kind: CompanyKind;
  name: string;
  category: (typeof VENDOR_CATEGORIES)[number];
  taxId: string; // 統一編號
  representative: string; // 負責人
  representativePhone: string;
  developer: string; // 起造人（建商）
  developerPhone: string;
  builderId: string; // 建商配合廠商：所屬建商
  contact: string; // 主要聯絡窗口
  phone: string;
  email: string;
  address: string;
  website: string;
  scope: string; // 服務 / 承攬內容
  contractStart: string;
  contractEnd: string;
  amount: string;
  note: string;
  contacts: Contact[];
  records: ServiceRecord[];
  createdAt: string;
  updatedAt: string;
};

/** 規範條例：規約、管理辦法、公告 */
export const REG_CATEGORIES = ["社區規約", "管理辦法", "公告", "其他"] as const;
export const REG_STATUS = ["草案", "討論中", "已通過", "已公告", "廢止"] as const;
export type Regulation = {
  id: string;
  buildingId: string;
  title: string;
  category: (typeof REG_CATEGORIES)[number];
  status: (typeof REG_STATUS)[number];
  version: string;
  effectiveDate: string;
  meetingId?: string;
  termId?: string;
  summary: string;
  content: string;
  file?: { name: string; original: string };
  history: { at: string; text: string }[];
  createdAt: string;
  updatedAt: string;
};

/** 解析會議紀錄的結果（尚未存檔，供使用者確認） */
export type MeetingDraft = {
  title: string;
  type: Meeting["type"];
  date: string;
  place: string;
  mentions: Omit<MeetingMention, "id">[];
  todos: { title: string; description: string; assignees: RoleId[]; due: string; status: TodoStatus; location?: PlanRef }[];
  roleNames: { id: RoleId; name: string }[];
  termName: string; // 第一屆…
  attendance: Attendance[];
};

export const isOverdue = (t: Todo, today = new Date().toISOString().slice(0, 10)) =>
  !!t.due && t.due < today && t.status !== "已完成" && t.status !== "暫緩";

/** 狀態色（dataviz 驗證過的深色模式類別色；圖表堆疊依 STATUS_STACK 順序，相鄰色可分辨） */
export const STATUS_COLOR: Record<TodoStatus, string> = {
  已完成: "#199e70",
  進行中: "#3987e5",
  待確認: "#d55181",
  未開始: "#c98500",
  暫緩: "#9085e9",
};
export const STATUS_STACK: TodoStatus[] = ["已完成", "進行中", "待確認", "未開始", "暫緩"];
