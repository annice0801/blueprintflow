// 現場：預約（卸貨、搬家、公設、施工、廠商）、訪客、值班日誌、公告（前後端共用）
import type { FeeSettings } from "./households";
import type { PlanRef } from "./mgmt";

export const RES_TYPES = ["卸貨", "搬家", "健身房", "兒童遊戲室", "裝潢施工", "廠商到場"] as const;
export type ResType = (typeof RES_TYPES)[number];
/** 住戶可自行預約的類型；施工、廠商由物業登記 */
export const RESIDENT_TYPES: ResType[] = ["卸貨", "搬家", "健身房", "兒童遊戲室"];
export const RES_ICON: Record<ResType, string> = { 卸貨: "📦", 搬家: "🚚", 健身房: "🏋️", 兒童遊戲室: "🧸", 裝潢施工: "🛠", 廠商到場: "👷" };

export type ResTypeSetting = {
  enabled: boolean;
  needApproval: boolean; // 需物業審核
  openFrom: string; // HH:mm
  openTo: string;
  weekdaysOnly: boolean; // 假日不開放（施工、搬家）
  maxHours: number;
  capacity: number; // 同時段可預約組數
  pointsPerHour: number; // 0 = 不扣點
  deposit: string; // 保證金說明
  rules: string; // 預約前需同意的規範
  regulationId: string; // 連結「規範條例」
};

export type FieldSettings = {
  buildingId: string;
  pointPerPing: number; // 每坪發放點數（第 3 次例會：一坪 1 點）
  pointPeriod: "月" | "季"; // 點數歸零週期
  feePerPoint: number; // 點數用罄後每點折算管理費（元）
  noShowPenalty: number; // 預約未到扣點
  visitorRetentionDays: number;
  types: Record<ResType, ResTypeSetting>;
  postingSpots: PostingSpot[];
  shiftCodes: ShiftCode[];
  fee?: FeeSettings; // 管理費費率
  updatedAt: string;
};

/** 班別代號：班表上的「日、夜、早、中、晚、休、A、B」等 */
export type ShiftCode = { code: string; label: string; start: string; end: string; off?: boolean };

/** 一人一天一筆班 */
export type Shift = {
  id: string;
  buildingId: string;
  date: string; // YYYY-MM-DD（跨夜班以開始日為準）
  name: string;
  roleId: "guard" | "cleaner" | "secretary" | "gm" | "area_manager";
  code: string;
  start: string; // HH:mm
  end: string; // HH:mm（小於 start 表示隔日）
  post: string; // 崗位：大門、車道、巡邏…
  note: string;
  source: string; // 匯入檔名或「手動」
  updatedAt: string;
};

export const SHIFT_ROLES = ["guard", "cleaner", "secretary", "gm", "area_manager"] as const;

