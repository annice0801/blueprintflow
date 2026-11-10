import { parseGateLog } from "@/lib/record-forms";
import type { GateLog } from "@/lib/records";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, notFound } from "@/lib/validate";

export async function PATCH(request: Request, ctx: RouteContext<"/api/gate-logs/[id]">) {
  const { id } = await ctx.params;
  try {
    const fields = parseGateLog(await jsonBody(request), false);
    const log = await mutateCollection<GateLog, GateLog | null>("gate-logs", (all) => {
      const l = all.find((x) => x.id === id);
      if (l) Object.assign(l, fields, { updatedAt: new Date().toISOString() });
      return l ?? null;
    });
    return log ? Response.json(log) : notFound("紀錄");
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/gate-logs/[id]">) {
  const { id } = await ctx.params;
  const ok = await mutateCollection<GateLog, boolean>("gate-logs", (all) => {
    const idx = all.findIndex((x) => x.id === id);
    if (idx !== -1) all.splice(idx, 1);
    return idx !== -1;
  });
  return ok ? new Response(null, { status: 204 }) : notFound("紀錄");
}
