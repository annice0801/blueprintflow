import { releaseDependents } from "@/lib/event-server";
import { parseTodo } from "@/lib/mgmt-forms";
import { roleOf, type Todo } from "@/lib/mgmt";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, maxLen, notFound, str } from "@/lib/validate";

export async function PATCH(request: Request, ctx: RouteContext<"/api/todos/[id]">) {
  const { id } = await ctx.params;
  try {
    const body = await jsonBody(request);
    const { location, ...f } = parseTodo(body, false);
    const note = maxLen(str(body, "logNote"), 1000, "追蹤紀錄");
    let released: Todo[] = [];
    const todo = await mutateCollection<Todo, Todo | null>("todos", (all) => {
      const t = all.find((x) => x.id === id);
      if (!t) return null;
      const now = new Date().toISOString();
      if (f.status === "已完成" && t.status !== "已完成") released = releaseDependents(all, t.id, now.slice(0, 10), now);
      // 狀態、追蹤者變更自動寫入追蹤紀錄
      if (f.status && f.status !== t.status) t.log.push({ at: now, text: `狀態：${t.status} → ${f.status}` });
      if (f.assignees && f.assignees.join() !== t.assignees.join())
        t.log.push({ at: now, text: `追蹤者：${f.assignees.map((r) => roleOf(r).short).join("、")}` });
      if (note) t.log.push({ at: now, text: note });
      Object.assign(t, f, { updatedAt: now });
      if (location === null) delete t.location;
      else if (location) t.location = location;
      if (f.vendorId === "") delete t.vendorId;
      if (f.after === "" || f.after === t.id) delete t.after;
      return t;
    });
    // released：因本項完成而自動開始的下一步
    return todo ? Response.json({ ...todo, released }) : notFound("待辦事項");
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/todos/[id]">) {
  const { id } = await ctx.params;
  const ok = await mutateCollection<Todo, boolean>("todos", (all) => {
    const i = all.findIndex((x) => x.id === id);
    if (i === -1) return false;
    all.splice(i, 1);
    for (const t of all) if (t.after === id) delete t.after; // 下一步不再等待
    return true;
  });
  return ok ? new Response(null, { status: 204 }) : notFound("待辦事項");
}
