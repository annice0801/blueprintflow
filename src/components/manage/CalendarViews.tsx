"use client";

import { useEffect, useMemo, useState } from "react";
import { DUE_COLOR, dueState, INSPECTION_COLOR, nextDue } from "@/lib/inspections";
import { STATUS_COLOR } from "@/lib/mgmt";
import { playbookOf } from "@/lib/playbooks";
import { fmtDate, useMgmt } from "./common";

export type CalItem = {
  id: string;
  date: string;
  kind: "待辦" | "開始" | "會議" | "檢測" | "已檢測" | "合約" | "事件";
  icon?: string;
  title: string;
  color: string;
  alert?: boolean; // 逾期 / 即將到期
  onClick: () => void;
};

const KIND_ICON: Record<CalItem["kind"], string> = { 待辦: "⏰", 開始: "▶", 會議: "◆", 檢測: "🧯", 已檢測: "✓", 合約: "📑", 事件: "★" };

export type Holiday = { date: string; name: string; off: boolean };

/** 國定假日與補班（行政院人事行政總處辦公日曆） */
export function useHolidays(year: number) {
  const [map, setMap] = useState<Map<string, Holiday>>(new Map());
  useEffect(() => {
    let alive = true;
    fetch(`/api/holidays?year=${year}`)
      .then((r) => r.json())
      .then((rows: { items: Holiday[] }[]) => alive && setMap(new Map(rows.flatMap((r) => r.items).map((h) => [h.date, h]))))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [year]);
  return map;
}
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** 時程上所有日期事件：待辦（期限 / 開始）、會議、檢測期限與辦理紀錄、合約到期 */
export function useCalItems(hideDone: boolean, today: string) {
  const { todos, meetings, inspections, vendors, events, openTodo, goTab } = useMgmt();
  return useMemo(() => {
    const out: CalItem[] = [];
    for (const t of todos) {
      if (hideDone && t.status === "已完成") continue;
      const over = !!t.due && t.due < today && t.status !== "已完成" && t.status !== "暫緩";
      // 等待前一步的待辦：日期為預估，標 ⏳
      const waiting = !!t.after && t.status === "未開始" && todos.some((x) => x.id === t.after && x.status !== "已完成");
      if (t.due) out.push({ id: `t-${t.id}`, date: t.due, kind: "待辦", title: `${waiting ? "⏳ " : ""}${t.title}`, color: STATUS_COLOR[t.status], alert: over && !waiting, onClick: () => openTodo(t) });
      if (waiting) continue;
      if (t.start && t.start !== t.due) out.push({ id: `ts-${t.id}`, date: t.start, kind: "開始", title: t.title, color: STATUS_COLOR[t.status], onClick: () => openTodo(t) });
    }
    for (const m of meetings) if (m.date) out.push({ id: `m-${m.id}`, date: m.date, kind: "會議", title: m.title, color: "#a78bfa", onClick: () => goTab("meetings", { meeting: m.id }) });
    for (const p of inspections) {
      if (!p.enabled) continue;
      const due = nextDue(p);
      const st = dueState(p, today);
      if (due) out.push({ id: `i-${p.id}`, date: due, kind: "檢測", title: p.name, color: st === "已排定" ? INSPECTION_COLOR : DUE_COLOR[st], alert: st === "逾期" || st === "30 天內", onClick: () => goTab("inspections") });
      if (!hideDone) for (const r of p.records) out.push({ id: `ir-${r.id}`, date: r.date, kind: "已檢測", title: `${p.name}（${r.result}）`, color: "#64748b", onClick: () => goTab("inspections") });
    }
    for (const e of events) {
      const pb = playbookOf(e.playbookId);
      out.push({ id: `e-${e.id}`, date: e.date, kind: "事件", icon: pb?.icon, title: `${e.name}${pb && e.name !== pb.name ? `（${pb.name}）` : ""}`, color: "#f472b6", onClick: () => goTab("todos", { event: e.id }) });
    }
    for (const v of vendors) if (v.contractEnd) out.push({ id: `c-${v.id}`, date: v.contractEnd, kind: "合約", title: `合約到期：${v.name}`, color: "#94a3b8", onClick: () => goTab("vendors", { company: v.id }) });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [todos, meetings, inspections, vendors, events, hideDone, today, openTodo, goTab]);
}

function byDate(items: CalItem[]) {
  const m = new Map<string, CalItem[]>();
  for (const it of items) m.set(it.date, [...(m.get(it.date) ?? []), it]);
  return m;
}

function Chip({ it }: { it: CalItem }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        it.onClick();
      }}
      title={`${it.kind}｜${it.title}`}
      className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight text-slate-100 hover:brightness-125 ${it.alert ? "ring-1 ring-[#ff4d6d]" : ""}`}
      style={{ background: `${it.color}33`, borderLeft: `3px solid ${it.color}` }}
    >
      <span className="shrink-0 text-[10px]">{it.icon ?? KIND_ICON[it.kind]}</span>
      <span className="truncate">{it.title}</span>
    </button>
  );
}

export function MonthView({ items, holidays, year, month, today, selected, onSelect }: { items: CalItem[]; holidays: Map<string, Holiday>; year: number; month: number; today: string; selected: string; onSelect: (d: string) => void }) {
  const map = byDate(items);
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const dayItems = map.get(selected) ?? [];
  const monthKey = ymd(year, month, 1).slice(0, 7);
  const monthItems = items.filter((x) => x.date.startsWith(monthKey) && (x.kind === "檢測" || x.kind === "事件" || x.alert));
  const monthHolidays = [...holidays.values()].filter((h) => h.date.startsWith(monthKey));

  return (
    <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-cyan-500/20">
        <div className="grid grid-cols-7 border-b border-cyan-500/20 text-center text-xs text-cyan-300">
          {WEEK.map((w, i) => (
            <div key={w} className={`py-1.5 ${i === 0 || i === 6 ? "text-rose-300/80" : ""}`}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} className="border-b border-r border-cyan-500/10 bg-black/20" />;
            const date = ymd(year, month, d);
            const list = map.get(date) ?? [];
            const isToday = date === today;
            const h = holidays.get(date);
            const red = h ? h.off : i % 7 === 0 || i % 7 === 6;
            return (
              <div
                key={date}
                onClick={() => onSelect(date)}
                className={`flex min-h-24 cursor-pointer flex-col gap-0.5 border-b border-r border-cyan-500/10 p-1 hover:bg-cyan-400/5 ${selected === date ? "bg-cyan-400/10" : h?.off ? "bg-rose-500/[0.06]" : ""}`}
              >
                <span className="mb-0.5 flex items-center gap-1">
                  <span className={`rounded px-1 text-xs ${isToday ? "bg-[#4cc9ff] font-bold text-slate-950" : red ? "text-rose-300" : "text-slate-300"}`}>{d}</span>
                  {h && <span className={`truncate text-[10px] ${h.off ? "text-rose-300" : "text-amber-300"}`}>{h.off ? h.name : `補班`}</span>}
                </span>
                {list.slice(0, 3).map((it) => (
                  <Chip key={it.id} it={it} />
                ))}
                {list.length > 3 && <span className="px-1 text-[10px] text-cyan-300">+{list.length - 3} 項</span>}
              </div>
            );
          })}
        </div>
      </div>
      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <section className="rounded-lg border border-cyan-500/20 p-3">
          <h3 className="mb-2 text-sm font-semibold text-cyan-50">
            {fmtDate(selected)}
            {holidays.get(selected) && <span className={`ml-2 text-xs font-normal ${holidays.get(selected)!.off ? "text-rose-300" : "text-amber-300"}`}>{holidays.get(selected)!.off ? `🎌 ${holidays.get(selected)!.name}` : "補行上班"}</span>}
          </h3>
          {dayItems.length === 0 ? (
            <p className="text-xs text-slate-500">這天沒有排程</p>
          ) : (
            <ul className="space-y-1">
              {dayItems.map((it) => (
                <li key={it.id}>
                  <Chip it={it} />
                  <span className="pl-2 text-[10px] text-slate-500">{it.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-cyan-500/20 p-3">
          <h3 className="mb-2 text-sm font-semibold text-cyan-50">本月需注意</h3>
          {monthItems.length === 0 ? (
            <p className="text-xs text-slate-500">本月沒有檢測期限、情境事件或逾期事項</p>
          ) : (
            <ul className="space-y-1">
              {monthItems.map((it) => (
                <li key={it.id} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-[11px] text-slate-400">{Number(it.date.slice(8))} 日</span>
                  <Chip it={it} />
                </li>
              ))}
            </ul>
          )}
        </section>
        {monthHolidays.length > 0 && (
          <section className="rounded-lg border border-cyan-500/20 p-3">
            <h3 className="mb-2 text-sm font-semibold text-cyan-50">本月假日</h3>
            <ul className="space-y-0.5 text-xs">
              {monthHolidays.map((h) => (
                <li key={h.date} className={h.off ? "text-rose-300" : "text-amber-300"}>
                  {Number(h.date.slice(8))} 日 {h.off ? h.name : "補行上班"}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[10px] text-slate-500">安排廠商施工、搬家預約請避開連假</p>
          </section>
        )}
      </aside>
    </div>
  );
}

export function YearView({ items, holidays, year, today, onPick }: { items: CalItem[]; holidays: Map<string, Holiday>; year: number; today: string; onPick: (month: number, date?: string) => void }) {
  const map = byDate(items);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const key = `${year}-${pad(m + 1)}`;
        const mi = items.filter((x) => x.date.startsWith(key));
        const insp = mi.filter((x) => x.kind === "檢測" || x.kind === "事件");
        const n = (k: CalItem["kind"]) => mi.filter((x) => x.kind === k).length;
        const first = new Date(year, m, 1).getDay();
        const days = new Date(year, m + 1, 0).getDate();
        return (
          <div key={m} className={`rounded-lg border p-2.5 ${today.startsWith(key) ? "border-cyan-400/60" : "border-cyan-500/20"}`}>
            <button onClick={() => onPick(m)} className="mb-1.5 flex w-full items-baseline justify-between text-left hover:text-cyan-200">
              <span className="text-sm font-semibold text-cyan-50">{m + 1} 月</span>
              <span className="text-[10px] text-slate-400">
                待辦 {n("待辦")} · 會議 {n("會議")} · 檢測 {n("檢測")}
                {n("事件") > 0 && ` · 事件 ${n("事件")}`}
              </span>
            </button>
            <div className="grid grid-cols-7 gap-px text-center text-[10px]">
              {WEEK.map((w) => (
                <span key={w} className="text-slate-500">
                  {w}
                </span>
              ))}
              {Array.from({ length: first }, (_, i) => (
                <span key={`e${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const date = ymd(year, m, i + 1);
                const list = map.get(date) ?? [];
                const top = list.find((x) => x.alert) ?? list.find((x) => x.kind === "事件") ?? list.find((x) => x.kind === "檢測") ?? list.find((x) => x.kind === "會議") ?? list[0];
                const h = holidays.get(date);
                return (
                  <button
                    key={date}
                    onClick={() => onPick(m, date)}
                    title={[h && (h.off ? `🎌 ${h.name}` : "補行上班"), ...list.map((x) => `${x.kind}｜${x.title}`)].filter(Boolean).join("\n") || undefined}
                    className={`relative rounded py-0.5 hover:bg-cyan-400/10 ${date === today ? "bg-[#4cc9ff] font-bold text-slate-950" : h?.off ? "bg-rose-500/15 text-rose-300" : h ? "text-amber-300" : list.length ? "text-slate-100" : "text-slate-500"}`}
                  >
                    {i + 1}
                    {top && date !== today && <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ background: top.alert ? "#ff4d6d" : top.color }} />}
                  </button>
                );
              })}
            </div>
            {insp.length > 0 && (
              <ul className="mt-2 space-y-0.5 border-t border-cyan-500/10 pt-1.5">
                {insp.map((it) => (
                  <li key={it.id} className="truncate text-[10px]" style={{ color: it.color }}>
                    {it.icon ?? "🧯"} {Number(it.date.slice(8))} 日 {it.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const CAL_LEGEND: [string, string][] = [
  ["⏰ 待辦期限", STATUS_COLOR["進行中"]],
  ["◆ 會議", "#a78bfa"],
  ["🧯 檢測期限", INSPECTION_COLOR],
  ["✓ 已辦理", "#64748b"],
  ["📑 合約到期", "#94a3b8"],
  ["🌀 情境事件", "#f472b6"],
];
