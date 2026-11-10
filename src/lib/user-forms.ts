import "server-only";
import { ROLE_IDS, type RoleId } from "./mgmt";
import { SYS_ROLES, USER_STATUS, type SysRole, type UserStatus } from "./perms";
import { maxLen, oneOf, str, ValidationError } from "./validate";

type Src = Record<string, unknown>;

/** 社區成員資料：身分、狀態、組織職務、戶別、備註；姓名為帳號共用 */
export function parseMemberPatch(src: Src) {
  const orgRole = str(src, "orgRole");
  if (orgRole && !ROLE_IDS.includes(orgRole as RoleId)) throw new ValidationError("組織職務不正確");
  return Object.fromEntries(
    Object.entries({
      role: oneOf(str(src, "role"), SYS_ROLES.map((r) => r.id), "身分") as SysRole | undefined,
      status: oneOf(str(src, "status"), USER_STATUS, "狀態") as UserStatus | undefined,
      name: maxLen(str(src, "name"), 40, "姓名"),
      orgRole: orgRole as RoleId | "" | undefined,
      unitId: maxLen(str(src, "unitId"), 30, "戶別"),
      note: maxLen(str(src, "note"), 300, "備註"),
    }).filter(([, v]) => v !== undefined),
  ) as { role?: SysRole; status?: UserStatus; name?: string; orgRole?: RoleId | ""; unitId?: string; note?: string };
}
