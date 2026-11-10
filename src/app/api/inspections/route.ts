import { dataScope } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { parsePlan, plansOf } from "@/lib/inspection-forms";
import type { InspectionPlan } from "@/lib/inspections";
import { requireBuildingId } from "@/lib/mgmt-forms";
import { mutateCollection } from "@/lib/store";
import { defined, errorResponse, jsonBody } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const buildingId = dataScope(request);
  return Response.json(await plansOf(buildingId));
}

/** 新增自訂檢測項目 */
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const f = parsePlan(body, true);
    const plan: InspectionPlan = {
      id: crypto.randomUUID(),
      buildingId,
      name: f.name!,
      category: f.category ?? "設備",
      level: f.level ?? "建議",
      everyMonths: f.everyMonths ?? 12,
      basis: f.basis ?? "",
      authority: f.authority ?? "",
      how: f.how ?? "",
      note: f.note ?? "",
      enabled: true,
      dueOverride: f.dueOverride ?? "",
      vendor: f.vendor ?? "",
      records: [],
      updatedAt: new Date().toISOString(),
    };
    Object.assign(plan, defined({ enabled: f.enabled }));
    await mutateCollection<InspectionPlan, void>("inspections", (all) => void all.push(plan));
    return Response.json(plan, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
