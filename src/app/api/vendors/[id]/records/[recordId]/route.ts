import { parseRecord } from "@/lib/mgmt-forms";
import type { Vendor } from "@/lib/mgmt";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, notFound } from "@/lib/validate";

type Ctx = RouteContext<"/api/vendors/[id]/records/[recordId]">;

export async function PATCH(request: Request, ctx: Ctx) {
  const { id, recordId } = await ctx.params;
  try {
    const f = parseRecord(await jsonBody(request));
    const v = await mutateCollection<Vendor, Vendor | null>("vendors", (all) => {
      const x = all.find((c) => c.id === id);
      const r = x?.records?.find((y) => y.id === recordId);
      if (!x || !r) return null;
      if (!f.location) delete r.location;
      Object.assign(r, f);
      x.updatedAt = new Date().toISOString();
      return x;
    });
    return v ? Response.json(v) : notFound("紀錄");
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, recordId } = await ctx.params;
  const v = await mutateCollection<Vendor, Vendor | null>("vendors", (all) => {
    const x = all.find((c) => c.id === id);
    const i = x?.records?.findIndex((y) => y.id === recordId) ?? -1;
    if (!x || i === -1) return null;
    x.records.splice(i, 1);
    x.updatedAt = new Date().toISOString();
    return x;
  });
  return v ? Response.json(v) : notFound("紀錄");
}
