import { invalidateAuthCache, requestUser } from "@/lib/auth";
import type { MemberRow, User } from "@/lib/perms";
import { mutateCollection } from "@/lib/store";
import { parseMemberPatch } from "@/lib/user-forms";
import { errorResponse, jsonBody, notFound, ValidationError } from "@/lib/validate";

/** 修改本社區成員：不能改自己的身分與狀態（避免把自己鎖在外面），系統擁有者不受社區身分影響 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  const id = decodeURIComponent((await ctx.params).id);
  try {
    const { email: me, buildingId } = requestUser(request);
    const f = parseMemberPatch(await jsonBody(request));
    if (id === me && (f.role || f.status)) throw new ValidationError("不能修改自己的身分或狀態");
    const row = await mutateCollection<User, MemberRow | null>("users", (all) => {
      const u = all.find((x) => x.id === id);
      const m = u?.memberships.find((x) => x.buildingId === buildingId);
      if (!u || !m) return null;
      const { name, ...mf } = f;
      if (name !== undefined) u.name = name;
      Object.assign(m, mf);
      if (mf.orgRole === "") delete m.orgRole;
      if (mf.unitId === "") delete m.unitId;
      const { memberships, ...rest } = u;
      void memberships;
      return { ...rest, membership: m };
    });
    invalidateAuthCache();
    return row ? Response.json(row) : notFound("成員");
  } catch (e) {
    return errorResponse(e);
  }
}

/** 移出本社區（帳號保留，其他社區的身分不受影響） */
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  const id = decodeURIComponent((await ctx.params).id);
  try {
    const { email: me, buildingId } = requestUser(request);
    if (id === me) throw new ValidationError("不能把自己移出社區");
    const ok = await mutateCollection<User, boolean>("users", (all) => {
      const u = all.find((x) => x.id === id);
      if (!u) return false;
      const before = u.memberships.length;
      u.memberships = u.memberships.filter((m) => m.buildingId !== buildingId);
      return u.memberships.length < before;
    });
    invalidateAuthCache();
    return ok ? new Response(null, { status: 204 }) : notFound("成員");
  } catch (e) {
    return errorResponse(e);
  }
}
