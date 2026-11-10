import { invalidateAuthCache, readUsers, requestUser } from "@/lib/auth";
import type { MemberRow, User } from "@/lib/perms";
import { mutateCollection } from "@/lib/store";
import { parseMemberPatch } from "@/lib/user-forms";
import { errorResponse, jsonBody, str, ValidationError } from "@/lib/validate";

/** 目前社區的成員（含待核准申請） */
export async function GET(request: Request) {
  const { buildingId } = requestUser(request);
  const rows: MemberRow[] = [];
  for (const { memberships, ...u } of await readUsers()) {
    const m = memberships.find((x) => x.buildingId === buildingId);
    if (m) rows.push({ ...u, membership: m });
  }
  return Response.json(rows);
}

/** 預先加入：指定信箱與身分，對方用該 Google 帳號登入即可使用本社區 */
export async function POST(request: Request) {
  try {
    const { buildingId } = requestUser(request);
    const body = await jsonBody(request);
    const email = (str(body, "email") ?? "").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError("請填寫正確的 Google 信箱");
    const f = parseMemberPatch(body);
    const now = new Date().toISOString();
    const row = await mutateCollection<User, MemberRow>("users", (all) => {
      let u = all.find((x) => x.id === email);
      if (!u) {
        u = { id: email, email, name: f.name ?? "", picture: "", superAdmin: false, memberships: [], createdAt: now, lastLoginAt: "" };
        all.push(u);
      }
      if (u.memberships.some((m) => m.buildingId === buildingId && m.status !== "pending")) throw new ValidationError("此信箱已是本社區成員");
      u.memberships = u.memberships.filter((m) => m.buildingId !== buildingId);
      const m = { buildingId, role: f.role ?? "resident", status: "active" as const, note: f.note ?? "", createdAt: now, ...(f.orgRole && { orgRole: f.orgRole }), ...(f.unitId && { unitId: f.unitId }) };
      u.memberships.push(m);
      const { memberships, ...rest } = u;
      void memberships;
      return { ...rest, membership: m };
    });
    invalidateAuthCache();
    return Response.json(row, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
