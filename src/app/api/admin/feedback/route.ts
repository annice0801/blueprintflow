import { requestUser } from "@/lib/auth";
import type { Feedback } from "@/lib/perms";
import { readCollection } from "@/lib/store";

/** 本社區的意見回報 */
export async function GET(request: Request) {
  const { buildingId } = requestUser(request);
  return Response.json((await readCollection<Feedback>("feedback")).filter((f) => f.buildingId === buildingId).reverse());
}
