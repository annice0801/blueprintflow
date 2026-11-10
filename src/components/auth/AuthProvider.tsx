"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { buildingOfPath, can, type Level, type Me, type ModuleId } from "@/lib/perms";

const Ctx = createContext<{ me: Me | null; reload: () => void }>({ me: null, reload: () => {} });

/** 目前登入者與「目前社區」的權限；切換社區頁面時重新取得 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const building = buildingOfPath(path);
  const [me, setMe] = useState<Me | null>(null);
  const [tick, setTick] = useState(0);
  const onLogin = path === "/login";
  useEffect(() => {
    if (onLogin) return;
    fetch(`/api/auth/me${building ? `?buildingId=${building}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => {});
  }, [building, onLogin, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return <Ctx.Provider value={{ me, reload }}>{children}</Ctx.Provider>;
}

export const useMe = () => useContext(Ctx).me;
export const useReloadMe = () => useContext(Ctx).reload;

/** 前端顯示判斷用（真正的檢查在伺服器） */
export function useCan() {
  const me = useMe();
  return (m: ModuleId, need: Exclude<Level, "none"> = "view") => can(me?.perms, m, need);
}
