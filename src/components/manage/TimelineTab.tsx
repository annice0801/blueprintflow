"use client";

import { useMemo, useState } from "react";
import { DUE_COLOR, dueState, everyLabel, INSPECTION_COLOR, nextDue } from "@/lib/inspections";
import { GROUP_COLOR, roleOf, STATUS_COLOR, STATUS_STACK, type RoleGroup, type Todo } from "@/lib/mgmt";
import { CAL_LEGEND, MonthView, useCalItems, useHolidays, YearView } from "./CalendarViews";
import { fmtDate, TODAY, useMgmt } from "./common";

const DAY = 86400000;
const toT = (d: string) => Date.parse(`${d}T00:00:00`);
const toD = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ROW = 30;
const LABEL_W = 260;

type Tip = { x: number; y: number; title: string; lines: string[] } | null;

type View = "gantt" | "month" | "year";

export default function TimelineTab({ initialView, initialDate }: { initialView?: string; initialDate?: string }) {
  const today = TODAY();
  const { openEvent } = useMgmt();
  const start = initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : today;
  const [view, setView] = useState<View>(initialView === "month" || initialView === "year" ? initialView : "gantt");
  const [hideDone, setHideDone] = useState(false);
  const [cursor, setCursor] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const [selected, setSelected] = useState(start);
  const holidays = useHolidays(cursor.y);
  const items = useCalItems(hideDone, today);

  const step = (n: number) =>
    setCursor((c) => {
      if (view === "year") return { ...c, y: c.y + n };
      const d = new Date(c.y, c.m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const viewSwitch = (
    <div className="flex overflow-hidden rounded-md border border-cyan-500/40">
      {(
        [
          ["gantt", "甘特圖"],
          ["month", "月曆"],
          ["year", "年曆"],
        ] as const
      ).map(([k, l]) => (
        <button key={k} onClick={() => setView(k)} aria-pressed={view === k} className={`px-3 py-1.5 ${view === k ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400"}`}>
          {l}
        </button>
      ))}
    </div>
  );
  const hideDoneBox = (
    <>
      <label className="flex items-center gap-1 text-slate-300">
        <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="accent-cyan-400" />
        隱藏已完成
      </label>
      <button onClick={() => openEvent(view === "month" ? { date: selected } : undefined)} className="rounded-md border border-cyan-500/40 px-2.5 py-1 text-cyan-200 hover:bg-cyan-400/10">
        ＋ 情境事件
      </button>
    </>
  );

  if (view === "gantt") return <Gantt viewSwitch={viewSwitch} hideDone={hideDone} hideDoneBox={hideDoneBox} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {viewSwitch}
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="rounded px-2 py-1 text-cyan-200 hover:bg-cyan-400/10" aria-label="上一頁">
            ◀
          </button>
          <span className="min-w-28 text-center text-sm font-semibold text-cyan-50">
            {cursor.y - 1911} 年{view === "month" && ` ${cursor.m + 1} 月`}
            <span className="ml-1 text-[11px] font-normal text-slate-500">（{cursor.y}）</span>
          </span>
          <button onClick={() => step(1)} className="rounded px-2 py-1 text-cyan-200 hover:bg-cyan-400/10" aria-label="下一頁">
            ▶
          </button>
          <button
            onClick={() => {
              setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 });
              setSelected(today);
            }}
            className="ml-1 rounded border border-cyan-500/40 px-2 py-1 text-cyan-200 hover:bg-cyan-400/10"
          >
            今天
          </button>
        </div>
        {hideDoneBox}
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-3 text-slate-300">
          {CAL_LEGEND.map(([l, c]) => (
            <span key={l} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
              {l}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded-sm border-2 border-[#ff4d6d]" />
            逾期 / 即將到期
          </span>
          <span className="flex items-center gap-1 text-rose-300">
            <b>紅字</b>國定假日
          </span>
        </div>
      </div>
      {view === "month" ? (
        <MonthView items={items} holidays={holidays} year={cursor.y} month={cursor.m} today={today} selected={selected} onSelect={setSelected} />
      ) : (
        <YearView
          items={items}
          holidays={holidays}
          year={cursor.y}
          today={today}
          onPick={(m, date) => {
            setCursor((c) => ({ ...c, m }));
            if (date) setSelected(date);
            setView("month");
          }}
        />
      )}
    </div>
  );
}

function Gantt({ viewSwitch, hideDone, hideDoneBox }: { viewSwitch: React.ReactNode; hideDone: boolean; hideDoneBox: React.ReactNode }) {
  const { todos, meetings, vendors, inspections, openTodo, goTab } = useMgmt();
  const [group, setGroup] = useState<"group" | "status">("group");
  const [tip, setTip] = useState<Tip>(null);
  const today = TODAY();

  const items = todos.filter((t) => (t.start || t.due) && !(hideDone && t.status === "已完成"));
  const contracts = vendors.filter((v) => v.contractStart || v.contractEnd);
  const insp = inspections.filter((p) => p.enabled && (nextDue(p) || p.records.length)).sort((a, b) => (nextDue(a) || "9").localeCompare(nextDue(b) || "9"));

  // 時間範圍：涵蓋所有項目，前後留白，至少 90 天
  const { t0, days } = useMemo(() => {
    const ds = [today, ...items.flatMap((t) => [t.start, t.due]), ...meetings.map((m) => m.date), ...contracts.flatMap((v) => [v.contractStart, v.contractEnd]), ...insp.map(nextDue)].filter(Boolean);
    let a = Math.min(...ds.map(toT)) - 7 * DAY;
    let b = Math.max(...ds.map(toT)) + 14 * DAY;
    if (b - a < 90 * DAY) {
      const mid = (a + b) / 2;
      a = mid - 45 * DAY;
      b = mid + 45 * DAY;
    }
    a = toT(toD(a).slice(0, 8) + "01"); // 對齊月初
    return { t0: a, days: Math.ceil((b - a) / DAY) };
  }, [items, meetings, contracts, insp, today]);

  const pxDay = Math.max(5, Math.min(18, 1100 / days));
  const W = days * pxDay;
  const X = (d: string) => ((toT(d) - t0) / DAY) * pxDay;

  // 分組
  const groups: { key: string; color: string; rows: Todo[] }[] =
    group === "group"
      ? (["管委會", "物業", "建商", "外包廠商"] as RoleGroup[])
          .map((g) => ({ key: g, color: GROUP_COLOR[g], rows: items.filter((t) => roleOf(t.assignees[0] ?? "gm").group === g) }))
          .filter((g) => g.rows.length)
      : STATUS_STACK.map((s) => ({ key: s, color: STATUS_COLOR[s], rows: items.filter((t) => t.status === s) })).filter((g) => g.rows.length);
  for (const g of groups) g.rows.sort((a, b) => (a.start || a.due).localeCompare(b.start || b.due));

  const months: { x: number; label: string }[] = [];
  for (let t = t0; t < t0 + days * DAY; ) {
    const d = new Date(t);
    months.push({ x: ((t - t0) / DAY) * pxDay, label: `${d.getFullYear() - 1911} 年 ${d.getMonth() + 1} 月` });
    t = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  }

  const AXIS = 46;
  let y = AXIS;
  const rowsSvg: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  const hover = (e: React.MouseEvent, title: string, lines: string[]) => {
    const box = (e.currentTarget as SVGElement).ownerSVGElement!.parentElement!.getBoundingClientRect();
    setTip({ x: e.clientX - box.left + 12, y: e.clientY - box.top + 12, title, lines });
  };

  for (const g of groups) {
    labels.push(
      <div key={`g-${g.key}`} className="flex items-center gap-2 border-b border-cyan-500/20 bg-white/[0.03] px-3 text-xs font-semibold" style={{ height: ROW }}>
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: g.color }} />
        <span className="text-slate-100">{g.key}</span>
        <span className="font-normal text-slate-500">{g.rows.length}</span>
      </div>,
    );
    rowsSvg.push(<rect key={`gb-${g.key}`} x={0} y={y} width={W} height={ROW} fill="rgba(255,255,255,0.03)" />);
    y += ROW;
    for (const t of g.rows) {
      const s = t.start || t.due;
      const e = t.due || t.start;
      const x1 = X(s);
      const x2 = Math.max(X(e) + pxDay, x1 + 6);
      const over = t.due && t.due < today && t.status !== "已完成" && t.status !== "暫緩";
      labels.push(
        <button key={t.id} onClick={() => openTodo(t)} className="flex w-full items-center gap-2 truncate border-b border-cyan-500/10 px-3 text-left text-xs text-slate-200 hover:bg-cyan-400/5" style={{ height: ROW }}>
          <span className="truncate">{t.title}</span>
        </button>,
      );
      rowsSvg.push(
        <g key={t.id} className="cursor-pointer" onClick={() => openTodo(t)} onMouseMove={(ev) => hover(ev, t.title, [`${t.status}${over ? "（逾期）" : ""}`, `${fmtDate(s)} → ${fmtDate(e)}`, t.assignees.map((r) => roleOf(r).short).join("、")])} onMouseLeave={() => setTip(null)}>
          <rect x={0} y={y} width={W} height={ROW} fill="transparent" />
          <rect x={x1} y={y + 8} width={x2 - x1} height={ROW - 16} rx={4} fill={STATUS_COLOR[t.status]} stroke={over ? "#ff4d6d" : "none"} strokeWidth={2} />
          {t.due && <circle cx={X(t.due) + pxDay / 2} cy={y + ROW / 2} r={3} fill="#030d1c" />}
        </g>,
      );
      y += ROW;
    }
  }

  if (insp.length) {
    labels.push(
      <div key="g-insp" className="flex items-center gap-2 border-b border-cyan-500/20 bg-white/[0.03] px-3 text-xs font-semibold" style={{ height: ROW }}>
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: INSPECTION_COLOR }} />
        <span className="text-slate-100">年度檢測 / 申報</span>
        <span className="font-normal text-slate-500">{insp.length}</span>
      </div>,
    );
    y += ROW;
    for (const p of insp) {
      const due = nextDue(p);
      const st = dueState(p, today);
      const color = st === "已排定" ? INSPECTION_COLOR : DUE_COLOR[st];
      labels.push(
        <button key={p.id} onClick={() => goTab("inspections")} className="flex w-full items-center gap-2 truncate border-b border-cyan-500/10 px-3 text-left text-xs text-slate-200 hover:bg-cyan-400/5" style={{ height: ROW }}>
          <span className="truncate">{p.name}</span>
          <span className="shrink-0 text-[10px] text-slate-500">{everyLabel(p.everyMonths)}</span>
        </button>,
      );
      const cy = y + ROW / 2;
      rowsSvg.push(
        <g key={p.id} className="cursor-pointer" onClick={() => goTab("inspections")} onMouseMove={(ev) => hover(ev, p.name, [due ? `下次期限 ${fmtDate(due)}（${st}）` : "未設定期限", ...p.records.slice(-3).map((r) => `${fmtDate(r.date)} ${r.result}`)])} onMouseLeave={() => setTip(null)}>
          <rect x={0} y={y} width={W} height={ROW} fill="transparent" />
          {/* 檢測準備期：期限前 45 天 */}
          {due && <rect x={Math.max(0, X(due) - 45 * pxDay)} y={cy - 2} width={Math.min(45 * pxDay, X(due))} height={4} rx={2} fill={color} fillOpacity={0.3} />}
          {p.records.map((r) => (
            <circle key={r.id} cx={X(r.date) + pxDay / 2} cy={cy} r={4} fill="#64748b" stroke="#030d1c" strokeWidth={2} />
          ))}
          {due && <path d={`M${X(due) + pxDay / 2} ${cy - 7} l7 7 l-7 7 l-7 -7 z`} fill={color} stroke="#030d1c" strokeWidth={2} />}
        </g>,
      );
      y += ROW;
    }
  }

  if (contracts.length) {
    labels.push(
      <div key="g-contracts" className="flex items-center gap-2 border-b border-cyan-500/20 bg-white/[0.03] px-3 text-xs font-semibold" style={{ height: ROW }}>
        <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
        <span className="text-slate-100">廠商合約期間</span>
      </div>,
    );
    y += ROW;
    for (const v of contracts) {
      const s = v.contractStart || v.contractEnd;
      const e = v.contractEnd || v.contractStart;
      const expiring = v.contractEnd && toT(v.contractEnd) - toT(today) < 30 * DAY && v.contractEnd >= today;
      labels.push(
        <button key={v.id} onClick={() => goTab("vendors")} className="flex w-full items-center truncate border-b border-cyan-500/10 px-3 text-left text-xs text-slate-300 hover:bg-cyan-400/5" style={{ height: ROW }}>
          {v.category} · {v.name}
        </button>,
      );
      rowsSvg.push(
        <g key={v.id} onMouseMove={(ev) => hover(ev, v.name, [v.category, `${fmtDate(s)} → ${fmtDate(e)}`, v.amount].filter(Boolean))} onMouseLeave={() => setTip(null)}>
          <rect x={0} y={y} width={W} height={ROW} fill="transparent" />
          <rect x={X(s)} y={y + 9} width={Math.max(X(e) - X(s), 6)} height={ROW - 18} rx={3} fill="#64748b" fillOpacity={0.55} stroke={expiring ? "#fbbf24" : "#94a3b8"} strokeWidth={1.2} />
        </g>,
      );
      y += ROW;
    }
  }

  const H = Math.max(y, AXIS + ROW * 3);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {viewSwitch}
        <div className="flex overflow-hidden rounded-md border border-cyan-500/40">
          {(
            [
              ["group", "依追蹤單位"],
              ["status", "依狀態"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setGroup(k)} className={`px-3 py-1.5 ${group === k ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400"}`}>
              {l}
            </button>
          ))}
        </div>
        {hideDoneBox}
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-3 text-slate-300">
          {STATUS_STACK.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="h-2.5 w-4 rounded-sm" style={{ background: STATUS_COLOR[s] }} />
              {s}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded-sm border-2 border-[#ff4d6d]" />
            逾期
          </span>
          <span className="flex items-center gap-1">
            <span className="text-violet-300">◆</span>會議
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: INSPECTION_COLOR }}>◆</span>檢測期限
          </span>
        </div>
      </div>

      {items.length === 0 && contracts.length === 0 && insp.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">還沒有含開始日或期限的待辦事項。匯入會議紀錄或新增待辦後，會在這裡排出時程。</p>
      ) : (
        <div className="relative flex min-h-0 flex-1 overflow-auto rounded-lg border border-cyan-500/20">
          <div className="sticky left-0 z-10 shrink-0 border-r border-cyan-500/20 bg-[#030d1c]" style={{ width: LABEL_W }}>
            <div className="border-b border-cyan-500/20 px-3 text-xs leading-[46px] text-cyan-300" style={{ height: AXIS }}>
              項目
            </div>
            {labels}
          </div>
          <div className="relative shrink-0">
            <svg width={W} height={H} className="block">
              {months.map((m) => (
                <g key={m.x}>
                  <line x1={m.x} y1={0} x2={m.x} y2={H} stroke="#163150" />
                  <text x={m.x + 6} y={16} fontSize={11} fill="#8fb3cc">
                    {m.label}
                  </text>
                </g>
              ))}
              <line x1={0} y1={AXIS - 0.5} x2={W} y2={AXIS - 0.5} stroke="#1f4466" />
              {meetings.map((m) =>
                m.date ? (
                  <g key={m.id} className="cursor-pointer" onClick={() => goTab("meetings", { meeting: m.id })} onMouseMove={(ev) => hover(ev, m.title, [fmtDate(m.date), m.type])} onMouseLeave={() => setTip(null)}>
                    <line x1={X(m.date) + pxDay / 2} y1={AXIS} x2={X(m.date) + pxDay / 2} y2={H} stroke="#a78bfa" strokeOpacity={0.35} strokeDasharray="3 3" />
                    <path d={`M${X(m.date) + pxDay / 2} ${AXIS - 18} l6 6 l-6 6 l-6 -6 z`} fill="#a78bfa" />
                  </g>
                ) : null,
              )}
              {rowsSvg}
              <line x1={X(today) + pxDay / 2} y1={22} x2={X(today) + pxDay / 2} y2={H} stroke="#4cc9ff" strokeWidth={1.5} />
              <rect x={X(today) + pxDay / 2 - 18} y={22} width={36} height={14} rx={3} fill="#4cc9ff" />
              <text x={X(today) + pxDay / 2} y={29} fontSize={10} textAnchor="middle" dominantBaseline="central" fill="#020814" fontWeight={700}>
                今天
              </text>
            </svg>
            {tip && (
              <div className="pointer-events-none absolute z-20 max-w-64 rounded-md border border-cyan-400/40 bg-[#06142a] px-2.5 py-1.5 text-xs shadow-lg" style={{ left: tip.x, top: tip.y }}>
                <p className="font-semibold text-cyan-50">{tip.title}</p>
                {tip.lines.map((l, i) => (
                  <p key={i} className="text-slate-300">
                    {l}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
