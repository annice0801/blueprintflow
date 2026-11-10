import type { NextRequest } from "next/server";
import { parseTodo, requireBuildingId } from "@/lib/mgmt-forms";
import type { Todo } from "@/lib/mgmt";
import { mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const buildingId = request.nextUrl.searchParams.get("buildingId");
  return Response.json((await readCollection<Todo>("todos")).filter((t) => !buildingId || t.buildingId === buildingId));
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const { location, ...f } = parseTodo(body, true);
    const now = new Date().toISOString();
    const todo: Todo = {
      id: crypto.randomUUID(),
      buildingId,
      title: f.title!,
      description: f.description ?? "",
      assignees: f.assignees!,
      status: f.status ?? "未開始",
      priority: f.priority ?? "中",
      start: f.start ?? now.slice(0, 10),
      due: f.due ?? "",
      ...(f.meetingId && { meetingId: f.meetingId }),
      ...(f.vendorId && { vendorId: f.vendorId }),
      ...(location && { location }),
      ...(f.after && { after: f.after, afterDays: f.afterDays ?? 7 }),
      log: [{ at: now, text: "建立" }],
      createdAt: now,
      updatedAt: now,
    };
    await mutateCollection<Todo, void>("todos", (all) => void all.push(todo));
    return Response.json(todo, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
