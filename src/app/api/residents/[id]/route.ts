import { requestUser } from "@/lib/auth";
import { updateHousehold } from "@/lib/household-server";
import { errorResponse, jsonBody } from "@/lib/validate";

/** 修改某戶：人員、車輛、車位、居住狀態、繳費人、特殊管理費 */
export async function PUT(request: Request, ctx: RouteContext<"/api/residents/[id]">) {
  const { id } = await ctx.params;
  try {
    const { buildingId, email } = requestUser(request);
    return Response.json(await updateHousehold(buildingId, id, await jsonBody(request), email ?? ""));
  } catch (e) {
    return errorResponse(e);
  }
}
