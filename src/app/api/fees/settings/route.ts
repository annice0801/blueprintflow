import { requestUser } from "@/lib/auth";
import { saveSettings } from "@/lib/field-server";
import { feeSettings } from "@/lib/household-server";
import { errorResponse, jsonBody, num, ValidationError } from "@/lib/validate";

export async function GET(request: Request) {
  return Response.json(await feeSettings(requestUser(request).buildingId));
}

/** 管理費費率：每坪單價、各類車位月費、繳費期限日 */
export async function PUT(request: Request) {
  try {
    const { buildingId } = requestUser(request);
    const body = await jsonBody(request);
    const n = (k: string, label: string, max: number) => {
      const v = num(body[k] === undefined ? undefined : String(body[k]), label);
      if (v === undefined || v < 0 || v > max) throw new ValidationError(`${label}需介於 0–${max}`);
      return v;
    };
    const fee = { perPing: n("perPing", "每坪單價", 10000), car: n("car", "汽車位月費", 100000), moto: n("moto", "機車位月費", 100000), bike: n("bike", "腳踏車位月費", 100000), dueDay: Math.round(n("dueDay", "繳費期限日", 28)) };
    await saveSettings(buildingId, { fee });
    return Response.json(fee);
  } catch (e) {
    return errorResponse(e);
  }
}
