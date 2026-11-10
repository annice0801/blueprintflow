import { requestUser } from "@/lib/auth";
import { FEEDBACK_STATUS, type Feedback } from "@/lib/perms";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, maxLen, notFound, oneOf, str } from "@/lib/validate";

/** 管理員：改處理狀態、回覆回報者 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/feedback/[id]">) {
  const { id } = await ctx.params;
  try {
    const body = await jsonBody(request);
    const status = oneOf(str(body, "status"), FEEDBACK_STATUS, "狀態");
    const reply = maxLen(str(body, "reply"), 2000, "回覆");
    const { email, buildingId } = requestUser(request);
    const by = email ?? "";
    const fb = await mutateCollection<Feedback, Feedback | null>("feedback", (all) => {
      const f = all.find((x) => x.id === id && x.buildingId === buildingId);
      if (!f) return null;
      const now = new Date().toISOString();
      if (status && status !== f.status) f.history.push({ at: now, by, text: `狀態：${f.status} → ${status}` });
      if (reply !== undefined && reply !== f.reply) f.history.push({ at: now, by, text: `回覆：${reply}` });
      Object.assign(f, status && { status }, reply !== undefined && { reply }, { updatedAt: now });
      return f;
    });
    return fb ? Response.json(fb) : notFound("回報");
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/feedback/[id]">) {
  const { id } = await ctx.params;
  const { buildingId } = requestUser(request);
  const ok = await mutateCollection<Feedback, boolean>("feedback", (all) => {
    const i = all.findIndex((x) => x.id === id && x.buildingId === buildingId);
    if (i !== -1) all.splice(i, 1);
    return i !== -1;
  });
  return ok ? new Response(null, { status: 204 }) : notFound("回報");
}
