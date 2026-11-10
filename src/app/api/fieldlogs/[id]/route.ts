import type { FieldLog } from "@/lib/field";
import { deletePhoto, mutateCollection } from "@/lib/store";
import { jsonBody, notFound, str } from "@/lib/validate";

/** 記錄已轉成的問題注記 / 待辦 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/fieldlogs/[id]">) {
  const { id } = await ctx.params;
  const body = await jsonBody(request);
  const log = await mutateCollection<FieldLog, FieldLog | null>("fieldlogs", (all) => {
    const l = all.find((x) => x.id === id);
    if (!l) return null;
    if (str(body, "issueId")) l.issueId = str(body, "issueId");
    if (str(body, "todoId")) l.todoId = str(body, "todoId");
    return l;
  });
  return log ? Response.json(log) : notFound("紀錄");
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/fieldlogs/[id]">) {
  const { id } = await ctx.params;
  const removed = await mutateCollection<FieldLog, FieldLog | null>("fieldlogs", (all) => {
    const i = all.findIndex((x) => x.id === id);
    return i === -1 ? null : all.splice(i, 1)[0];
  });
  if (!removed) return notFound("紀錄");
  await Promise.all(removed.photos.map(deletePhoto));
  return new Response(null, { status: 204 });
}
