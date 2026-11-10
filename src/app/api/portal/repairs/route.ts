import type { NextRequest } from "next/server";
import { requestUser } from "@/lib/auth";
import { BUILDINGS } from "@/lib/buildings";
import { CATEGORIES, type Issue } from "@/lib/issues";
import { myRepairs, portalRepairs } from "@/lib/portal";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, maxLen, num, oneOf, str, ValidationError } from "@/lib/validate";

/** 目前維修中（公共區域）；?mine=1 為自己送出的報修與處理狀態 */
export async function GET(request: NextRequest) {
  const { email, buildingId } = requestUser(request);
  if (request.nextUrl.searchParams.get("mine")) return Response.json(await myRepairs(buildingId, email ?? ""));
  return Response.json(await portalRepairs(buildingId));
}

/** 住戶報修：建立問題注記（待處理），由物業在平面圖 / 問題清單處理 */
export async function POST(request: Request) {
  try {
    const { email, buildingId } = requestUser(request);
    const b = BUILDINGS.find((x) => x.id === buildingId);
    if (!b || !email) throw new ValidationError("找不到社區");
    const body = await jsonBody(request);
    const title = maxLen(str(body, "title"), 80, "標題");
    if (!title) throw new ValidationError("請填寫報修項目");
    const floor = str(body, "floor") ?? "";
    const tower = str(body, "tower") as Issue["tower"];
    const f = b.floors.find((x) => x.id === floor);
    if (!f || !(f.towers as string[]).includes(tower)) throw new ValidationError("請在平面圖上點選位置");
    const photos = Array.isArray(body.photos) ? body.photos.filter((p): p is string => typeof p === "string" && /^[\w-]+\.(jpg|png|webp|gif|heic)$/.test(p)).slice(0, 5) : [];
    const now = new Date().toISOString();
    const issue: Issue = {
      id: crypto.randomUUID(),
      buildingId,
      tower,
      floor,
      zone: maxLen(str(body, "zone"), 40, "位置") ?? "",
      x: num(String(body.x ?? ""), "位置") ?? 0,
      y: num(String(body.y ?? ""), "位置") ?? 0,
      title,
      description: maxLen(str(body, "description"), 2000, "說明") ?? "",
      category: oneOf(str(body, "category"), CATEGORIES, "類別") ?? "其他",
      severity: "中",
      status: "待處理",
      photos,
      reporter: email,
      createdAt: now,
      updatedAt: now,
    };
    await mutateCollection<Issue, void>("issues", (all) => void all.push(issue));
    return Response.json({ id: issue.id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
