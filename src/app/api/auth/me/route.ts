import { adminCommunities, communitiesOf, getUser, permsOf, requestUser } from "@/lib/auth";
import type { Me } from "@/lib/perms";

/** 目前登入者、在目前社區（proxy 判定）的權限、可進入與可管理的社區 */
export async function GET(request: Request) {
  const { email, buildingId } = requestUser(request);
  const user = email ? await getUser(email) : null;
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });
  return Response.json({ user, buildingId, perms: await permsOf(user, buildingId), communities: communitiesOf(user), adminOf: await adminCommunities(user) } satisfies Me);
}
