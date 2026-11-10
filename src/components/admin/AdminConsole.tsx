"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { type Feedback, type MemberRow } from "@/lib/perms";
import { useMe } from "../auth/AuthProvider";
import { BUILDINGS } from "@/lib/buildings";
import FeePanel from "./FeePanel";
import RosterPanel from "./RosterPanel";
import UserMenu from "../auth/UserMenu";
import { api } from "../ui";
import { Audit, Roles, Users } from "./AccessPanels";
import FeedbackPanel from "./FeedbackPanel";
import Overview from "./Overview";
import SystemPanel from "./SystemPanel";
import UsagePanel from "./UsagePanel";

const SECTIONS = [
  { id: "overview", label: "總覽", icon: "📊" },
  { id: "usage", label: "使用統計", icon: "📈" },
  { id: "feedback", label: "意見回報", icon: "💬" },
  { id: "users", label: "帳號管理", icon: "👥" },
  { id: "residents", label: "住戶名冊", icon: "📇" },
  { id: "fees", label: "管理費", icon: "💰" },
  { id: "roles", label: "身分權限", icon: "🔐" },
  { id: "audit", label: "操作紀錄", icon: "🧾" },
  { id: "system", label: "系統狀態", icon: "🖥" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

/** 後台管理系統：使用統計、意見回報、帳號與權限、操作紀錄、系統狀態 */
export default function AdminConsole() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const s = (SECTIONS.some((x) => x.id === params.get("s")) ? params.get("s") : "overview") as SectionId;
  // 目前管理的社區（網址 ?c=）；只能選有管理權限的社區
  const options = (me?.communities ?? []).filter((x) => me?.adminOf.includes(x.id));
  const c = options.some((x) => x.id === params.get("c")) ? params.get("c")! : (options[0]?.id ?? "");
  const go = (id: SectionId, community = c) => router.replace(`${pathname}?c=${community}&s=${id}`, { scroll: false });
  useEffect(() => {
    if (c && params.get("c") !== c) router.replace(`${pathname}?c=${c}&s=${s}`, { scroll: false });
  }, [c, params, pathname, router, s]);
  const [users, setUsers] = useState<MemberRow[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const ready = !!c && params.get("c") === c; // 網址已帶社區，api() 才會送對的社區
  useEffect(() => {
    if (!ready) return;
    api<MemberRow[]>("/api/admin/users").then(setUsers, () => {});
    api<Feedback[]>("/api/admin/feedback").then(setFeedback, () => {});
  }, [ready, c]);
  const badge: Partial<Record<SectionId, number>> = {
    users: users.filter((u) => u.membership.status === "pending").length,
    feedback: feedback.filter((f) => f.status === "新回報").length,
  };

  return (
    <div className="flex h-dvh flex-col bg-[#020814] text-slate-200">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-cyan-500/20 bg-[#030c1d]/90 px-4">
        <Link href="/" className="font-mono text-sm font-bold tracking-[0.3em] text-cyan-300 hover:text-cyan-200">
          BLUEPRINTFLOW
        </Link>
        <span className="text-cyan-500/40">/</span>
        <h1 className="text-sm font-semibold text-cyan-50">後台管理系統</h1>
        <span className="text-cyan-500/40">/</span>
        {options.length > 1 ? (
          <select value={c} onChange={(e) => go(s, e.target.value)} className="rounded-md border border-cyan-500/40 bg-slate-950/60 px-2 py-1 text-sm text-cyan-50" aria-label="社區">
            {options.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-cyan-50">{options[0]?.name ?? ""}</span>
        )}
        {me?.user.superAdmin && <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-200">系統擁有者</span>}
        <div className="flex-1" />
        <Link href={`/buildings/${c}/manage`} className="whitespace-nowrap rounded-md border border-cyan-500/40 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-400/10">
          前往管理中心 →
        </Link>
        <UserMenu />
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-cyan-500/20 p-2 md:w-48 md:flex-col md:border-b-0 md:border-r">
          {SECTIONS.map((x) => (
            <button
              key={x.id}
              onClick={() => go(x.id)}
              aria-current={s === x.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${s === x.id ? "bg-cyan-400/15 text-cyan-50" : "text-slate-400 hover:bg-white/5 hover:text-cyan-200"}`}
            >
              <span>{x.icon}</span>
              <span className="flex-1">{x.label}</span>
              {!!badge[x.id] && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-slate-950">{badge[x.id]}</span>}
            </button>
          ))}
        </nav>
        <main key={c} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {!ready ? (
            <p className="text-sm text-slate-400">載入中…</p>
          ) : (
            <>
              {s === "overview" && <Overview users={users} feedback={feedback} go={go} superAdmin={!!me?.user.superAdmin} onPick={(id) => go("overview", id)} />}
              {s === "usage" && <UsagePanel />}
              {s === "feedback" && <FeedbackPanel items={feedback} setItems={setFeedback} users={users} />}
              {s === "users" && <Users users={users} setUsers={setUsers} />}
              {s === "residents" && BUILDINGS.find((b) => b.id === c) && <RosterPanel building={BUILDINGS.find((b) => b.id === c)!} />}
              {s === "fees" && BUILDINGS.find((b) => b.id === c) && <FeePanel building={BUILDINGS.find((b) => b.id === c)!} />}
              {s === "roles" && <Roles />}
              {s === "audit" && <Audit users={users} />}
              {s === "system" && <SystemPanel />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
