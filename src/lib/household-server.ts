import "server-only";
import { invalidateAuthCache } from "./auth";
import { getBuilding, residentUnits } from "./buildings";
import { getSettings } from "./field-server";
import {
  CHANGE_TYPES,
  DEFAULT_FEE,
  emptyHousehold,
  OCCUPANCY,
  PAYERS,
  payerOf,
  periodOf,
  SPACE_RIGHTS,
  VEHICLE_TYPES,
  type ChangeType,
  type FeeBill,
  type FeeSettings,
  type Household,
  type ParkingSpace,
  type Person,
  type Vehicle,
} from "./households";
import type { User } from "./perms";
import { mutateCollection, readCollection } from "./store";
import { dateStr, maxLen, num, oneOf, str, ValidationError } from "./validate";

type Src = Record<string, unknown>;
const id = (o: Src) => (typeof o.id === "string" && /^[\w-]{1,64}$/.test(o.id) ? o.id : crypto.randomUUID());
const list = (v: unknown, max: number) => (Array.isArray(v) ? (v.slice(0, max) as Src[]) : undefined);

export const parsePeople = (v: unknown) =>
  list(v, 10)?.map(
    (p): Person => ({
      id: id(p),
      name: maxLen(str(p, "name"), 40, "姓名") ?? "",
      phone: maxLen(str(p, "phone"), 30, "電話") ?? "",
      email: (maxLen(str(p, "email"), 80, "Email") ?? "").toLowerCase(),
      since: dateStr(str(p, "since"), "起始日")?.slice(0, 10) ?? "",
      note: maxLen(str(p, "note"), 200, "備註") ?? "",
    }),
  );

const parseVehicles = (v: unknown) =>
  list(v, 20)?.map((x): Vehicle => ({ id: id(x), type: oneOf(str(x, "type"), VEHICLE_TYPES, "車種") ?? "汽車", plate: (maxLen(str(x, "plate"), 12, "車號") ?? "").toUpperCase(), personId: str(x, "personId") ?? "", note: maxLen(str(x, "note"), 100, "備註") ?? "" }));

const parseParking = (v: unknown) =>
  list(v, 20)?.map((x): ParkingSpace => ({ id: id(x), type: oneOf(str(x, "type"), VEHICLE_TYPES, "車位類型") ?? "汽車", number: maxLen(str(x, "number"), 20, "車位編號") ?? "", right: oneOf(str(x, "right"), SPACE_RIGHTS, "車位權屬") ?? "產權", note: maxLen(str(x, "note"), 100, "備註") ?? "" }));

export function parseHousehold(src: Src) {
  const fee = src.feeOverride;
  return Object.fromEntries(
    Object.entries({
      occupancy: oneOf(str(src, "occupancy"), OCCUPANCY, "居住狀態"),
      owners: parsePeople(src.owners),
      tenants: parsePeople(src.tenants),
      vehicles: parseVehicles(src.vehicles),
      parking: parseParking(src.parking),
      payer: oneOf(str(src, "payer"), PAYERS, "繳費人"),
      feeOverride: fee === null || fee === "" ? null : fee === undefined ? undefined : num(String(fee), "管理費金額"),
      note: maxLen(str(src, "note"), 500, "備註"),
    }).filter(([, v]) => v !== undefined),
  ) as Partial<Household> & { feeOverride?: number | null };
}

export function requireUnit(buildingId: string, unitId: string) {
  const b = getBuilding(buildingId);
  if (!b || !residentUnits(b).some((u) => u.id === unitId)) throw new ValidationError("找不到戶別");
}

export async function feeSettings(buildingId: string): Promise<FeeSettings> {
  return { ...DEFAULT_FEE, ...(await getSettings(buildingId)).fee };
}

/** 未繳帳單改由目前繳費人負責（異動日所在月份起） */
async function syncBills(h: Household, fromPeriod: string) {
  const { role, name } = payerOf(h);
  return mutateCollection<FeeBill, number>("fees", (all) => {
    let n = 0;
    for (const b of all)
      if (b.buildingId === h.buildingId && b.unitId === h.id && b.period >= fromPeriod && (b.status === "未繳" || b.status === "部分繳") && (b.payerName !== name || b.payerRole !== role)) {
        Object.assign(b, { payerName: name, payerRole: role, updatedAt: new Date().toISOString() });
        n++;
      }
    return n;
  });
}

const names = (ps: Person[]) => ps.map((p) => p.name || "（未填）").join("、") || "—";

/**
 * 住戶異動：過戶（換所有權人）、換租（換承租人）、退租（承租人遷出）。
 * 舊住戶移入異動紀錄；車輛跟著人走（可勾選保留）；車位屬於戶別不動；
 * 異動月份起的未繳帳單改由新繳費人負責；可停用舊住戶帳號、為新住戶開通帳號並綁定戶別。
 */
