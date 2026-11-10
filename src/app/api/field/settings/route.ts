import type { NextRequest } from "next/server";
import { getSettings, saveSettings } from "@/lib/field-server";
import { RES_TYPES, type FieldSettings, type ResTypeSetting } from "@/lib/field";
import { requireBuildingId } from "@/lib/mgmt-forms";
import { errorResponse, jsonBody, ValidationError } from "@/lib/validate";

export async function GET(request: NextRequest) {
  return Response.json(await getSettings(request.nextUrl.searchParams.get("buildingId") ?? "blueprint"));
}

const HM = /^\d{2}:\d{2}$/;
const num = (v: unknown, min: number, max: number, label: string) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new ValidationError(`${label}需介於 ${min}–${max}`);
  return n;
};

export async function PUT(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const patch: Partial<FieldSettings> = {};
    if (body.pointPerPing !== undefined) patch.pointPerPing = num(body.pointPerPing, 0, 10, "每坪點數");
    if (body.pointPeriod !== undefined) patch.pointPeriod = body.pointPeriod === "季" ? "季" : "月";
    if (body.feePerPoint !== undefined) patch.feePerPoint = num(body.feePerPoint, 0, 10000, "每點金額");
    if (body.noShowPenalty !== undefined) patch.noShowPenalty = num(body.noShowPenalty, 0, 100, "未到扣點");
    if (body.visitorRetentionDays !== undefined) patch.visitorRetentionDays = num(body.visitorRetentionDays, 7, 3650, "訪客保存天數");
    if (body.types && typeof body.types === "object") {
      const types = {} as FieldSettings["types"];
      for (const t of RES_TYPES) {
        const v = (body.types as Record<string, Partial<ResTypeSetting>>)[t];
        if (!v) continue;
        if ((v.openFrom && !HM.test(v.openFrom)) || (v.openTo && !HM.test(v.openTo))) throw new ValidationError("開放時間格式不正確");
        types[t] = {
          enabled: !!v.enabled,
          needApproval: !!v.needApproval,
          openFrom: v.openFrom ?? "08:00",
          openTo: v.openTo ?? "21:00",
          weekdaysOnly: !!v.weekdaysOnly,
          maxHours: num(v.maxHours, 0.5, 24, "最長時數"),
          capacity: num(v.capacity, 1, 100, "同時段組數"),
          pointsPerHour: num(v.pointsPerHour, 0, 100, "每小時點數"),
          deposit: String(v.deposit ?? "").slice(0, 200),
          rules: String(v.rules ?? "").slice(0, 5000),
          regulationId: String(v.regulationId ?? "").slice(0, 64),
        };
      }
      patch.types = types;
    }
    if (Array.isArray(body.shiftCodes))
      patch.shiftCodes = body.shiftCodes.slice(0, 30).flatMap((c: Record<string, unknown>) => {
        const code = String(c.code ?? "").trim().slice(0, 4);
        const start = String(c.start ?? "");
        const end = String(c.end ?? "");
        if (!code) return [];
        if (!HM.test(start) || !HM.test(end)) throw new ValidationError(`班別「${code}」時間格式不正確`);
        return [{ code, label: String(c.label ?? code).slice(0, 20), start, end, ...(c.off ? { off: true } : {}) }];
      });
    if (Array.isArray(body.postingSpots))
      patch.postingSpots = body.postingSpots.slice(0, 50).map((s: Record<string, unknown>) => ({
        id: String(s.id ?? crypto.randomUUID()).slice(0, 64),
        label: String(s.label ?? "").slice(0, 40),
        ...(s.location ? { location: s.location as FieldSettings["postingSpots"][number]["location"] } : {}),
      }));
    return Response.json(await saveSettings(buildingId, patch));
  } catch (e) {
    return errorResponse(e);
  }
}
