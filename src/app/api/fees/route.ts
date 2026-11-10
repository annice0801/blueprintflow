import type { NextRequest } from "next/server";
import { requestUser } from "@/lib/auth";
import { getBuilding, residentUnits } from "@/lib/buildings";
import { feeSettings, readHouseholds } from "@/lib/household-server";
import { monthlyFee, payerOf, statusOf, type FeeBill } from "@/lib/households";
import { mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody, str, ValidationError } from "@/lib/validate";

/** 帳單：?period=YYYY-MM 某月；?unitId= 某戶全部；都不帶 = 全部 */
export async function GET(request: NextRequest) {
  const { buildingId } = requestUser(request);
  const q = request.nextUrl.searchParams;
  const period = q.get("period");
  const unitId = q.get("unitId");
  return Response.json(
    (await readCollection<FeeBill>("fees")).filter((b) => b.buildingId === buildingId && (!period || b.period === period) && (!unitId || b.unitId === unitId)),
  );
}

/** 產生某月帳單：依目前坪數、車位與繳費人；已開過的戶別不重複開（可帶 overwrite 重算未繳帳單金額） */
export async function POST(request: Request) {
  try {
    const { buildingId } = requestUser(request);
    const body = await jsonBody(request);
    const period = str(body, "period") ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new ValidationError("請選擇月份");
    const b = getBuilding(buildingId);
    if (!b) throw new ValidationError("找不到社區");
    const [s, households] = await Promise.all([feeSettings(buildingId), readHouseholds(buildingId)]);
    const hMap = new Map(households.map((h) => [h.id, h]));
    const now = new Date().toISOString();
    const res = await mutateCollection<FeeBill, { created: number; updated: number }>("fees", (all) => {
      let created = 0;
      let updated = 0;
      for (const u of residentUnits(b)) {
        const h = hMap.get(u.id);
        const amount = monthlyFee(u.id, h, s);
        const { role, name } = payerOf(h);
        const id = `${u.id}:${period}`;
        const cur = all.find((x) => x.id === id && x.buildingId === buildingId);
        if (cur) {
          if (body.overwrite === true && cur.status !== "已繳") {
            Object.assign(cur, { amount, payerRole: role, payerName: name, status: statusOf(amount, cur.paid), updatedAt: now });
            updated++;
          }
          continue;
        }
        all.push({ id, buildingId, unitId: u.id, period, amount, paid: 0, status: statusOf(amount, 0), payerRole: role, payerName: name, paidAt: "", method: "", note: "", createdAt: now, updatedAt: now });
        created++;
      }
      return { created, updated };
    });
    return Response.json(res, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
