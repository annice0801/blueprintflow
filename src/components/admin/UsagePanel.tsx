"use client";

import { useEffect, useState } from "react";
import { AREA_LABEL, SYS_ROLES } from "@/lib/perms";
import { api } from "../ui";
import { DailyBars, Heatmap, HBars, Stat, timeAgo, type Usage } from "./charts";

const roleLabel = (r: string) => SYS_ROLES.find((x) => x.id === r)?.label ?? r;

export function useUsage(days: number) {
  const [data, setData] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Usage>(`/api/admin/usage?days=${days}`).then(setData, (e) => setError((e as Error).message));
  }, [days]);
  return { data, error };
}

/** 使用統計：活躍人數、開頁與操作次數、常用功能、使用時段、每位使用者頻率 */
export default function UsagePanel() {
  const [days, setDays] = useState(30);
  const { data, error } = useUsage(days);
  const [sort, setSort] = useState<"views" | "views7" | "activeDays" | "actions" | "lastAt">("views");
  if (error) return <p className="text-sm text-rose-300">{error}</p>;
  if (!data) return <p className="text-sm text-slate-400">統計中…</p>;
  const users = [...data.users].sort((a, b) => (sort === "lastAt" ? (b.lastAt ?? "").localeCompare(a.lastAt ?? "") : (b[sort] as number) - (a[sort] as number)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-cyan-50">使用統計</h2>
        <div className="flex-1" />
        <div className="flex overflow-hidden rounded-md border border-cyan-500/40 text-xs">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 ${days === d ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400"}`}>
              近 {d} 天
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`近 ${days} 天活躍使用者`} value={data.totals.activeUsers} sub={`帳號共 ${data.users.length} 個`} />
        <Stat label="近 7 天活躍使用者" value={data.totals.active7} />
        <Stat label="開啟頁面次數" value={data.totals.views} sub="含切換分頁" />
        <Stat label="新增 / 修改 / 刪除" value={data.totals.actions} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-cyan-500/20 p-4">
          <h3 className="text-sm font-semibold text-cyan-50">每日活躍人數</h3>
          <DailyBars data={data.daily.map((d) => ({ date: d.date, value: d.users }))} unit="人" />
        </section>
        <section className="rounded-xl border border-cyan-500/20 p-4">
          <h3 className="text-sm font-semibold text-cyan-50">每日開啟頁面次數</h3>
          <DailyBars data={data.daily.map((d) => ({ date: d.date, value: d.views }))} unit="次" />
        </section>
        <section className="rounded-xl border border-cyan-500/20 p-4">
          <h3 className="mb-3 text-sm font-semibold text-cyan-50">最常使用的功能</h3>
          {data.areas.length ? (
            <HBars rows={data.areas.map((a) => ({ label: AREA_LABEL[a.area] ?? a.area, value: a.views, sub: `${a.users} 人使用` }))} />
          ) : (
            <p className="text-xs text-slate-500">尚無資料</p>
          )}
        </section>
        <section className="rounded-xl border border-cyan-500/20 p-4">
          <h3 className="mb-3 text-sm font-semibold text-cyan-50">使用時段（開啟頁面次數）</h3>
          <Heatmap heat={data.heat} />
        </section>
      </div>
      <section className="rounded-xl border border-cyan-500/20">
        <h3 className="px-4 pt-3 text-sm font-semibold text-cyan-50">每位使用者使用頻率</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs text-cyan-300">
              <tr className="border-b border-cyan-500/30">
                <th className="px-4 py-2">使用者</th>
                <th className="px-3 py-2">身分</th>
                {(
                  [
                    ["views", `開頁（${days} 天）`],
                    ["views7", "開頁（7 天）"],
                    ["activeDays", "使用天數"],
                    ["actions", "編輯次數"],
                    ["lastAt", "最後使用"],
                  ] as const
                ).map(([k, l]) => (
                  <th key={k} className="px-3 py-2">
                    <button onClick={() => setSort(k)} className={sort === k ? "text-cyan-50" : "hover:text-cyan-100"}>
                      {l}
                      {sort === k && " ▾"}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2">常用功能</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email} className="border-b border-cyan-500/10">
                  <td className="px-4 py-2">
                    <p className="text-cyan-50">{u.name || u.email}</p>
                    <p className="text-[11px] text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{roleLabel(u.role)}</td>
                  <td className="px-3 py-2 font-mono text-slate-200">{u.views}</td>
                  <td className="px-3 py-2 font-mono text-slate-200">{u.views7}</td>
                  <td className="px-3 py-2 font-mono text-slate-200">
                    {u.activeDays}
                    <span className="text-[10px] text-slate-500"> / {days}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-200">{u.actions}</td>
                  <td className="px-3 py-2 text-xs text-slate-300">{u.lastAt ? timeAgo(u.lastAt) : u.lastLoginAt ? "未使用" : "尚未登入"}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{u.top.map((a) => AREA_LABEL[a] ?? a).join("、") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
