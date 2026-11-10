import "server-only";
import { residentUnits, getBuilding, unitPing } from "./buildings";
import { DEFAULT_SETTINGS, hoursOf, pointLedger, RES_TYPES, RESIDENT_TYPES, rulesVersion, type FieldSettings, type Reservation, type ResType } from "./field";
import { mutateCollection, readCollection } from "./store";
import { str, ValidationError } from "./validate";

export async function getSettings(buildingId: string): Promise<FieldSettings> {
  const saved = (await readCollection<FieldSettings>("settings")).find((s) => s.buildingId === buildingId);
  // 與預設值合併：新增的預約類型、欄位自動補齊
  const types = Object.fromEntries(RES_TYPES.map((t) => [t, { ...DEFAULT_SETTINGS.types[t], ...saved?.types?.[t] }])) as FieldSettings["types"];
  return { ...DEFAULT_SETTINGS, ...saved, types, buildingId, updatedAt: saved?.updatedAt ?? "" };
}

export async function saveSettings(buildingId: string, patch: Partial<FieldSettings>) {
  const current = await getSettings(buildingId);
  const next: FieldSettings = { ...current, ...patch, buildingId, updatedAt: new Date().toISOString() };
  await mutateCollection<FieldSettings, void>("settings", (all) => {
    const i = all.findIndex((s) => s.buildingId === buildingId);
    if (i === -1) all.push(next);
    else all[i] = next;
  });
  return next;
}

/** 規範全文 = 類型規範 + 連結的規範條例條文 */
export async function rulesText(settings: FieldSettings, type: ResType) {
  const ts = settings.types[type];
  if (!ts.regulationId) return ts.rules;
  const reg = (await readCollection<{ id: string; title: string; content: string }>("regulations")).find((r) => r.id === ts.regulationId);
  return reg ? `${ts.rules}\n\n【${reg.title}】\n${reg.content}` : ts.rules;
}

/** 伺服器本地時間 YYYY-MM-DDTHH:mm（offsetMin 分鐘後） */
export function localNow(offsetMin = 0) {
  const d = new Date(Date.now() + offsetMin * 60000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const hm = (dt: string) => dt.slice(11, 16);
const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);

/** 驗證預約欄位、時段規則與容量 */
export async function validateReservation(src: Record<string, unknown>, settings: FieldSettings, opts: { resident: boolean; ignoreId?: string }) {
  const type = str(src, "type") as ResType;
  if (!RES_TYPES.includes(type)) throw new ValidationError("預約類型不正確");
  if (opts.resident && !RESIDENT_TYPES.includes(type)) throw new ValidationError("此類型需由管理室登記");
  const ts = settings.types[type];
  if (!ts.enabled) throw new ValidationError(`${type}目前暫停預約`);
  const unitId = str(src, "unitId") ?? "";
  const b = getBuilding(settings.buildingId)!;
  if (!residentUnits(b).some((u) => u.id === unitId)) throw new ValidationError("請選擇戶別");
  const name = (str(src, "name") ?? "").slice(0, 40);
  const phone = (str(src, "phone") ?? "").slice(0, 30);
  if (!name || !phone) throw new ValidationError("請填寫姓名與電話");
  const start = str(src, "start") ?? "";
  const end = str(src, "end") ?? "";
  if (!DT.test(start) || !DT.test(end) || end <= start) throw new ValidationError("請選擇正確的時段");
  if (!sameDay(start, end)) throw new ValidationError("預約需在同一天內");
  if (opts.resident && start < localNow(-5)) throw new ValidationError("不能預約過去的時間");
  if (hm(start) < ts.openFrom || hm(end) > ts.openTo) throw new ValidationError(`${type}開放時間為 ${ts.openFrom}–${ts.openTo}`);
  const dow = new Date(`${start.slice(0, 10)}T00:00:00`).getDay();
  if (ts.weekdaysOnly && (dow === 0 || dow === 6)) throw new ValidationError(`${type}假日不開放`);
  if (hoursOf({ start, end }) > ts.maxHours) throw new ValidationError(`${type}每次最多 ${ts.maxHours} 小時`);
  if (type === "搬家" && opts.resident && Date.parse(start) - Date.now() < 3 * 86400000) throw new ValidationError("搬家需於 3 日前預約");

  const people = Math.max(1, Math.min(50, Number(src.people) || 1));
  const overlapping = (await readCollection<Reservation>("reservations")).filter(
    (r) => r.buildingId === settings.buildingId && r.type === type && r.id !== opts.ignoreId && ["待審核", "已確認", "使用中"].includes(r.status) && r.start < end && r.end > start,
  );
  if (overlapping.length >= ts.capacity) throw new ValidationError(`這個時段${type}已額滿，請選其他時間`);

  // 住戶預約必須同意當前版本的規範
  let consent: Reservation["consent"];
  if (opts.resident || src.consent) {
    const version = rulesVersion(await rulesText(settings, type));
    if (str(src, "consentVersion") !== version) throw new ValidationError("請先閱讀並勾選同意預約規範（規範已更新，請重新確認）");
    consent = { at: new Date().toISOString(), version };
  }
  return { type, unitId, name, phone, start, end, people, note: (str(src, "note") ?? "").slice(0, 500), consent };
}

/** 報到（領磁扣）時扣點：先扣本期剩餘點數，不足部分折算管理費 */
export function chargePoints(r: Reservation, all: Reservation[], settings: FieldSettings, penalty?: number) {
  const pts = penalty ?? Math.ceil(hoursOf(r) * settings.types[r.type].pointsPerHour);
  if (!pts) return { estimate: r.points.estimate, charged: 0, overflow: 0, fee: 0 };
  const ledger = pointLedger(all.filter((x) => x.id !== r.id), r.unitId, unitPing(r.unitId), settings, r.start.slice(0, 10));
  const charged = Math.min(pts, ledger.left);
  const overflow = pts - charged;
  return { estimate: r.points.estimate, charged, overflow, fee: overflow * settings.feePerPoint };
}

export function estimatePoints(type: ResType, start: string, end: string, settings: FieldSettings) {
  return Math.ceil(hoursOf({ start, end }) * settings.types[type].pointsPerHour);
}
