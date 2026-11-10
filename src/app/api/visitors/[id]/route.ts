import { localNow } from "@/lib/field-server";
import type { Visitor } from "@/lib/field";
import { mutateCollection } from "@/lib/store";
import { jsonBody, notFound, str } from "@/lib/validate";

/** 登記離開（未帶 outAt 時用現在時間） */
export async function PATCH(request: Request, ctx: RouteContext<"/api/visitors/[id]">) {
  const { id } = await ctx.params;
  const body = await jsonBody(request).catch(() => ({}));
  const v = await mutateCollection<Visitor, Visitor | null>("visitors", (all) => {
    const x = all.find((y) => y.id === id);
    if (x) x.outAt = str(body, "outAt") || localNow();
    return x ?? null;
  });
  return v ? Response.json(v) : notFound("訪客");
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/visitors/[id]">) {
  const { id } = await ctx.params;
  const ok = await mutateCollection<Visitor, boolean>("visitors", (all) => {
    const i = all.findIndex((x) => x.id === id);
    if (i !== -1) all.splice(i, 1);
    return i !== -1;
  });
  return ok ? new Response(null, { status: 204 }) : notFound("訪客");
}
