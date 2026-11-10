"use client";

import { useEffect, useState } from "react";
import { STATUS_LABEL, type CommunitySummary, type Feedback, type MemberRow } from "@/lib/perms";
import { api } from "../ui";
import type { SectionId } from "./AdminConsole";
import { DailyBars, Stat, timeAgo } from "./charts";
import { useUsage } from "./UsagePanel";

export default function Overview({ users, feedback, go, superAdmin, onPick }: { users: MemberRow[]; feedback: Feedback[]; go: (s: SectionId) => void; superAdmin: boolean; onPick: (id: string) => void }) {
  const { data } = useUsage(30);
  const pending = users.filter((u) => u.membership.status === "pending");
  const fresh = feedback.filter((f) => f.status === "新回報" || f.status === "處理中");
  return (
    <div className="space-y-4">
      {superAdmin && <Communities onPick={onPick} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="社區成員" value={users.filter((u) => u.membership.status === "active").length} sub={`啟用中 · 共 ${users.length} 位`} />
        <Stat label="待核准帳號" value={<span className={pending.length ? "text-amber-300" : ""}>{pending.length}</span>} />
        <Stat label="待處理意見回報" value={<span className={fresh.length ? "text-amber-300" : ""}>{fresh.length}</span>} sub={`共 ${feedback.length} 則`} />
        <Stat label="近 7 天活躍使用者" value={data?.totals.active7 ?? "—"} sub={data ? `近 30 天 ${data.totals.activeUsers} 人` : ""} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-cyan-500/20 p-4">
          <div className="flex items-center">
            <h3 className="text-sm font-semibold text-cyan-50">近 30 天每日活躍人數</h3>
            <button onClick={() => go("usage")} className="ml-auto text-xs text-cyan-300 hover:underline">
              完整統計 →
            </button>
          </div>
          {data ? <DailyBars data={data.daily.map((d) => ({ date: d.date, value: d.users }))} unit="人" /> : <p className="py-10 text-center text-xs text-slate-500">統計中…</p>}
        </section>
        <div className="space-y-4">
          <section className="rounded-xl border border-cyan-500/20 p-4">
            <div className="mb-2 flex items-center">
              <h3 className="text-sm font-semibold text-cyan-50">待核准帳號</h3>
              <button onClick={() => go("users")} className="ml-auto text-xs text-cyan-300 hover:underline">
                前往核准 →
              </button>
            </div>
            {pending.length === 0 ? (
              <p className="text-xs text-slate-500">沒有待核准的帳號</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {pending.slice(0, 5).map((u) => (
                  <li key={u.id} className="flex gap-2">
                    <span className="truncate text-cyan-50">{u.name || u.email}</span>
                    <span className="truncate text-xs text-slate-500">{u.email}</span>
                    <span className="ml-auto shrink-0 text-xs text-amber-300">{STATUS_LABEL[u.membership.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-cyan-500/20 p-4">
            <div className="mb-2 flex items-center">
              <h3 className="text-sm font-semibold text-cyan-50">最新意見回報</h3>
              <button onClick={() => go("feedback")} className="ml-auto text-xs text-cyan-300 hover:underline">
                全部 →
              </button>
            </div>
            {fresh.length === 0 ? (
              <p className="text-xs text-slate-500">沒有待處理的回報</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {fresh.slice(0, 5).map((f) => (
                  <li key={f.id} className="flex gap-2">
                    <span className="shrink-0 text-xs text-slate-400">{f.type}</span>
                    <span className="truncate text-slate-200">{f.message}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-slate-500">{timeAgo(f.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** 系統擁有者：各社區比較 */
function Communities({ onPick }: { onPick: (id: string) => void }) {
  const [rows, setRows] = useState<CommunitySummary[] | null>(null);
  useEffect(() => {
    api<CommunitySummary[]>("/api/admin/communities").then(setRows, () => {});
  }, []);
  if (!rows) return null;
  return (
    <section className="rounded-xl border border-violet-400/30 bg-violet-500/[0.03]">
      <h3 className="px-4 pt-3 text-sm font-semibold text-cyan-50">各社區比較</h3>
      <p className="px-4 text-[11px] text-slate-500">系統擁有者才看得到；點社區名稱切換到該社區的後台</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-cyan-300">
            <tr className="border-b border-cyan-500/30">
              <th className="px-4 py-2">社區</th>
              <th className="px-3 py-2">成員</th>
              <th className="px-3 py-2">社區管理員</th>
              <th className="px-3 py-2">待核准</th>
              <th className="px-3 py-2">近 7 天活躍</th>
              <th className="px-3 py-2">近 30 天開頁</th>
              <th className="px-3 py-2">待處理回報</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-cyan-500/10">
                <td className="px-4 py-2">
                  <button onClick={() => onPick(r.id)} className="text-cyan-100 hover:underline">
                    {r.name}
                  </button>
                </td>
                <td className="px-3 py-2 font-mono text-slate-200">{r.members}</td>
                <td className={`px-3 py-2 font-mono ${r.admins ? "text-slate-200" : "text-amber-300"}`}>{r.admins || "尚未指定"}</td>
                <td className={`px-3 py-2 font-mono ${r.pending ? "text-amber-300" : "text-slate-200"}`}>{r.pending}</td>
                <td className="px-3 py-2 font-mono text-slate-200">{r.active7}</td>
                <td className="px-3 py-2 font-mono text-slate-200">{r.views30}</td>
                <td className={`px-3 py-2 font-mono ${r.openFeedback ? "text-amber-300" : "text-slate-200"}`}>{r.openFeedback}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
