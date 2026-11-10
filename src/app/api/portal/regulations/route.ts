import { requestUser } from "@/lib/auth";
import { portalRegulations } from "@/lib/portal";

export async function GET(request: Request) {
  return Response.json(await portalRegulations(requestUser(request).buildingId));
}