/** 某時間點是否在班 */
export function onDuty(s: Pick<Shift, "date" | "start" | "end">, nowLocal: string) {
  const start = `${s.date}T${s.start}`;
  let endDate = s.date;
  if (s.end <= s.start) {
    const d = new Date(`${s.date}T00:00:00`);
    d.setDate(d.getDate() + 1);
    endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return nowLocal >= start && nowLocal < `${endDate}T${s.end}`;
}

export type PostingSpot = { id: string; label: string; location?: PlanRef };

const t = (p: Partial<ResTypeSetting> & { rules: string }): ResTypeSetting => ({
  enabled: true,
  needApproval: false,
  openFrom: "08:00",
  openTo: "21:00",
  weekdaysOnly: false,
  maxHours: 2,
  capacity: 1,
  pointsPerHour: 0,
  deposit: "",
  regulationId: "",
  ...p,
});

export const DEFAULT_SETTINGS: Omit<FieldSettings, "buildingId" | "updatedAt"> = {
  pointPerPing: 1,
  pointPeriod: "月",
  feePerPoint: 50,
  noShowPenalty: 1,
  visitorRetentionDays: 90,
  types: {
    卸貨: t({
      openFrom: "08:00",
      openTo: "20:00",
      maxHours: 1,
      rules: "1. 卸貨請停放於指定卸貨區，不得阻擋車道出入口。\n2. 每次以 30 分鐘為原則，逾時請移車。\n3. 大型物品請事先告知管理室，由管理室協助使用貨梯。\n4. 公共區域如有損壞，依規定由預約住戶負責修復。",
    }),
    搬家: t({
      needApproval: true,
      openFrom: "09:00",
      openTo: "17:00",
      weekdaysOnly: true,
      maxHours: 4,
      deposit: "電梯保護保證金 NT$ 5,000（完工檢查無損壞後退還）",
      rules: "1. 搬家需於 3 日前預約，經管理室確認後生效。\n2. 假日及連假不開放搬家。\n3. 搬運前由管理室鋪設電梯保護板，僅能使用指定電梯。\n4. 搬家車輛不得阻擋車道與消防通道。\n5. 公共區域如有損壞，自保證金扣除修復費用。",
    }),
    健身房: t({
      openFrom: "06:00",
      openTo: "22:00",
      maxHours: 2,
      capacity: 6,
      pointsPerHour: 1,
      rules: "1. 依公設使用管理辦法：點數依權狀坪數發放（一坪 1 點），點數不得跨期累積。\n2. 預約時不扣點，使用當日至管理中心領取磁扣時扣點。\n3. 點數用罄後依社區收費標準付費，費用併入管理費收取，納入公設維護基金。\n4. 預約未到將扣除點數。\n5. 請穿著運動鞋，使用完畢請將器材歸位並擦拭。",
    }),
    兒童遊戲室: t({
      openFrom: "09:00",
      openTo: "20:00",
      maxHours: 2,
      capacity: 3,
      pointsPerHour: 1,
      rules: "1. 12 歲以下兒童須由家長全程陪同。\n2. 點數依權狀坪數發放，使用當日領取磁扣時扣點；不足部分併入管理費收取。\n3. 預約未到將扣除點數。\n4. 禁止飲食，使用完畢請將玩具歸位。",
    }),
    裝潢施工: t({
      needApproval: true,
      openFrom: "09:00",
      openTo: "17:00",
      weekdaysOnly: true,
      maxHours: 8,
      capacity: 5,
      deposit: "裝潢保證金依裝潢管理辦法",
      rules: "1. 依裝潢管理辦法，假日及連假禁止施工。\n2. 涉及結構或消防須取得室內裝修許可證。\n3. 施工人員須至管理室換證登記。",
    }),
    廠商到場: t({ openFrom: "08:00", openTo: "18:00", maxHours: 8, capacity: 10, rules: "廠商到場須至管理室登記換證，完工後回報處理結果。" }),
  },
  shiftCodes: [
    { code: "日", label: "日班", start: "07:00", end: "19:00" },
    { code: "夜", label: "夜班", start: "19:00", end: "07:00" },
    { code: "早", label: "早班", start: "07:00", end: "15:00" },
    { code: "中", label: "中班", start: "15:00", end: "23:00" },
    { code: "晚", label: "晚班", start: "23:00", end: "07:00" },
    { code: "常", label: "常日班", start: "08:00", end: "17:00" },
    { code: "休", label: "休假", start: "00:00", end: "00:00", off: true },
  ],
  postingSpots: [
    { id: "lobbyA", label: "A 棟大廳公佈欄" },
    { id: "lobbyB", label: "B 棟大廳公佈欄" },
    { id: "elevA1", label: "A 棟電梯 1" },
    { id: "elevA2", label: "A 棟電梯 2" },
    { id: "elevB1", label: "B 棟電梯 1" },
    { id: "elevB2", label: "B 棟電梯 2" },
    { id: "ramp", label: "車道出入口" },
    { id: "b1hall", label: "B1 梯廳" },
  ],
};

export const RES_STATUS = ["待審核", "已確認", "使用中", "已完成", "已取消", "未到", "已退回"] as const;
export type ResStatus = (typeof RES_STATUS)[number];

export type Reservation = {
  id: string;
  buildingId: string;
  code: string; // 預約編號，住戶查詢用
  type: ResType;
  unitId: string; // A-12F-A3
  name: string;
  phone: string;
  start: string; // YYYY-MM-DDTHH:mm
  end: string;
  people: number;
  note: string;
  status: ResStatus;
  source: "住戶" | "物業";
  consent?: { at: string; version: string }; // 同意規範（版本 = 規範內容雜湊）
  points: { estimate: number; charged: number; overflow: number; fee: number };
  log: { at: string; text: string }[];
  createdAt: string;
  updatedAt: string;
};

export type Visitor = {
  id: string;
  buildingId: string;
  name: string;
  unitId: string;
  purpose: string;
  plate: string;
  count: number;
  inAt: string;
  outAt: string;
  note: string;
  createdAt: string;
};

export const LOG_TYPES = ["巡檢", "異常", "廠商到場", "住戶反映", "交接", "其他"] as const;
export type FieldLog = {
  id: string;
  buildingId: string;
  type: (typeof LOG_TYPES)[number];
  text: string;
  photos: string[];
  location?: PlanRef;
  by: string; // 填寫人 / 班別
  at: string;
  issueId?: string;
  todoId?: string;
  createdAt: string;
};

/* ── 公告 ── */

export const ANN_TEMPLATES = ["construction", "water", "power", "elevator", "typhoon", "general", "event"] as const;
export type AnnTemplate = (typeof ANN_TEMPLATES)[number];
export const ANN_STATUS = ["草稿", "待審核", "退回修改", "已核准", "張貼中", "已張貼", "已撤下"] as const;
export type AnnStatus = (typeof ANN_STATUS)[number];

export type Announcement = {
  id: string;
  buildingId: string;
  template: AnnTemplate;
  zh: { title: string; body: string };
  en: { title: string; body: string };
  fields: { start: string; end: string; area: string; areaEn: string; contact: string; issuer: string; issuerEn: string };
  photos: string[];
  layout: { lang: "both" | "zh" | "en"; fontScale: number; photoLayout: "none" | "top" | "side" | "bottom"; accent: string };
  source: string; // 收到的原始通知
  status: AnnStatus;
  review: { at: string; by: string; action: string; comment: string }[];
  postings: { spotId: string; label: string; photo: string; postedAt: string; by: string }[];
  removeBy: string; // 預計撤下日
  createdAt: string;
  updatedAt: string;
};

/* ── 點數 ── */

export const hoursOf = (r: Pick<Reservation, "start" | "end">) => Math.max(0, (Date.parse(r.end) - Date.parse(r.start)) / 3600000);

/** 點數週期鍵：2026-10 或 2026-Q4 */
export function periodKey(date: string, period: FieldSettings["pointPeriod"]) {
  const y = date.slice(0, 4);
  const m = Number(date.slice(5, 7));
  return period === "月" ? `${y}-${String(m).padStart(2, "0")}` : `${y}-Q${Math.ceil(m / 3)}`;
}

/** 某戶在某週期的點數帳：發放、已扣、剩餘、加收 */
export function pointLedger(reservations: Reservation[], unitId: string, ping: number, settings: FieldSettings, date: string) {
  const key = periodKey(date, settings.pointPeriod);
  const allot = Math.floor(ping * settings.pointPerPing);
  const mine = reservations.filter((r) => r.unitId === unitId && periodKey(r.start.slice(0, 10), settings.pointPeriod) === key);
  const used = mine.reduce((s, r) => s + r.points.charged, 0);
  const overflow = mine.reduce((s, r) => s + r.points.overflow, 0);
  const fee = mine.reduce((s, r) => s + r.points.fee, 0);
  return { key, allot, used, left: Math.max(0, allot - used), overflow, fee };
}

/** 規範版本：內容雜湊，規範改動後舊同意紀錄即可辨識 */
export function rulesVersion(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `r${(h >>> 0).toString(36)}`;
}
