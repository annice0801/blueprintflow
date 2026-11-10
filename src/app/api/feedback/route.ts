import { getUser, requestUser } from "@/lib/auth";
import { FEEDBACK_TYPES, type Feedback } from "@/lib/perms";
import { mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody, maxLen, oneOf, str, ValidationError } from "@/lib/validate";

/** 我的意見回報（含管理員回覆與處理狀態） */
export async function GET(request: Request) {
  const { email } = requestUser(request);
  return Response.json((await readCollection<Feedback>("feedback")).filter((f) => f.email === email).reverse());
}

export async function POST(request: Request) {
  try {
    const { email, buildingId } = requestUser(request);
    const user = email ? await getUser(email) : null;
    if (!user) throw new ValidationError("請先登入");
    const body = await jsonBody(request);
    const message = maxLen(str(body, "message"), 3000, "內容");
    if (!message) throw new ValidationError("請填寫內容");
    const photos = Array.isArray(body.photos) ? body.photos.filter((p): p is string => typeof p === "string" && /^[\w-]+\.(jpg|png|webp|gif|heic)$/.test(p)).slice(0, 5) : [];
    const now = new Date().toISOString();
    const fb: Feedback = {
      id: crypto.randomUUID(),
      buildingId,
      email: user.email,
      name: user.name,
      type: oneOf(str(body, "type"), FEEDBACK_TYPES, "類型") ?? "其他",
      message,
      page: maxLen(str(body, "page"), 300, "頁面") ?? "",
      photos,
      userAgent: (request.headers.get("user-agent") ?? "").slice(0, 300),
      status: "新回報",
      reply: "",
      history: [{ at: now, by: user.email, text: "送出回報" }],
      createdAt: now,
      updatedAt: now,
    };
    await mutateCollection<Feedback, void>("feedback", (all) => void all.push(fb));
    return Response.json(fb, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
