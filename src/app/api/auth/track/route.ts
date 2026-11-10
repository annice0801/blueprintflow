import { requestUser } from "@/lib/auth";
import { areaOf, buildingOfPath } from "@/lib/perms";
import { insertDoc } from "@/lib/store";

/** 使用紀錄：前端每次開頁 / 切換分頁送一筆（sendBeacon） */
export async function POST(request: Request) {
  const { email, buildingId } = requestUser(request);
  const { path = "", search = "" } = (await request.json().catch(() => ({}))) as { path?: string; search?: string };
  const area = areaOf(String(path).slice(0, 200), String(search).slice(0, 300));
  if (email && area) await insertDoc("usage", { id: crypto.randomUUID(), at: new Date(), email, path: `${path}${search}`.slice(0, 300), area, buildingId: buildingOfPath(String(path)) || buildingId }).catch(() => {});
  return new Response(null, { status: 204 });
}
