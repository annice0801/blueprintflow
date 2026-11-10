import { findOrCreate, parseInspectionRecord } from "@/lib/inspection-forms";
import type { InspectionPlan, InspectionRecord } from "@/lib/inspections";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, notFound } from "@/lib/validate";

/** 登記一次辦理結果；登記後改依辦理日推算下次期限 */
export async function POST(request: Request, ctx: RouteContext<"/api/inspections/[id]/records">) {
  const id = decodeURIComponent((await ctx.params).id);
  try {
    const f = parseInspectionRecord(await jsonBody(request));
    const plan = await mutateCollection<InspectionPlan, InspectionPlan | null>("inspections", (all) => {
      const p = findOrCreate(all, id);
      if (!p) return null;
      const rec: InspectionRecord = { id: crypto.randomUUID(), ...f, createdAt: new Date().toISOString() };
      p.records.push(rec);
      if (p.dueOverride && p.dueOverride <= f.date) p.dueOverride = "";
      if (f.vendor && !p.vendor) p.vendor = f.vendor;
      p.updatedAt = rec.createdAt;
      return p;
    });
    return plan ? Response.json(plan, { status: 201 }) : notFound("檢測項目");
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/inspections/[id]/records">) {
  const id = decodeURIComponent((await ctx.params).id);
  const recordId = new URL(request.url).searchParams.get("recordId");
  const plan = await mutateCollection<InspectionPlan, InspectionPlan | null>("inspections", (all) => {
    const p = all.find((x) => x.id === id);
    const i = p?.records.findIndex((r) => r.id === recordId) ?? -1;
    if (!p || i === -1) return null;
    p.records.splice(i, 1);
    p.updatedAt = new Date().toISOString();
    return p;
  });
  return plan ? Response.json(plan) : notFound("紀錄");
}
