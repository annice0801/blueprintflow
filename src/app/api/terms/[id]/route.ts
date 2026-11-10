import { parseTerm } from "@/lib/mgmt-forms";
import type { Term } from "@/lib/mgmt";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, notFound } from "@/lib/validate";

export async function PATCH(request: Request, ctx: RouteContext<"/api/terms/[id]">) {
  const { id } = await ctx.params;
  try {
    const f = parseTerm(await jsonBody(request), false);
    const term = await mutateCollection<Term, Term | null>("terms", (all) => {
      const t = all.find((x) => x.id === id);
      if (!t) return null;
      Object.assign(t, f, { updatedAt: new Date().toISOString() });
      if (f.companyId === "") delete t.companyId;
      return t;
    });
    return term ? Response.json(term) : notFound("屆次");
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/terms/[id]">) {
  const { id } = await ctx.params;
  const ok = await mutateCollection<Term, boolean>("terms", (all) => {
    const i = all.findIndex((x) => x.id === id);
    if (i !== -1) all.splice(i, 1);
    return i !== -1;
  });
  return ok ? new Response(null, { status: 204 }) : notFound("屆次");
}
