import { dataScope } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { getSettings } from "@/lib/field-server";
import { SHIFT_ROLES, type Shift } from "@/lib/field";
import { requireBuildingId } from "@/lib/mgmt-forms";
import { mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody, str, ValidationError } from "@/lib/validate";

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const buildingId = dataScope(request);
  const from = q.get("from") ?? "0000";
  const to = q.get("to") ?? "9999";
  return Response.json((await readCollection<Shift>("shifts")).filter((s) => s.buildingId === buildingId && s.date >= from && s.date <= to));
}

/** 手動設定某人某天的班別（code 為休假或空白時刪除） */
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const name = (str(body, "name") ?? "").slice(0, 40);
    const date = str(body, "date") ?? "";
    const code = str(body, "code") ?? "";
    const roleId = (SHIFT_ROLES as readonly string[]).includes(str(body, "roleId") ?? "") ? (str(body, "roleId") as Shift["roleId"]) : "guard";
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError("請指定人員與日期");
    const def = (await getSettings(buildingId)).shiftCodes.find((c) => c.code === code);
    if (code && !def) throw new ValidationError(`未知班別「${code}」，請先在班別設定新增`);
    const shift = await mutateCollection<Shift, Shift | null>("shifts", (all) => {
      const i = all.findIndex((s) => s.buildingId === buildingId && s.name === name && s.date === date);
      if (i !== -1) all.splice(i, 1);
      if (!def || def.off) return null;
      const s: Shift = { id: crypto.randomUUID(), buildingId, date, name, roleId, code, start: def.start, end: def.end, post: (str(body, "post") ?? "").slice(0, 30), note: "", source: "手動", updatedAt: new Date().toISOString() };
      all.push(s);
      return s;
    });
    return Response.json({ shift }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