export async function changeHousehold(buildingId: string, unitId: string, src: Src, by: string) {
  requireUnit(buildingId, unitId);
  const type = oneOf(str(src, "type"), CHANGE_TYPES, "異動類型") as ChangeType;
  if (!type) throw new ValidationError("請選擇異動類型");
  const date = dateStr(str(src, "date"), "異動日")?.slice(0, 10);
  if (!date) throw new ValidationError("請填寫異動日");
  const people = (parsePeople(src.people) ?? []).filter((p) => p.name);
  if (type !== "退租" && !people.length) throw new ValidationError("請填寫新住戶");
  const keep = new Set(Array.isArray(src.keepVehicles) ? (src.keepVehicles as string[]) : []);
  const newVehicles = parseVehicles(src.newVehicles) ?? [];
  const occupancy = oneOf(str(src, "occupancy"), OCCUPANCY, "居住狀態");
  const disableAccounts = src.disableAccounts === true;
  const now = new Date().toISOString();
  for (const p of people) p.since ||= date;

  let removedPeople: Person[] = [];
  const household = await mutateCollection<Household, Household>("residents", (all) => {
    let h = all.find((x) => x.id === unitId && x.buildingId === buildingId);
    if (!h) {
      h = emptyHousehold(unitId, buildingId);
      all.push(h);
    }
    const field = type === "過戶" ? "owners" : "tenants";
    removedPeople = h[field];
    const gone = new Set(removedPeople.map((p) => p.id));
    const removedVehicles = h.vehicles.filter((v) => gone.has(v.personId) && !keep.has(v.id));
    h[field] = type === "退租" ? [] : people;
    h.vehicles = [...h.vehicles.filter((v) => !removedVehicles.includes(v)), ...newVehicles.map((v) => ({ ...v, personId: v.personId || people[0]?.id || "" }))];
    if (type === "換租") h.occupancy = "出租";
    if (type === "退租") {
      h.occupancy = occupancy && occupancy !== "出租" ? occupancy : "自住";
      h.payer = "所有權人";
    }
    if (occupancy && type !== "退租") h.occupancy = occupancy;
    const label = type === "過戶" ? "所有權人" : "承租人";
    h.history.push({
      id: crypto.randomUUID(),
      date,
      type,
      text: `${type}：${label} ${names(removedPeople)} → ${type === "退租" ? "（遷出）" : names(people)}${removedVehicles.length ? `；移除車輛 ${removedVehicles.map((v) => v.plate).join("、")}` : ""}`,
      by,
      removed: { [field]: removedPeople, vehicles: removedVehicles },
      at: now,
    });
    h.updatedAt = now;
    return h;
  });

  const billsUpdated = await syncBills(household, periodOf(date));

  // 帳號同步：停用舊住戶帳號（綁定此戶、且不是新住戶）；新住戶有 Email → 開通並綁定戶別
  const newEmails = new Set(people.map((p) => p.email).filter(Boolean));
  const oldEmails = new Set(removedPeople.map((p) => p.email).filter(Boolean));
  const accounts = await mutateCollection<User, { disabled: string[]; added: string[] }>("users", (all) => {
    const out = { disabled: [] as string[], added: [] as string[] };
    if (disableAccounts)
      for (const u of all) {
        const m = (u.memberships ?? []).find((x) => x.buildingId === buildingId && x.status === "active" && x.role === "resident" && (x.unitId === unitId || oldEmails.has(u.email)));
        if (m && !newEmails.has(u.email)) {
          m.status = "disabled";
          m.note = `${date} ${type}，帳號停用`.slice(0, 300);
          out.disabled.push(u.email);
        }
      }
    for (const p of people) {
      if (!p.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) continue;
      let u = all.find((x) => x.id === p.email);
      if (!u) {
        u = { id: p.email, email: p.email, name: p.name, picture: "", superAdmin: false, memberships: [], createdAt: now, lastLoginAt: "" };
        all.push(u);
      }
      u.memberships ??= [];
      const m = u.memberships.find((x) => x.buildingId === buildingId);
      if (m) Object.assign(m, { status: "active", unitId, ...(m.role === "resident" || m.status !== "active" ? { role: "resident" } : {}) });
      else u.memberships.push({ buildingId, role: "resident", status: "active", unitId, note: `${date} ${type}自動開通`, createdAt: now });
      out.added.push(p.email);
    }
    return out;
  });
  if (accounts.disabled.length || accounts.added.length) invalidateAuthCache();
  return { household, billsUpdated, accounts };
}

/** 一般修改（人員、車輛、車位、繳費設定）：記一筆修改紀錄；繳費人變更時同步未繳帳單 */
export async function updateHousehold(buildingId: string, unitId: string, src: Src, by: string) {
  requireUnit(buildingId, unitId);
  const f = parseHousehold(src);
  const now = new Date().toISOString();
  const household = await mutateCollection<Household, Household>("residents", (all) => {
    let h = all.find((x) => x.id === unitId && x.buildingId === buildingId);
    if (!h) {
      h = emptyHousehold(unitId, buildingId);
      all.push(h);
    }
    const changes = [
      f.owners && names(f.owners) !== names(h.owners) && `所有權人 ${names(f.owners)}`,
      f.tenants && names(f.tenants) !== names(h.tenants) && `承租人 ${names(f.tenants)}`,
      f.vehicles && f.vehicles.map((v) => v.plate).join() !== h.vehicles.map((v) => v.plate).join() && `車輛 ${f.vehicles.map((v) => v.plate).join("、") || "—"}`,
      f.parking && f.parking.map((p) => p.number).join() !== h.parking.map((p) => p.number).join() && `車位 ${f.parking.map((p) => `${p.type}${p.number}`).join("、") || "—"}`,
      f.occupancy && f.occupancy !== h.occupancy && `狀態 ${f.occupancy}`,
      f.payer && f.payer !== h.payer && `繳費人 ${f.payer}`,
    ].filter(Boolean);
    const { feeOverride, ...rest } = f;
    Object.assign(h, rest);
    if (feeOverride === null) delete h.feeOverride;
    else if (feeOverride !== undefined) h.feeOverride = feeOverride;
    if (changes.length) h.history.push({ id: crypto.randomUUID(), date: now.slice(0, 10), type: "修改", text: changes.join("；"), by, at: now });
    h.updatedAt = now;
    return h;
  });
  await syncBills(household, periodOf(now));
  return household;
}

export const readHouseholds = async (buildingId: string) => (await readCollection<Household>("residents")).filter((h) => h.buildingId === buildingId);
