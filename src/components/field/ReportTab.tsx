"use client";

import { useState } from "react";
import { unitLabel } from "@/lib/buildings";
import { buildReport } from "@/lib/report";
import { BTN_OUTLINE, BTN_PRIMARY, INPUT } from "../ui";
import { TODAY, useMgmt } from "../manage/common";

// dataviz 深色模式類別色前兩格（相鄰驗證通過）
const C1 = "#3987e5";
const C2 = "#d95926";

export default function ReportTab() {
  const m = useMgmt();
  const [mode, setMode] = useState<"month" | "year">("month");
  const [month, setMonth] = useState(TODAY().slice(0, 7));
  const [year, setYear] = useState(TODAY().slice(0, 4));
  const period = mode === "month" ? month : year;
  const r = buildReport({ todos: m.todos, meetings: m.meetings, reservations: m.reservations, visitors: m.visitors, fieldlogs: m.fieldlogs, vendors: m.vendors, announcements: m.announcements }, period);
  const maxGroup = Math.max(1, ...r.todos.byGroup.flatMap((g) => [g.created, g.completed]));
  const maxMonth = Math.max(1, ...r.months.map((x) => Math.max(x.todosNew, x.todosDone)));
  const years = [...new Set([TODAY().slice(0, 4), ...m.meetings.map((x) => x.date.slice(0, 4)), ...m.todos.map((t) => t.createdAt.slice(0, 4))].filter(Boolean))].sort().reverse();

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-cyan-500/40 text-sm">
          {(
            [
              ["month", "月報"],
              ["year", "年報"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={`px-3 py-1.5 ${mode === k ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400"}`}>
              {l}
            </button>
          ))}
        </div>
        {mode === "month" ? (
          <input type="month" className={`${INPUT} w-44 py-1.5`} value={month} onChange={(e) => setMonth(e.target.value)} />
        ) : (
          <select className={`${INPUT} w-32 py-1.5`} value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => (
              <option key={y} value={y}>
                {Number(y) - 1911} 年
              </option>
            ))}
          </select>
        )}
        <div className="flex-1" />
        <a href={`/api/meetings/agenda?buildingId=${m.building.id}`} className={BTN_OUTLINE}>
          📝 下次會議議程（Word）
        </a>
        <a href={`/api/report?buildingId=${m.building.id}&period=${period}`} className={BTN_OUTLINE}>
          ⬇ 匯出 Excel
        </a>
        <button onClick={() => window.print()} className={BTN_PRIMARY}>
          🖨 列印 / PDF
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="print-area space-y-4 bg-[#020814] p-1 print:bg-white print:p-8 print:text-black">
          <h2 className="text-xl font-semibold text-cyan-50 print:text-black">
            藍圖社區 {r.label}管理報告
            <span className="ml-2 text-sm font-normal text-slate-400">
              {r.from} ～ {r.to}
            </span>
          </h2>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {(
              [
                ["新增待辦", r.todos.created],
                ["完成待辦", r.todos.completed],
                ["期末逾期", r.todos.overdue, r.todos.overdue > 0],
                ["管委會會議", r.meetings.committee],
                ["預約", r.reservations.total],
                ["管理費加收", `$${r.reservations.fee.toLocaleString()}`],
                ["值班紀錄", r.logs.total],
                ["維修費用", `$${r.records.cost.toLocaleString()}`],
              ] as [string, number | string, boolean?][]
            ).map(([l, v, warn]) => (
              <div key={l} className="rounded-lg border border-cyan-500/20 px-3 py-2 print:border-slate-300">
                <p className="text-[11px] text-slate-400">{l}</p>
                <p className={`font-mono text-xl ${warn ? "text-rose-300" : "text-cyan-50 print:text-black"}`}>
                  {warn && "⚠ "}
                  {v}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="各單位待辦：新增 vs 完成">
              <Legend items={[["本期新增", C1], ["本期完成", C2]]} />
              <div className="space-y-2">
                {r.todos.byGroup.map((g) => (
                  <div key={g.group} className="grid grid-cols-[4.5em_1fr_5em] items-center gap-2 text-xs">
                    <span className="text-slate-200 print:text-black">{g.group}</span>
                    <div className="space-y-[2px]">
                      <Bar value={g.created} max={maxGroup} color={C1} title={`${g.group} 新增 ${g.created}`} />
                      <Bar value={g.completed} max={maxGroup} color={C2} title={`${g.group} 完成 ${g.completed}`} />
                    </div>
                    <span className="font-mono text-slate-300 print:text-black">
                      {g.created} / {g.completed}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">目前各單位未完成：{r.todos.byGroup.map((g) => `${g.group} ${g.open}`).join("、")}</p>
            </Card>

            {r.yearly ? (
              <Card title="逐月待辦：新增 vs 完成">
                <Legend items={[["新增", C1], ["完成", C2]]} />
                <div className="flex h-40 items-end gap-1.5 border-b border-cyan-500/30">
                  {r.months.map((x) => (
                    <div key={x.month} className="flex h-full flex-1 items-end justify-center gap-[2px]" title={`${x.month} 月：新增 ${x.todosNew}、完成 ${x.todosDone}`}>
                      <span className="w-1/2 max-w-3 rounded-t" style={{ height: `${(x.todosNew / maxMonth) * 100}%`, minHeight: x.todosNew ? 3 : 0, background: C1 }} />
                      <span className="w-1/2 max-w-3 rounded-t" style={{ height: `${(x.todosDone / maxMonth) * 100}%`, minHeight: x.todosDone ? 3 : 0, background: C2 }} />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex gap-1.5 text-center text-[10px] text-slate-400">
                  {r.months.map((x) => (
                    <span key={x.month} className="flex-1">
                      {x.month}
                    </span>
                  ))}
                </div>
              </Card>
            ) : (
              <Card title="預約與公設">
                <Table
                  head={["類型", "預約", "完成", "未到", "取消/退回", "扣點", "加收"]}
                  rows={r.reservations.byType.filter((x) => x.total).map((x) => [x.type, x.total, x.done, x.noShow, x.cancelled, x.points, x.fee ? `$${x.fee}` : "—"])}
                  empty="本期無預約"
                />
              </Card>
            )}

            <Card title="管委會出席率">
              <Table head={["姓名", "職稱", "出席", "請假", "場次", "出席率"]} rows={r.meetings.attendance.map((a) => [a.name, a.title, a.present, a.leave, a.total, `${Math.round((a.present / a.total) * 100)}%`])} empty="本期無會議出席資料" />
            </Card>

            <Card title="管理費加收明細（公設點數不足）">
              <Table head={["戶別", "不足點數", "加收金額"]} rows={r.reservations.feeByUnit.map((x) => [unitLabel(x.unitId), x.overflow, `$${x.fee.toLocaleString()}`])} empty="本期無加收" />
            </Card>

            <Card title={`維修 / 保養紀錄（${r.records.list.length}）`}>
              <Table head={["日期", "廠商", "項目", "費用"]} rows={r.records.list.map((x) => [x.date.slice(5), x.vendor, x.title, x.cost || "—"])} empty="本期無紀錄" />
            </Card>

            <Card title={`值班日誌（${r.logs.total}）與公告（${r.announcements.created}）`}>
              <div className="flex flex-wrap gap-2 text-xs">
                {r.logs.byType
                  .filter((x) => x.n)
                  .map((x) => (
                    <span key={x.type} className="rounded bg-white/5 px-2 py-1 text-slate-200 print:text-black">
                      {x.type} <b className="font-mono">{x.n}</b>
                    </span>
                  ))}
                <span className="rounded bg-white/5 px-2 py-1 text-slate-200 print:text-black">
                  公告已張貼 <b className="font-mono">{r.announcements.posted}</b>
                </span>
                <span className="rounded bg-white/5 px-2 py-1 text-slate-200 print:text-black">
                  訪客人次 <b className="font-mono">{r.visitors}</b>
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-cyan-500/20 bg-white/[0.02] p-4 print:break-inside-avoid print:border-slate-300">
      <h3 className="mb-3 text-sm font-semibold text-cyan-100 print:text-black">{title}</h3>
      {children}
    </section>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="mb-2 flex gap-3 text-[11px] text-slate-300 print:text-black">
      {items.map(([l, c]) => (
        <span key={l} className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  );
}

function Bar({ value, max, color, title }: { value: number; max: number; color: string; title: string }) {
  return (
    <div className="h-2.5" title={title}>
      <div className="h-full rounded-r" style={{ width: `${(value / max) * 100}%`, minWidth: value ? 3 : 0, background: color }} />
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  if (!rows.length) return <p className="text-xs text-slate-500">{empty}</p>;
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-slate-400">
        <tr>
          {head.map((h) => (
            <th key={h} className="py-1 font-normal">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-cyan-500/10 text-slate-200 print:border-slate-200 print:text-black">
            {r.map((c, j) => (
              <td key={j} className="py-1 pr-2">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
