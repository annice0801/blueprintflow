import { requestUser } from "@/lib/auth";
import { changeHousehold } from "@/lib/household-server";
import { errorResponse, jsonBody } from "@/lib/validate";

/** 住戶異動（過戶 / 換租 / 退租）：同步車輛、未繳帳單、系統帳號 */
export async function POST(request: Request, ctx: RouteContext<"/api/residents/[id]/change">) {
  const { id } = await ctx.params;
  try {
    const { buildingId, email } = requestUser(request);
    return Response.json(await changeHousehold(buildingId, id, await jsonBody(request), email ?? ""));
  } catch (e) {
    return errorResponse(e);
  }
}
