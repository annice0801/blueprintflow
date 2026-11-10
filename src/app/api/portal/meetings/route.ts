import { requestUser } from "@/lib/auth";
import { portalMeetings } from "@/lib/portal";

export async function GET(request: Request) {
  return Response.json(await portalMeetings(requestUser(request).buildingId));
}
