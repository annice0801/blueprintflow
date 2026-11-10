import { parseVendor } from "@/lib/mgmt-forms";
import type { Todo, Vendor } from "@/lib/mgmt";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, notFound } from "@/lib/validate";

export async function PATCH(request: Request, ctx: RouteContext<"/api/vendors/[id]">) {
  const { id } = await ctx.params;
  try {
    const f = parseVendor(await jsonBody(request), false);
    const vendor = await mutateCollection<Vendor, Vendor | null>("vendors", (all) => {
      const v = all.find((x) => x.id === id);
      if (v) Object.assign(v, f, { updatedAt: new Date().toISOString() });
      return v ?? null;
    });
    return vendor ? Response.json(vendor) : notFound("廠商");
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/vendors/[id]">) {
  const { id } = await ctx.params;
  const ok = await mutateCollection<Vendor, boolean>("vendors", (all) => {
    const i = all.findIndex((x) => x.id === id);
    if (i !== -1) all.splice(i, 1);
    return i !== -1;
  });
  if (ok) {
    await mutateCollection<Todo, void>("todos", (all) => {
      for (const t of all) if (t.vendorId === id) delete t.vendorId;
    });
    // 建商刪除後，其配合廠商改為未指定建商
    await mutateCollection<Vendor, void>("vendors", (all) => {
      for (const v of all) if (v.builderId === id) v.builderId = "";
    });
  }
  return ok ? new Response(null, { status: 204 }) : notFound("廠商");
}
