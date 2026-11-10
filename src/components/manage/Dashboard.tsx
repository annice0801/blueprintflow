"use client";

import { useMemo, useState } from "react";
import { GROUP_COLOR, isOverdue, ROLES, roleOf, STATUS_COLOR, STATUS_STACK, type RoleGroup, type Todo, type TodoStatus } from "@/lib/mgmt";
import { fmtDate, planLink, RoleChips, StatusBadge, TODAY, useMgmt } from "./common";

const SERIES = "#3987e5"; // 單一數量用同一色相（dataviz 深色 slot 1）
const DAY = 86400000;

type TipState = { x: number; y: number; lines: string[] } | null;

function useTip() {
  const [tip, setTip] = useState<TipState>(null);
  const bind = (lines: string[]) => ({
    onMouseMove: (e: React.MouseEvent) => {
      const host = (e.currentTarget as HTMLElement).closest("[data-tip-host]")!.getBoundingClientRect();
      setTip({ x: e.clientX - host.left + 12, y: e.clientY - host.top + 12, lines });
    },
    onMouseLeave: () => setTip(null),
  });
  const node = tip && (
    <div className="pointer-events-none absolute z-20 rounded-md border border-cyan-400/40 bg-[#06142a] px-2.5 py-1.5 text-xs shadow-lg" style={{ left: tip.x, top: tip.y }}>
      {tip.lines.map((l, i) => (
        <p key={i} className={i === 0 ? "font-semibold text-cyan-50" : "text-slate-300"}>
          {l}
        </p>
      ))}
    </div>
  );
  return { bind, node };
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section data-tip-host className="relative rounded-lg border border-cyan-500/20 bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-cyan-100">{title}</h3>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: number | string; tone?: "bad" | "warn"; hint?: string }) {
  return (
    <div className="rounded-lg border border-cyan-500/20 bg-white/[0.02] px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-semibold ${tone === "bad" ? "text-rose-300" : tone === "warn" ? "text-amber-200" : "text-cyan-50"}`}>
        {tone === "bad" && Number(value) > 0 && <span className="mr-1 text-lg">⚠</span>}
        {value}
      </p>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

/** 完成日：追蹤紀錄中「→ 已完成」的時間；匯入時即已完成者用期限，沒有期限用會議日期 */
function doneDate(t: Todo) {
  if (t.status !== "已完成") return "";
  const hit = [...t.log].reverse().find((l) => l.text.includes("→ 已完成"));
  return hit ? hit.at.slice(0, 10) : t.due || t.start || t.updatedAt.slice(0, 10);
}

export default function Dashboard() {
  const { building, todos, meetings, vendors, openTodo, goTab } = useMgmt();
  const today = TODAY();
  const stacked = useTip();
  const byRole = useTip();
  const places = useTip();
  const monthly = useTip();

  const open = todos.filter((t) => t.status !== "已完成" && t.status !== "暫緩");
  const overdue = todos.filter((t) => isOverdue(t, today));
  const thisMonth = todos.filter((t) => doneDate(t).slice(0, 7) === today.slice(0, 7)).length;
  const expiring = vendors.filter((v) => v.contractEnd && v.contractEnd >= today && (Date.parse(v.contractEnd) - Date.parse(today)) / DAY <= 30).length;

  const groups = (["管委會", "物業", "建商", "外包廠商"] as RoleGroup[]).map((g) => {
    const mine = todos.filter((t) => t.assignees.some((r) => roleOf(r).group === g));
    return { g, total: mine.length, counts: Object.fromEntries(STATUS_STACK.map((s) => [s, mine.filter((t) => t.status === s).length])) as Record<TodoStatus, number> };
  });
  const maxGroup = Math.max(1, ...groups.map((g) => g.total));

  const roleRows = ROLES.map((r) => ({
    r,
    open: open.filter((t) => t.assignees.includes(r.id)).length,
    late: overdue.filter((t) => t.assignees.includes(r.id)).length,
  }))
    .filter((x) => x.open)
    .sort((a, b) => b.open - a.open);
  const maxRole = Math.max(1, ...roleRows.map((x) => x.open));

  const placeRows = useMemo(() => {
    const m = new Map<string, { label: string; meetings: number; todos: number; ref: { floor: string; tower: "A" | "B" | "S"; zoneId?: string } }>();
    const add = (label: string, ref: { floor: string; tower: "A" | "B" | "S"; zoneId?: string }, k: "meetings" | "todos") => {
      const e = m.get(label) ?? { label, meetings: 0, todos: 0, ref };
      e[k]++;
      m.set(label, e);
    };
    for (const mt of meetings) for (const x of mt.mentions) add(x.label, x, "meetings");
    for (const t of todos) if (t.location) add(t.location.label, t.location, "todos");
    return [...m.values()].sort((a, b) => b.meetings + b.todos - (a.meetings + a.todos)).slice(0, 8);
  }, [meetings, todos]);
  const maxPlace = Math.max(1, ...placeRows.map((p) => p.meetings + p.todos));

  const months: { key: string; n: number }[] = [];
  const base = new Date(`${today}T00:00:00`);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, n: todos.filter((t) => doneDate(t).slice(0, 7) === key).length });
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.n));

  const soon = open
    .filter((t) => t.due && t.due >= today && (Date.parse(t.due) - Date.parse(today)) / DAY <= 14)
    .sort((a, b) => a.due.localeCompare(b.due));

  return (
    <div className="h-full space-y-4 overflow-y-auto pb-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="未完成待辦" value={open.length} hint={`共 ${todos.length} 筆`} />
        <Stat label="已逾期" value={overdue.length} tone={overdue.length ? "bad" : undefined} hint="期限已過且未完成" />
        <Stat label="本月完成" value={thisMonth} />
        <Stat label="會議紀錄" value={meetings.length} hint={meetings[0] ? `最近 ${fmtDate(meetings[0].date)}` : undefined} />
        <Stat label="30 天內到期合約" value={expiring} tone={expiring ? "warn" : undefined} hint={`廠商 ${vendors.length} 家`} />
      </div>

      {todos.length === 0 && meetings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-cyan-500/40 px-6 py-12 text-center">
          <p className="text-sm text-cyan-100">還沒有資料</p>
          <p className="mt-1 text-xs text-slate-400">先到「會議紀錄」上傳會議紀錄，系統會自動建立待辦事項並標記地點。</p>
          <button onClick={() => goTab("meetings")} className="mt-3 rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
            上傳會議紀錄
          </button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="各單位待辦狀態" sub="一筆待辦有多位追蹤者時，會計入各自的單位">
            <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-300">
              {STATUS_STACK.map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLOR[s] }} />
                  {s}
                </span>
              ))}
            </div>
            <div className="space-y-2.5">
              {groups.map(({ g, total, counts }) => (
                <div key={g} className="grid grid-cols-[4.5em_1fr_2.5em] items-center gap-2 text-xs">
                  <span className="text-slate-200">{g}</span>
                  <div className="flex h-5 gap-[2px]" style={{ width: `${(total / maxGroup) * 100}%`, minWidth: total ? 4 : 0 }}>
                    {STATUS_STACK.filter((s) => counts[s]).map((s, i, arr) => (
                      <div
                        key={s}
                        {...stacked.bind([`${g} · ${s}`, `${counts[s]} 筆（${Math.round((counts[s] / total) * 100)}%）`])}
                        className="flex h-full items-center justify-center text-[10px] font-semibold text-[#020814]"
                        style={{
                          flex: counts[s],
                          background: STATUS_COLOR[s],
                          borderRadius: `${i === 0 ? 4 : 0}px ${i === arr.length - 1 ? 4 : 0}px ${i === arr.length - 1 ? 4 : 0}px ${i === 0 ? 4 : 0}px`,
                        }}
                      >
                        {counts[s] / maxGroup > 0.08 ? counts[s] : ""}
                      </div>
                    ))}
                  </div>
                  <span className="text-right font-mono text-slate-300">{total}</span>
                </div>
              ))}
            </div>
            {stacked.node}
          </Card>

          <Card title="各角色未完成待辦" sub="點長條查看該角色的待辦">
            {roleRows.length === 0 && <p className="text-xs text-slate-500">沒有未完成的待辦</p>}
            <div className="space-y-1.5">
              {roleRows.map(({ r, open: n, late }) => (
                <button key={r.id} onClick={() => goTab("todos", { who: r.id })} className="grid w-full grid-cols-[5.5em_1fr_4.5em] items-center gap-2 text-left text-xs" {...byRole.bind([r.label, `未完成 ${n} 筆`, late ? `其中逾期 ${late} 筆` : "無逾期"])}>
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: GROUP_COLOR[r.group] }} />
                    {r.short}
                  </span>
                  <span className="h-4">
                    <span className="block h-full rounded-r" style={{ width: `${(n / maxRole) * 100}%`, minWidth: 4, background: SERIES }} />
                  </span>
                  <span className="font-mono text-slate-300">
                    {n}
                    {late > 0 && <span className="ml-1 text-rose-300">⚠{late}</span>}
                  </span>
                </button>
              ))}
            </div>
            {byRole.node}
          </Card>

          <Card title="最常被討論的地點" sub="會議紀錄提及次數 + 標記在該處的待辦數">
            {placeRows.length === 0 && <p className="text-xs text-slate-500">尚無地點資料</p>}
            <div className="space-y-1.5">
              {placeRows.map((p) => (
                <a key={p.label} href={planLink(building.id, p.ref)} className="grid grid-cols-[9em_1fr_2em] items-center gap-2 text-xs" {...places.bind([p.label, `會議提及 ${p.meetings} 次`, `待辦 ${p.todos} 筆`, "點擊在平面圖查看"])}>
                  <span className="truncate text-slate-200">📍 {p.label}</span>
                  <span className="h-4">
                    <span className="block h-full rounded-r" style={{ width: `${((p.meetings + p.todos) / maxPlace) * 100}%`, minWidth: 4, background: SERIES }} />
                  </span>
                  <span className="font-mono text-slate-300">{p.meetings + p.todos}</span>
                </a>
              ))}
            </div>
            {places.node}
          </Card>

          <Card title="每月完成待辦數" sub="近 6 個月">
            <div className="flex h-36 items-end gap-3 border-b border-cyan-500/30 px-1">
              {months.map((m) => (
                <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1" {...monthly.bind([`${Number(m.key.slice(0, 4)) - 1911} 年 ${Number(m.key.slice(5))} 月`, `完成 ${m.n} 筆`])}>
                  <span className="font-mono text-[11px] text-slate-300">{m.n || ""}</span>
                  <span className="block w-full max-w-10 rounded-t" style={{ height: `${(m.n / maxMonth) * 100}%`, minHeight: m.n ? 4 : 0, background: SERIES }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-3 px-1 text-center text-[11px] text-slate-400">
              {months.map((m) => (
                <span key={m.key} className="flex-1">
                  {Number(m.key.slice(5))} 月
                </span>
              ))}
            </div>
            {monthly.node}
          </Card>
        </div>
      )}

      {(overdue.length > 0 || soon.length > 0) && (
        <div className="grid gap-4 xl:grid-cols-2">
          {[
            { title: `逾期（${overdue.length}）`, list: overdue },
            { title: `14 天內到期（${soon.length}）`, list: soon },
          ].map(({ title, list }) => (
            <Card key={title} title={title}>
              <ul className="divide-y divide-cyan-500/10">
                {list.slice(0, 8).map((t) => (
                  <li key={t.id}>
                    <button onClick={() => openTodo(t)} className="flex w-full items-center gap-2 py-1.5 text-left hover:bg-cyan-400/5">
                      <StatusBadge status={t.status} />
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{t.title}</span>
                      <RoleChips ids={t.assignees} max={1} />
                      <span className="font-mono text-[11px] text-slate-400">{fmtDate(t.due)}</span>
                    </button>
                  </li>
                ))}
                {list.length === 0 && <li className="py-3 text-center text-xs text-slate-500">無</li>}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
