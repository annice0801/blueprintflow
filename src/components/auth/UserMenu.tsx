"use client";

import Link from "next/link";
import { useState } from "react";
import { roleLabel, STATUS_LABEL } from "@/lib/perms";
import { useMe } from "./AuthProvider";

/** 右上角帳號選單：目前社區身分、切換社區、後台入口、登出 */
export default function UserMenu() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  if (!me) return null;
  const { user, communities, adminOf, buildingId } = me;
  const current = communities.find((c) => c.id === buildingId);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-cyan-500/30 py-0.5 pl-0.5 pr-2.5 hover:bg-cyan-400/10" aria-expanded={open}>
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.picture} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/30 text-xs">{(user.name || user.email)[0]}</span>
        )}
        <span className="hidden max-w-24 truncate text-xs text-cyan-100 sm:inline">{user.name || user.email}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-cyan-400/30 bg-[#06142a] p-3 text-sm shadow-xl" onMouseLeave={() => setOpen(false)}>
          <p className="truncate text-cyan-50">{user.name}</p>
          <p className="truncate text-xs text-slate-400">{user.email}</p>
          {current && (
            <p className="mt-1 text-xs text-cyan-300">
              {current.name} · {roleLabel(current.role)}
            </p>
          )}
          {communities.length > 1 && (
            <div className="mt-3 border-t border-cyan-500/20 pt-2">
              <p className="mb-1 text-[11px] text-slate-500">我的社區</p>
              {communities.map((c) => (
                <Link key={c.id} href={`/buildings/${c.id}`} className={`flex items-center gap-2 rounded px-2 py-1 hover:bg-cyan-400/10 ${c.id === buildingId ? "text-cyan-50" : "text-slate-300"}`}>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10px] text-slate-500">{c.status === "active" ? roleLabel(c.role) : STATUS_LABEL[c.status]}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-3 space-y-1 border-t border-cyan-500/20 pt-2">
            {adminOf.length > 0 && (
              <Link href={`/admin?c=${adminOf.includes(buildingId) ? buildingId : adminOf[0]}`} className="block rounded px-2 py-1 text-cyan-200 hover:bg-cyan-400/10">
                ⚙ 後台管理系統
              </Link>
            )}
            <button onClick={logout} className="block w-full rounded px-2 py-1 text-left text-slate-300 hover:bg-white/5">
              登出
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
