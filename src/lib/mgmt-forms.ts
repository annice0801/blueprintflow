import "server-only";
import { getBuilding } from "./buildings";
import { ATTENDANCE, COMPANY_KINDS, MEETING_TYPES, RECORD_TYPES, REG_CATEGORIES, REG_STATUS, ROLE_IDS, TODO_PRIORITY, TODO_STATUS, VENDOR_CATEGORIES, type Attendance, type Contact, type PlanRef, type Regulation, type RoleId, type ServiceRecord, type Term, type TermMember, type Todo, type Vendor } from "./mgmt";
import { dateStr, defined, maxLen, num, oneOf, str, ValidationError } from "./validate";

type Src = Record<string, unknown>;

export function requireBuildingId(src: Src) {
  const id = str(src, "buildingId");
  if (!id || !getBuilding(id)) throw new ValidationError("找不到建築物");
  return id;
}

export function parseRoles(v: unknown): RoleId[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.some((x) => !ROLE_IDS.includes(x as RoleId))) throw new ValidationError("負責角色不正確");
  return [...new Set(v as RoleId[])];
}

export function parsePlanRef(v: unknown): PlanRef | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const o = v as Src;
  const b = getBuilding("blueprint")!;
  const floor = str(o, "floor");
  const tower = str(o, "tower");
  const f = b.floors.find((x) => x.id === floor);
  if (!f || !f.towers.includes(tower as PlanRef["tower"])) throw new ValidationError("位置的樓層 / 棟別不正確");
  const x = Number(o.x);
  const y = Number(o.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new ValidationError("位置座標不正確");
  return {
    floor: f.id,
    tower: tower as PlanRef["tower"],
    ...(typeof o.zoneId === "string" && o.zoneId && { zoneId: o.zoneId.slice(0, 40) }),
    label: maxLen(str(o, "label"), 60, "位置名稱") ?? f.label,
    x,
    y,
  };
}

export function parseTodo(src: Src, creating: boolean) {
  const f = defined({
    title: maxLen(str(src, "title"), 120, "標題"),
    description: maxLen(str(src, "description"), 4000, "說明"),
    status: oneOf(str(src, "status"), TODO_STATUS, "狀態"),
    priority: oneOf(str(src, "priority"), TODO_PRIORITY, "優先度"),
    start: dateStr(str(src, "start"), "開始日"),
    due: dateStr(str(src, "due"), "期限"),
    assignees: parseRoles(src.assignees),
    meetingId: str(src, "meetingId"),
    vendorId: str(src, "vendorId"),
    after: str(src, "after"),
    afterDays: num(src.afterDays === undefined || src.afterDays === "" ? undefined : String(src.afterDays), "間隔天數"),
  }) as Partial<Todo>;
  const out = f as Omit<Partial<Todo>, "location"> & { location?: PlanRef | null };
  const loc = parsePlanRef(src.location);
  if (loc !== undefined) out.location = loc;
  if (f.title === "" || (creating && !f.title)) throw new ValidationError("請填寫待辦事項標題");
  if (creating && !f.assignees?.length) throw new ValidationError("請選擇至少一位追蹤者");
  if (f.start && f.due && f.start > f.due) throw new ValidationError("開始日不可晚於期限");
  return out;
}

const id = (o: Src) => (typeof o.id === "string" && /^[\w-]{1,64}$/.test(o.id) ? o.id : crypto.randomUUID());

function parseContacts(v: unknown): Contact[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) throw new ValidationError("聯絡人資料不正確");
  return v.slice(0, 200).map((c: Src) => ({
    id: id(c),
    name: maxLen(str(c, "name"), 40, "聯絡人姓名") ?? "",
    title: maxLen(str(c, "title"), 40, "職稱") ?? "",
    dept: maxLen(str(c, "dept"), 40, "部門") ?? "",
    phone: maxLen(str(c, "phone"), 40, "電話") ?? "",
    email: maxLen(str(c, "email"), 80, "Email") ?? "",
    reportsTo: maxLen(str(c, "reportsTo"), 64, "上級") ?? "",
    note: maxLen(str(c, "note"), 500, "備註") ?? "",
  }));
}

