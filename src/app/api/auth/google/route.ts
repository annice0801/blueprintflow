import { NextResponse } from "next/server";
import { loginUser, sessionCookie, signSession, verifyGoogle } from "@/lib/auth";
import { overallStatus } from "@/lib/perms";
import { jsonBody, str } from "@/lib/validate";

/** Google 登入：驗證 ID token → 建立 / 更新使用者 → 設定 session cookie */
export async function POST(request: Request) {
  const body = await jsonBody(request).catch(() => ({}));
  const credential = str(body, "credential");
  if (!credential) return NextResponse.json({ error: "缺少 Google 登入憑證" }, { status: 400 });
  let g;
  try {
    g = await verifyGoogle(credential);
  } catch (e) {
    return NextResponse.json({ error: `Google 登入驗證失敗：${(e as Error).message}` }, { status: 401 });
  }
  // 從某社區頁面被導來登入 → 新帳號自動申請加入該社區
  const user = await loginUser(g, str(body, "community"));
  const res = NextResponse.json({ status: overallStatus(user) });
  res.cookies.set(sessionCookie(await signSession(user.email)));
  return res;
}
