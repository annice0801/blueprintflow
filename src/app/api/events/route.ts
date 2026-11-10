import { dataScope } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { createEvent } from "@/lib/event-server";
import { requireBuildingId } from "@/lib/mgmt-forms";
import type { CommunityEvent } from "@/lib/playbooks";
import { readCollection } from "@/lib/store";
import { dateStr, errorResponse, jsonBody, maxLen, str, ValidationError } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const buildingId = dataScope(request);
  return Response.json((await readCollection<CommunityEvent>("events")).filter((e) => !buildingId || e.buildingId === buildingId));
}

/** 套用情境範本：建立事件與各職責待辦 */
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const date = dateStr(str(body, "date"), "日期");
    if (!date) throw new ValidationError("請填寫日期");
    const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string").slice(0, 50) : undefined;
    const res = await createEvent({
      buildingId,
      playbookId: str(body, "playbookId") ?? "",
      name: maxLen(str(body, "name"), 60, "名稱") ?? "",
      date: date.slice(0, 10),
      note: maxLen(str(body, "note"), 1000, "備註") ?? "",
      keys,
      meetingId: str(body, "meetingId") || undefined,
    });
    return Response.json(res, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
