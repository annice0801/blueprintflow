import type { NextRequest } from "next/server";
import { localNow } from "@/lib/field-server";
import { LOG_TYPES, type FieldLog } from "@/lib/field";
import { parsePlanRef, requireBuildingId } from "@/lib/mgmt-forms";
import { mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody, oneOf, str, ValidationError } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const buildingId = request.nextUrl.searchParams.get("buildingId") ?? "blueprint";
  return Response.json((await readCollection<FieldLog>("fieldlogs")).filter((l) => l.buildingId === buildingId).sort((a, b) => b.at.localeCompare(a.at)));
}

/** JSON：照片先經 /api/uploads 上傳，這裡只帶檔名 */
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const text = (str(body, "text") ?? "").slice(0, 2000);
    const photos = (Array.isArray(body.photos) ? body.photos : []).filter((p: unknown): p is string => typeof p === "string" && /^[\w-]+\.\w+$/.test(p)).slice(0, 12);
    if (!text && !photos.length) throw new ValidationError("請輸入文字或附上照片");
    const loc = parsePlanRef(body.location ?? undefined);
    const log: FieldLog = {
      id: crypto.randomUUID(),
      buildingId,
      type: oneOf(str(body, "type"), LOG_TYPES, "類型") ?? "其他",
      text,
      photos,
      ...(loc && { location: loc }),
      by: (str(body, "by") ?? "").slice(0, 40),
      at: str(body, "at") || localNow(),
      createdAt: new Date().toISOString(),
    };
    await mutateCollection<FieldLog, void>("fieldlogs", (all) => void all.push(log));
    return Response.json(log, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
