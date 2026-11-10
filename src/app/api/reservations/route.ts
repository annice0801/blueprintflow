import { dataScope } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { unitPing } from "@/lib/buildings";
import { estimatePoints, getSettings, validateReservation } from "@/lib/field-server";
import { pointLedger, type Reservation } from "@/lib/field";
import { requireBuildingId } from "@/lib/mgmt-forms";
import { mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody } from "@/lib/validate";

/**
 * 物業：?buildingId= 全部預約
 * 住戶：?unitId=&phone= 只回自己的預約與點數帳（電話需相符）
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const buildingId = dataScope(request);
  const all = (await readCollection<Reservation>("reservations")).filter((r) => r.buildingId === buildingId);
  const unitId = q.get("unitId");
  if (unitId) {
    const phone = (q.get("phone") ?? "").replace(/\D/g, "");
    const mine = all.filter((r) => r.unitId === unitId && phone.length >= 6 && r.phone.replace(/\D/g, "").endsWith(phone.slice(-6)));
    const settings = await getSettings(buildingId);
    return Response.json({ reservations: mine, ledger: pointLedger(all, unitId, unitPing(unitId), settings, new Date().toISOString().slice(0, 10)) });
  }
  return Response.json(all);
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const settings = await getSettings(buildingId);
    const resident = body.source !== "物業";
    const f = await validateReservation(body, settings, { resident });
    const now = new Date().toISOString();
    const r: Reservation = {
      id: crypto.randomUUID(),
      buildingId,
      code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      ...f,
      status: settings.types[f.type].needApproval && resident ? "待審核" : "已確認",
      source: resident ? "住戶" : "物業",
      points: { estimate: estimatePoints(f.type, f.start, f.end, settings), charged: 0, overflow: 0, fee: 0 },
      log: [{ at: now, text: `${resident ? "住戶" : "物業"}建立預約${f.consent ? "（已同意規範）" : ""}` }],
      createdAt: now,
      updatedAt: now,
    };
    await mutateCollection<Reservation, void>("reservations", (all) => void all.push(r));
    return Response.json(r, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
