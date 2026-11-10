import { invalidateAuthCache, requestUser, rolePerms } from "@/lib/auth";
import { LEVELS, MODULES, SYS_ROLES, type Level, type RolePerms, type SysRole } from "@/lib/perms";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, ValidationError } from "@/lib/validate";

/** 目前社區各身分的權限表 */
export async function GET(request: Request) {
  return Response.json(await rolePerms(requestUser(request).buildingId));
}

/** 修改本社區某身分的權限：{ role, perms: { 模組: none|view|edit } } */
export async function PUT(request: Request) {
  try {
    const { buildingId } = requestUser(request);
    const body = await jsonBody(request);
    const role = body.role as SysRole;
    if (!SYS_ROLES.some((r) => r.id === role)) throw new ValidationError("無法修改此身分");
    const input = (body.perms ?? {}) as Record<string, unknown>;
    const perms = Object.fromEntries(MODULES.map((m) => [m.id, LEVELS.includes(input[m.id] as Level) ? input[m.id] : "none"])) as RolePerms["perms"];
    if (role === "admin" && perms.admin !== "edit") throw new ValidationError("社區管理員必須保有系統管理的編輯權限");
    const id = `${buildingId}:${role}`;
    await mutateCollection<RolePerms, void>("roles", (all) => {
      const r = all.find((x) => x.id === id);
      if (r) Object.assign(r, { perms, updatedAt: new Date().toISOString() });
      else all.push({ id, buildingId, role, perms, updatedAt: new Date().toISOString() });
    });
    invalidateAuthCache();
    return Response.json(await rolePerms(buildingId));
  } catch (e) {
    return errorResponse(e);
  }
}
