import type { Todo } from "@/lib/mgmt";
import type { CommunityEvent } from "@/lib/playbooks";
import { mutateCollection } from "@/lib/store";
import { notFound } from "@/lib/validate";

/** 刪除事件；?todos=1 一併刪除尚未完成的待辦（已完成的保留） */
export async function DELETE(request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  const withTodos = new URL(request.url).searchParams.get("todos") === "1";
  const ev = await mutateCollection<CommunityEvent, CommunityEvent | null>("events", (all) => {
    const i = all.findIndex((e) => e.id === id);
    return i === -1 ? null : all.splice(i, 1)[0];
  });
  if (!ev) return notFound("事件");
  const removed = await mutateCollection<Todo, string[]>("todos", (all) => {
    const gone: string[] = [];
    for (let i = all.length - 1; i >= 0; i--) {
      const t = all[i];
      if (t.eventId !== id) continue;
      if (withTodos && t.status !== "已完成") {
        gone.push(t.id);
        all.splice(i, 1);
      } else delete t.eventId;
    }
    for (const t of all) if (t.after && gone.includes(t.after)) delete t.after;
    return gone;
  });
  return Response.json({ removed });
}