export function parseVendor(src: Src, creating: boolean) {
  const f = defined({
    kind: oneOf(str(src, "kind"), COMPANY_KINDS, "公司類型"),
    name: maxLen(str(src, "name"), 80, "公司名稱"),
    category: oneOf(str(src, "category"), VENDOR_CATEGORIES, "類別"),
    taxId: maxLen(str(src, "taxId"), 20, "統一編號"),
    representative: maxLen(str(src, "representative"), 40, "負責人"),
    representativePhone: maxLen(str(src, "representativePhone"), 40, "負責人電話"),
    developer: maxLen(str(src, "developer"), 80, "起造人"),
    developerPhone: maxLen(str(src, "developerPhone"), 40, "起造人電話"),
    builderId: maxLen(str(src, "builderId"), 64, "所屬建商"),
    contact: maxLen(str(src, "contact"), 40, "聯絡窗口"),
    phone: maxLen(str(src, "phone"), 40, "電話"),
    email: maxLen(str(src, "email"), 80, "Email"),
    address: maxLen(str(src, "address"), 120, "地址"),
    website: maxLen(str(src, "website"), 200, "網站"),
    scope: maxLen(str(src, "scope"), 1000, "服務內容"),
    contractStart: dateStr(str(src, "contractStart"), "合約起日"),
    contractEnd: dateStr(str(src, "contractEnd"), "合約迄日"),
    amount: maxLen(str(src, "amount"), 60, "合約金額"),
    note: maxLen(str(src, "note"), 2000, "備註"),
    contacts: parseContacts(src.contacts),
  }) as Partial<Vendor>;
  if (f.name === "" || (creating && !f.name)) throw new ValidationError("請填寫公司名稱");
  if (f.taxId && !/^\d{8}$/.test(f.taxId)) throw new ValidationError("統一編號應為 8 位數字");
  return f;
}

export function parseRecord(src: Src): Omit<ServiceRecord, "id" | "createdAt"> {
  const date = dateStr(str(src, "date"), "日期");
  const title = maxLen(str(src, "title"), 120, "項目");
  if (!date || !title) throw new ValidationError("請填寫日期與項目");
  const loc = parsePlanRef(src.location ?? undefined);
  return {
    date,
    type: oneOf(str(src, "type"), RECORD_TYPES, "類型") ?? "維修",
    title,
    description: maxLen(str(src, "description"), 2000, "說明") ?? "",
    cost: maxLen(str(src, "cost"), 40, "費用") ?? "",
    handler: maxLen(str(src, "handler"), 60, "到場人員") ?? "",
    result: maxLen(str(src, "result"), 1000, "處理結果") ?? "",
    ...(loc && { location: loc }),
  };
}

export function parseTerm(src: Src, creating: boolean) {
  const f = defined({
    kind: oneOf(str(src, "kind"), ["committee", "property"] as const, "屆次類型"),
    name: maxLen(str(src, "name"), 60, "名稱"),
    companyId: maxLen(str(src, "companyId"), 64, "物業公司"),
    start: dateStr(str(src, "start"), "起日"),
    end: dateStr(str(src, "end"), "迄日"),
    note: maxLen(str(src, "note"), 2000, "備註"),
  }) as Partial<Term>;
  if (Array.isArray(src.members))
    f.members = src.members.slice(0, 100).map((m: Src): TermMember => {
      const roleId = str(m, "roleId") as RoleId;
      if (!ROLE_IDS.includes(roleId)) throw new ValidationError("成員職務不正確");
      return {
        id: id(m),
        roleId,
        name: maxLen(str(m, "name"), 40, "姓名") ?? "",
        phone: maxLen(str(m, "phone"), 40, "電話") ?? "",
        email: maxLen(str(m, "email"), 80, "Email") ?? "",
        note: maxLen(str(m, "note"), 500, "備註") ?? "",
        start: dateStr(str(m, "start"), "接任日") ?? "",
        end: dateStr(str(m, "end"), "卸任日") ?? "",
      };
    });
  if (creating && (!f.kind || !f.name)) throw new ValidationError("請填寫屆次名稱");
  if (f.start && f.end && f.start > f.end) throw new ValidationError("起日不可晚於迄日");
  return f;
}

export function parseAttendance(v: unknown): Attendance[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) throw new ValidationError("出席資料不正確");
  return v.slice(0, 60).flatMap((a: Src) => {
    const name = maxLen(str(a, "name"), 20, "出席者姓名");
    const status = oneOf(str(a, "status"), ATTENDANCE, "出席狀態");
    return name && status ? [{ name, status, title: maxLen(str(a, "title"), 40, "職稱") ?? "" }] : [];
  });
}

export function parseRegulation(src: FormData | Src, creating: boolean) {
  const f = defined({
    title: maxLen(str(src, "title"), 120, "名稱"),
    category: oneOf(str(src, "category"), REG_CATEGORIES, "類別"),
    status: oneOf(str(src, "status"), REG_STATUS, "狀態"),
    version: maxLen(str(src, "version"), 20, "版本"),
    effectiveDate: dateStr(str(src, "effectiveDate"), "生效日"),
    meetingId: maxLen(str(src, "meetingId"), 64, "通過會議"),
    termId: maxLen(str(src, "termId"), 64, "屆次"),
    summary: maxLen(str(src, "summary"), 1000, "摘要"),
    content: maxLen(str(src, "content"), 100_000, "條文內容"),
  }) as Partial<Regulation>;
  if (f.title === "" || (creating && !f.title)) throw new ValidationError("請填寫規範名稱");
  return f;
}

export function parseMeetingMeta(src: Src) {
  return defined({
    title: maxLen(str(src, "title"), 120, "會議名稱"),
    type: oneOf(str(src, "type"), MEETING_TYPES, "會議類型"),
    date: dateStr(str(src, "date"), "會議日期"),
    place: maxLen(str(src, "place"), 80, "會議地點"),
  });
}
