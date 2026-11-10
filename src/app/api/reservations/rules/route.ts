import { dataScope } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { getSettings, rulesText } from "@/lib/field-server";
import { RES_TYPES, rulesVersion, type ResType } from "@/lib/field";

/** 住戶預約前要同意的規範全文與版本 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const type = q.get("type") as ResType;
  if (!RES_TYPES.includes(type)) return Response.json({ error: "預約類型不正確" }, { status: 400 });
  const settings = await getSettings(dataScope(request));
  const text = await rulesText(settings, type);
  return Response.json({ type, text, version: rulesVersion(text), setting: settings.types[type], feePerPoint: settings.feePerPoint, pointPeriod: settings.pointPeriod });
}
