"use client";

import { useMe } from "./AuthProvider";

/** 只顯示自己有加入（已核准）的社區；身分載入前先顯示 */
export default function MemberOnly({ id, children }: { id: string; children: React.ReactNode }) {
  const me = useMe();
  if (me && !me.communities.some((c) => c.id === id && c.status === "active")) return null;
  return children;
}
