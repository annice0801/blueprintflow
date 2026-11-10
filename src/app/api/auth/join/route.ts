import { requestJoin, requestUser } from "@/lib/auth";
import { jsonBody, str } from "@/lib/validate";

/** 申請加入社區 */
export async function POST(request: Request) {
  const { email } = requestUser(request);
  const buildingId = str(await jsonBody(request).catch(() => ({})), "buildingId") ?? "";
  if (!email) return Response.json({ error: "請先登入" }, { status: 401 });
  try {
    await requestJoin(email, buildingId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
