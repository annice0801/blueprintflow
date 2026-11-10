"use client";

import { useMemo, useState } from "react";
import { GROUP_COLOR, isOverdue, ROLES, roleOf, TODO_STATUS, type RoleGroup, type RoleId, type Todo, type TodoStatus } from "@/lib/mgmt";
import { api, BTN_PRIMARY, INPUT } from "../ui";
import { fmtDate, mergeTodo, RoleChips, StatusBadge, TODAY, TODO_LINKS, upsert, useMgmt } from "./common";
import { playbookOf } from "@/lib/playbooks";

type Filter = { who: "" | RoleGroup | RoleId; q: string; overdue: boolean; meetingId: string; eventId: string; hideDone: boolean };

export default function TodosTab({ initialWho, initialEvent }: { initialWho?: string; initialEvent?: string }) {
  const { todos, setTodos, meetings, events, openTodo, openEvent, roles } = useMgmt();
  const [view, setView] = useState<"board" | "table">("board");
  const [f, setF] = useState<Filter>({ who: (initialWho as Filter["who"]) ?? "", q: "", overdue: false, meetingId: "", eventId: initialEvent ?? "", hideDone: false });
  const [dragId, setDragId] = useState<string | null>(null);
  const today = TODAY();

  const shown = useMemo(
    () =>
      todos
        .filter((t) => {
          if (f.who && !t.assignees.some((r) => r === f.who || roleOf(r).group === f.who)) return false;
          if (f.overdue && !isOverdue(t, today)) return false;
          if (f.hideDone && t.status === "已完成") return false;
          if (f.meetingId && t.meetingId !== f.meetingId) return false;
          if (f.eventId && t.eventId !== f.eventId) return false;
          if (f.q && !`${t.title}${t.description}${t.location?.label ?? ""}`.includes(f.q)) return false;
          return true;
        })
        .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.createdAt.localeCompare(b.createdAt)),
    [todos, f, today],
  );

  async function move(id: string, status: TodoStatus) {
    const t = todos.find((x) => x.id === id);
    if (!t || t.status === status) return;
    setTodos((all) => all.map((x) => (x.id === id ? { ...x, status } : x))); // 樂觀更新
    try {
      const saved = await api<Todo>(`/api/todos/${id}`, { method: "PATCH", json: { status } });
      setTodos((all) => mergeTodo(all, saved));
    } catch {
      setTodos((all) => upsert(all, t));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${INPUT} max-w-52 py-1.5`} value={f.who} onChange={(e) => setF({ ...f, who: e.target.value as Filter["who"] })} aria-label="追蹤者">
          <option value="">全部追蹤者</option>
          {(["管委會", "物業", "建商", "外包廠商"] as RoleGroup[]).map((g) => (
            <optgroup key={g} label={g}>
              <option value={g}>{g}（全部）</option>
              {ROLES.filter((r) => r.group === g && r.short !== g).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.short}
                  {roles.get(r.id)?.name ? ` ${roles.get(r.id)!.name}` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select className={`${INPUT} max-w-64 py-1.5`} value={f.meetingId} onChange={(e) => setF({ ...f, meetingId: e.target.value })} aria-label="來源會議">
          <option value="">全部會議</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {fmtDate(m.date)} {m.title}
            </option>
          ))}
        </select>
        {events.length > 0 && (
          <select className={`${INPUT} max-w-56 py-1.5`} value={f.eventId} onChange={(e) => setF({ ...f, eventId: e.target.value })} aria-label="情境事件">
            <option value="">全部情境事件</option>
            {[...events]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {playbookOf(e.playbookId)?.icon} {fmtDate(e.date)} {e.name}
                </option>
              ))}
          </select>
        )}
        <input className={`${INPUT} max-w-52 py-1.5`} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="搜尋標題、說明、地點" />
        <label className="flex items-center gap-1 text-xs text-slate-300">
          <input type="checkbox" checked={f.overdue} onChange={(e) => setF({ ...f, overdue: e.target.checked })} className="accent-rose-400" />
          只看逾期
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-300">
          <input type="checkbox" checked={f.hideDone} onChange={(e) => setF({ ...f, hideDone: e.target.checked })} className="accent-cyan-400" />
          隱藏已完成
        </label>
        <div className="flex-1" />
        <div className="flex overflow-hidden rounded-md border border-cyan-500/40 text-xs">
          {(
            [
              ["board", "看板"],
              ["table", "表格"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 ${view === k ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400"}`}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={() => openEvent()} className="rounded-md border border-cyan-500/40 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10" title="颱風、第三方檢測、開會等情境，自動產生各職責待辦">
          ＋ 情境事件
        </button>
        <button onClick={() => openTodo("new", f.who && ROLES.some((r) => r.id === f.who) ? { assignees: [f.who as RoleId] } : undefined)} className={BTN_PRIMARY}>
          ＋ 新增待辦
        </button>
      </div>

      {view === "board" ? (
        <div className="grid min-h-0 flex-1 auto-cols-[minmax(230px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1">
          {TODO_STATUS.map((s) => {
            const col = shown.filter((t) => t.status === s);
            return (
              <div
                key={s}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && move(dragId, s)}
                className="flex min-h-0 flex-col rounded-lg border border-cyan-500/20 bg-white/[0.02]"
              >
                <div className="flex items-center gap-2 border-b border-cyan-500/20 px-3 py-2">
                  <StatusBadge status={s} />
                  <span className="text-xs text-slate-400">{col.length}</span>
                </div>
                <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                  {col.map((t) => (
                    <li key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)}>
                      <TodoCard t={t} onClick={() => openTodo(t)} />
                    </li>
                  ))}
                  {col.length === 0 && <li className="py-6 text-center text-[11px] text-slate-600">拖曳卡片到這裡</li>}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-cyan-500/20">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 bg-[#06142a] text-left text-xs text-cyan-300">
              <tr className="border-b border-cyan-500/30">
                <th className="px-3 py-2">狀態</th>
                <th className="px-3 py-2">待辦事項</th>
                <th className="px-3 py-2">追蹤者</th>
                <th className="px-3 py-2">期限</th>
                <th className="px-3 py-2">位置</th>
                <th className="px-3 py-2">來源會議</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} onClick={() => openTodo(t)} className="cursor-pointer border-b border-cyan-500/10 hover:bg-cyan-400/5">
                  <td className="px-3 py-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="max-w-md px-3 py-2 text-cyan-50">
                    {t.priority === "高" && <span className="mr-1 text-rose-300">●</span>}
                    {t.after && t.status === "未開始" && todos.some((x) => x.id === t.after && x.status !== "已完成") && <span className="mr-1 text-amber-300" title="等待前一步">⏳</span>}
                    {t.title}
                  </td>
                  <td className="px-3 py-2">
                    <RoleChips ids={t.assignees} />
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 font-mono text-xs ${isOverdue(t, today) ? "text-rose-300" : "text-slate-300"}`}>
                    {fmtDate(t.due)}
                    {isOverdue(t, today) && " 逾期"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{t.location?.label ?? "—"}</td>
                  <td className="max-w-48 truncate px-3 py-2 text-xs text-slate-400">{meetings.find((m) => m.id === t.meetingId)?.title ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="py-10 text-center text-xs text-slate-500">沒有符合的待辦事項</p>}
        </div>
      )}
    </div>
  );
}

function TodoCard({ t, onClick }: { t: Todo; onClick: () => void }) {
  const { todos, building } = useMgmt();
  const prev = t.after ? todos.find((x) => x.id === t.after) : undefined;
  const waiting = !!prev && prev.status !== "已完成" && t.status === "未開始";
  const over = isOverdue(t) && !waiting;
  const link = t.link && TODO_LINKS[t.link];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}
      className={`w-full cursor-pointer rounded-md border bg-[#071a33] p-2.5 text-left transition hover:border-cyan-300 ${over ? "border-rose-400/60" : "border-cyan-500/25"}`}
    >
      <div className="flex gap-1.5">
        <span className="mt-1 h-full w-1 shrink-0 self-stretch rounded" style={{ background: GROUP_COLOR[roleOf(t.assignees[0] ?? "gm").group] }} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm text-cyan-50">
            {t.priority === "高" && <span className="mr-1 text-rose-300">●</span>}
            {t.title}
          </p>
          <div className="mt-1.5">
            <RoleChips ids={t.assignees} max={2} />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-slate-400">
            {t.due && <span className={over ? "text-rose-300" : ""}>⏰ {fmtDate(t.due)}{over && " 逾期"}</span>}
            {t.location && <span>📍 {t.location.label}</span>}
          </p>
          {waiting && <p className="mt-1 line-clamp-1 text-[11px] text-amber-300">⏳ 等待：{prev.title.replace(/^.+?｜/, "")}</p>}
          {link && (
            <a href={link.href(building.id)} onClick={(e) => e.stopPropagation()} className="mt-1 inline-block rounded bg-cyan-400/10 px-1.5 py-0.5 text-[11px] text-cyan-200 hover:bg-cyan-400/20">
              {link.label} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
