import { adminCommunities, communitiesOf, getUser, permsOf, requestUser } from "@/lib/auth";
import { realBuildingId } from "@/lib/buildings";
import { DEMO_PERMS, overallStatus, type Me } from "@/lib/perms";

/** 目前登入者、在目前社區（proxy 判定）的權限、可進入與可管理的社區；尚未核准的帳號為示範模式 */
export async function GET(request: Request) {
  const { email, buildingId } = requestUser(request);
  const user = email ? await getUser(email) : null;
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });
  const demo = overallStatus(user) === "pending";
  const real = realBuildingId(buildingId);
  return Response.json({
    user,
    buildingId: real,
    perms: demo ? DEMO_PERMS : await permsOf(user, real),
    communities: communitiesOf(user),
    adminOf: demo ? [] : await adminCommunities(user),
    demo,
  } satisfies Me);
}
