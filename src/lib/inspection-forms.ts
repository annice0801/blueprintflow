import "server-only";
import { INSPECTION_DEFS, INSPECTION_LEVELS, INSPECTION_RESULTS, planFromDef, type InspectionPlan } from "./inspections";
import { readCollection } from "./store";
import { dateStr, maxLen, num, oneOf, str, ValidationError } from "./validate";

type Src = Record<string, unknown>;
const CATEGORIES = ["消防", "建築", "設備", "衛生", "組織"] as const;

/** 社區的檢測清單：已存的設定 + 尚未動過的預設項目 */
export async function plansOf(buildingId: string) {
  const stored = (await readCollection<InspectionPlan>("inspections")).filter((p) => p.buildingId === buildingId);
  const defaults = INSPECTION_DEFS.filter((d) => !stored.some((p) => p.defId === d.id)).map((d) => planFromDef(d, buildingId));
  return [...stored, ...defaults];
}

export function parsePlan(src: Src, creating: boolean) {
  const name = maxLen(str(src, "name"), 60, "項目名稱");
  if (creating && !name) throw new ValidationError("請填寫項目名稱");
  const every = num(src.everyMonths === undefined ? undefined : String(src.everyMonths), "週期");
  if (every !== undefined && (every < 1 || every > 120 || !Number.isInteger(every))) throw new ValidationError("週期需為 1–120 個月");
  return {
    name,
    category: oneOf(str(src, "category"), CATEGORIES, "類別"),
    level: oneOf(str(src, "level"), INSPECTION_LEVELS, "性質"),
    everyMonths: every,
    basis: maxLen(str(src, "basis"), 300, "法源"),
    authority: maxLen(str(src, "authority"), 100, "主管機關"),
    how: maxLen(str(src, "how"), 300, "辦理方式"),
    note: maxLen(str(src, "note"), 500, "備註"),
    enabled: typeof src.enabled === "boolean" ? src.enabled : undefined,
    dueOverride: dateStr(str(src, "dueOverride"), "下次期限"),
    vendor: maxLen(str(src, "vendor"), 60, "委託廠商"),
  };
}

export function parseInspectionRecord(src: Src) {
  const date = dateStr(str(src, "date"), "辦理日");
  if (!date) throw new ValidationError("請填寫辦理日");
  return {
    date: date.slice(0, 10),
    result: oneOf(str(src, "result"), INSPECTION_RESULTS, "結果") ?? "合格",
    vendor: maxLen(str(src, "vendor"), 60, "廠商") ?? "",
    cost: maxLen(str(src, "cost"), 30, "費用") ?? "",
    note: maxLen(str(src, "note"), 500, "備註") ?? "",
  };
}

/** 取得已存的設定；預設項目第一次修改時才寫入（id = 社區:項目） */
export function findOrCreate(all: InspectionPlan[], id: string) {
  const found = all.find((p) => p.id === id);
  if (found) return found;
  const [buildingId, defId] = id.split(":");
  const def = INSPECTION_DEFS.find((d) => d.id === defId);
  if (!buildingId || !def) return null;
  const plan = planFromDef(def, buildingId);
  all.push(plan);
  return plan;
}
