import { findOrCreate, parsePlan } from "@/lib/inspection-forms";
import type { InspectionPlan } from "@/lib/inspections";
import { mutateCollection } from "@/lib/store";
import { defined, errorResponse, jsonBody, notFound } from "@/lib/validate";

export async function PATCH(request: Request, ctx: RouteContext<"/api/inspections/[id]">) {
  const { id } = await ctx.params;
  try {
    const f = parsePlan(await jsonBody(request), false);
    const plan = await mutateCollection<InspectionPlan, InspectionPlan | null>("inspections", (all) => {
      const p = findOrCreate(all, decodeURIComponent(id));
      if (!p) return null;
      Object.assign(p, defined(f), { updatedAt: new Date().toISOString() });
      return p;
    });
    return plan ? Response.json(plan) : notFound("檢測項目");
  } catch (e) {
    return errorResponse(e);
  }
}

/** 自訂項目刪除；預設項目刪除後還原為預設值（歷次紀錄一併清除，僅想略過請改用停用） */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/inspections/[id]">) {
  const id = decodeURIComponent((await ctx.params).id);
  const removed = await mutateCollection<InspectionPlan, InspectionPlan | null>("inspections", (all) => {
    const i = all.findIndex((p) => p.id === id);
    return i === -1 ? null : all.splice(i, 1)[0];
  });
  return removed ? new Response(null, { status: 204 }) : notFound("檢測項目");
}
