import { parseAttendance, parseMeetingMeta, parsePlanRef } from "@/lib/mgmt-forms";
import type { Meeting, Todo } from "@/lib/mgmt";
import { deleteDocument, mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody, maxLen, notFound, str } from "@/lib/validate";

export async function GET(_req: Request, ctx: RouteContext<"/api/meetings/[id]">) {
  const { id } = await ctx.params;
  const m = (await readCollection<Meeting>("meetings")).find((x) => x.id === id);
  return m ? Response.json(m) : notFound("會議");
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/meetings/[id]">) {
  const { id } = await ctx.params;
  try {
    const body = await jsonBody(request);
    const meta = parseMeetingMeta(body);
    const mentions = Array.isArray(body.mentions)
      ? body.mentions.slice(0, 200).map((m: Record<string, unknown>) => ({
          ...parsePlanRef(m)!,
          id: typeof m.id === "string" ? m.id : crypto.randomUUID(),
          snippet: maxLen(str(m, "snippet"), 600, "原文片段") ?? "",
        }))
      : undefined;
    const meeting = await mutateCollection<Meeting, Meeting | null>("meetings", (all) => {
      const m = all.find((x) => x.id === id);
      const attendance = parseAttendance(body.attendance);
      if (m) Object.assign(m, meta, mentions && { mentions }, attendance && { attendance }, { updatedAt: new Date().toISOString() });
      return m ?? null;
    });
    return meeting ? Response.json(meeting) : notFound("會議");
  } catch (e) {
    return errorResponse(e);
  }
}

/** 刪除會議與原檔；相關待辦事項保留，只解除關聯 */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/meetings/[id]">) {
  const { id } = await ctx.params;
  const removed = await mutateCollection<Meeting, Meeting | null>("meetings", (all) => {
    const i = all.findIndex((x) => x.id === id);
    return i === -1 ? null : all.splice(i, 1)[0];
  });
  if (!removed) return notFound("會議");
  if (removed.file) await deleteDocument(removed.file.name);
  await mutateCollection<Todo, void>("todos", (all) => {
    for (const t of all) if (t.meetingId === id) delete t.meetingId;
  });
  return new Response(null, { status: 204 });
}
