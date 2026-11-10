import { requestUser } from "@/lib/auth";
import { portalAnnouncements } from "@/lib/portal";

export async function GET(request: Request) {
  return Response.json(await portalAnnouncements(requestUser(request).buildingId));
}
