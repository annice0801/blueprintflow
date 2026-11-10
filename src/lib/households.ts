// 戶籍名冊與管理費（前後端共用）：每戶的所有權人、承租人、車輛、車位，以及每月管理費帳單
import { unitPing } from "./buildings";

export const OCCUPANCY = ["自住", "出租", "空置"] as const;
export type Occupancy = (typeof OCCUPANCY)[number];
export const VEHICLE_TYPES = ["汽車", "機車", "腳踏車"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export const SPACE_RIGHTS = ["產權", "承租", "社區租用"] as const;
export const PAYERS = ["所有權人", "承租人"] as const;
export type Payer = (typeof PAYERS)[number];
export const CHANGE_TYPES = ["過戶", "換租", "退租"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export type Person = { id: string; name: string; phone: string; email: string; since: string; note: string };
/** 車輛：personId 為所屬住戶（換人時跟著人走） */
export type Vehicle = { id: string; type: VehicleType; plate: string; personId: string; note: string };
/** 車位：屬於戶別（產權車位過戶時跟著戶別） */
export type ParkingSpace = { id: string; type: VehicleType; number: string; right: (typeof SPACE_RIGHTS)[number]; note: string };

export type HouseholdEvent = {
  id: string;
  date: string; // 異動日
  type: ChangeType | "修改";
  text: string;
  by: string;
  removed?: { owners?: Person[]; tenants?: Person[]; vehicles?: Vehicle[] };
  at: string;
};

export type Household = {
  id: string; // 戶別 A-12F-A3
  buildingId: string;
  occupancy: Occupancy;
  owners: Person[];
  tenants: Person[];
  vehicles: Vehicle[];
  parking: ParkingSpace[];
  payer: Payer; // 管理費繳費人
  feeOverride?: number; // 特殊金額（空 = 依坪數與車位計算）
  note: string;
  history: HouseholdEvent[];
  updatedAt: string;
};

export const emptyHousehold = (id: string, buildingId: string): Household => ({ id, buildingId, occupancy: "自住", owners: [], tenants: [], vehicles: [], parking: [], payer: "所有權人", note: "", history: [], updatedAt: "" });

/* 管理費 */
export type FeeSettings = { perPing: number; car: number; moto: number; bike: number; dueDay: number };
export const DEFAULT_FEE: FeeSettings = { perPing: 80, car: 500, moto: 100, bike: 0, dueDay: 10 };

export const FEE_STATUS = ["未繳", "部分繳", "已繳", "免繳"] as const;
export type FeeStatus = (typeof FEE_STATUS)[number];
export const PAY_METHODS = ["現金", "轉帳", "超商代收", "信用卡", "其他"] as const;

export type FeeBill = {
  id: string; // 戶別:YYYY-MM
  buildingId: string;
  unitId: string;
  period: string; // YYYY-MM
  amount: number;
  paid: number;
  status: FeeStatus;
  payerRole: Payer;
  payerName: string; // 開單時的繳費人（異動後未繳帳單會改為新繳費人）
  paidAt: string;
  method: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** 每月管理費：權狀坪數 × 每坪單價 + 各類車位月費；有特殊金額時用特殊金額 */
export function monthlyFee(unitId: string, h: Pick<Household, "parking" | "feeOverride"> | undefined, s: FeeSettings) {
  if (h?.feeOverride !== undefined && h.feeOverride !== null) return h.feeOverride;
  const spaces = h?.parking ?? [];
  const n = (t: VehicleType) => spaces.filter((p) => p.type === t && p.right !== "社區租用").length;
  return Math.round(unitPing(unitId) * s.perPing) + n("汽車") * s.car + n("機車") * s.moto + n("腳踏車") * s.bike;
}

/** 目前繳費人姓名 */
export function payerOf(h: Household | undefined): { role: Payer; name: string } {
  if (!h) return { role: "所有權人", name: "" };
  const role: Payer = h.payer === "承租人" && h.tenants.length ? "承租人" : "所有權人";
  const list = role === "承租人" ? h.tenants : h.owners;
  return { role, name: list.map((p) => p.name).filter(Boolean).join("、") };
}

export const statusOf = (amount: number, paid: number): FeeStatus => (paid <= 0 ? (amount === 0 ? "免繳" : "未繳") : paid >= amount ? "已繳" : "部分繳");

export const periodOf = (date: string) => date.slice(0, 7);
