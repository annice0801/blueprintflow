import { requestUser } from "@/lib/auth";
import { readHouseholds } from "@/lib/household-server";

/** 本社區戶籍名冊（含個資，需「住戶名冊」權限；查看會留紀錄） */
export async function GET(request: Request) {
  return Response.json(await readHouseholds(requestUser(request).buildingId), { headers: { "Cache-Control": "no-store" } });
}
