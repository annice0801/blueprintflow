import "server-only";
import { getBuilding, type TowerId } from "./buildings";
import { dateStr, num, oneOf, str, ValidationError } from "./validate";
import { CATEGORIES, SEVERITIES, STATUSES, type Category, type Issue, type Severity, type Status } from "./issues";

/** 從表單取出可編輯欄位；新增時 requireAll = true */
export function parseIssueFields(form: FormData, requireAll: boolean) {
  const fields: Partial<Pick<Issue, "buildingId" | "tower" | "floor" | "zone" | "x" | "y" | "title" | "description" | "assignee" | "due">> & {
    category?: Category;
    severity?: Severity;
    status?: Status;
  } = {
    title: str(form, "title"),
    description: str(form, "description"),
    zone: str(form, "zone"),
    category: oneOf(str(form, "category"), CATEGORIES, "類別"),
    severity: oneOf(str(form, "severity"), SEVERITIES, "嚴重程度"),
    status: oneOf(str(form, "status"), STATUSES, "狀態"),
    assignee: str(form, "assignee"),
    due: dateStr(str(form, "due"), "預計完成日"),
  };

  if (requireAll) {
    const buildingId = str(form, "buildingId") ?? "";
    const building = getBuilding(buildingId);
    if (!building) throw new ValidationError("找不到建築物");
    const floor = building.floors.find((f) => f.id === str(form, "floor"));
    if (!floor) throw new ValidationError("樓層不正確");
    const tower = str(form, "tower") as TowerId;
    if (!floor.towers.includes(tower)) throw new ValidationError("棟別不正確");
    const x = num(str(form, "x"), "位置");
    const y = num(str(form, "y"), "位置");
    if (x === undefined || y === undefined) throw new ValidationError("請在平面圖上點選位置");
    if (!fields.title) throw new ValidationError("請填寫問題標題");
    Object.assign(fields, { buildingId, floor: floor.id, tower, x, y });
  }
  if (fields.title === "") throw new ValidationError("請填寫問題標題");
  if ((fields.title?.length ?? 0) > 100) throw new ValidationError("標題最多 100 字");
  if ((fields.assignee?.length ?? 0) > 60) throw new ValidationError("負責單位最多 60 字");
  if ((fields.description?.length ?? 0) > 2000) throw new ValidationError("說明最多 2000 字");

  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as typeof fields;
}
