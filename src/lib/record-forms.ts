import "server-only";
import { getArea, getBuilding, SHOPS } from "./buildings";
import { GATE_ACTIONS, GATE_PARTS, GATES, PLANT_EVENT_TYPES, PLANT_HEALTH, PLANT_TYPES, SHOP_STATUS, type Plant, type PlantEvent, type Shop } from "./records";
import { dateStr, defined, maxLen, num, oneOf, str, ValidationError } from "./validate";

type Src = FormData | Record<string, unknown>;

export function requireBuilding(id: string | undefined) {
  const b = id ? getBuilding(id) : undefined;
  if (!b) throw new ValidationError("找不到建築物");
  return b;
}

/* ── 植栽 ── */

export function parsePlant(src: Src, creating: boolean) {
  const fields = defined({
    name: maxLen(str(src, "name"), 60, "名稱"),
    species: maxLen(str(src, "species"), 60, "樹種"),
    bed: maxLen(str(src, "bed"), 40, "花圃"),
    type: oneOf(str(src, "type"), PLANT_TYPES, "類型"),
    health: oneOf(str(src, "health"), PLANT_HEALTH, "狀態"),
    plantedAt: dateStr(str(src, "plantedAt"), "種植日期"),
    height: maxLen(str(src, "height"), 20, "高度"),
    description: maxLen(str(src, "description"), 2000, "介紹"),
  }) as Partial<Plant>;
  if (fields.name === "" || (creating && !fields.name)) throw new ValidationError("請填寫植栽名稱");
  if (creating) {
    const b = requireBuilding(str(src, "buildingId"));
    const area = getArea(b, str(src, "areaId") ?? "");
    if (!area || area.kind !== "garden") throw new ValidationError("公共區域不正確");
    const x = num(str(src, "x"), "位置");
    const y = num(str(src, "y"), "位置");
    const { bounds: r } = area;
    if (x === undefined || y === undefined || x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) throw new ValidationError("請在花圃範圍內點選位置");
    Object.assign(fields, { buildingId: b.id, areaId: area.id, x, y });
  }
  return fields;
}

export function parsePlantEvent(src: Src, creating: boolean) {
  const fields = defined({
    date: dateStr(str(src, "date"), "日期"),
    type: oneOf(str(src, "type"), PLANT_EVENT_TYPES, "事件類型"),
    typhoon: maxLen(str(src, "typhoon"), 40, "颱風名稱"),
    description: maxLen(str(src, "description"), 2000, "狀況說明"),
    handling: maxLen(str(src, "handling"), 2000, "處理方式"),
    handler: maxLen(str(src, "handler"), 60, "處理人"),
  }) as Partial<PlantEvent>;
  if (fields.date === "" || (creating && !fields.date)) throw new ValidationError("請填寫日期");
  return fields;
}

/* ── 車道紀錄 ── */

export function parseGateLog(src: Src, creating: boolean) {
  const fields = defined({
    gate: oneOf(str(src, "gate"), GATES, "道閘"),
    action: oneOf(str(src, "action"), GATE_ACTIONS, "動作"),
    at: dateStr(str(src, "at"), "時間"),
    operator: maxLen(str(src, "operator"), 40, "操作人"),
    note: maxLen(str(src, "note"), 1000, "備註"),
    part: maxLen(str(src, "part"), 20, "設備"),
  });
  if (fields.part && fields.gate && !GATE_PARTS[fields.gate].includes(fields.part)) throw new ValidationError(`${fields.gate}道閘沒有「${fields.part}」`);
  if (creating) {
    if (!fields.gate || !fields.action || !fields.at) throw new ValidationError("請填寫道閘、動作與時間");
    Object.assign(fields, { buildingId: requireBuilding(str(src, "buildingId")).id });
  } else if (fields.at === "") throw new ValidationError("請填寫時間");
  return fields;
}

/* ── 店鋪 ── */

export function parseShop(src: Src, id: string) {
  if (!SHOPS.some((s) => s.id === id)) throw new ValidationError("找不到店鋪");
  return {
    ...defined({
      shopName: maxLen(str(src, "shopName"), 60, "店名"),
      business: maxLen(str(src, "business"), 60, "業種"),
      status: oneOf(str(src, "status"), SHOP_STATUS, "經營狀態"),
      hours: maxLen(str(src, "hours"), 60, "營業時間"),
      phone: maxLen(str(src, "phone"), 30, "電話"),
      contact: maxLen(str(src, "contact"), 40, "聯絡人"),
      note: maxLen(str(src, "note"), 1000, "備註"),
    }),
    buildingId: requireBuilding(str(src, "buildingId")).id,
  } as Partial<Shop> & { buildingId: string };
}

/* ── 住戶名冊（管理員） ── */


