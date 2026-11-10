"use client";

import { useState } from "react";
import { TODO_PRIORITY, TODO_STATUS, type PlanRef, type RoleId, type Todo } from "@/lib/mgmt";
import { googleCalendarUrl } from "@/lib/ics";
import { roleOf } from "@/lib/mgmt";
import { api, BTN_DANGER, BTN_GHOST, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, Select } from "../ui";
import { fmtDate, mergeTodo, PlanRefPicker, RolePicker, TODAY, TODO_LINKS, useMgmt } from "./common";

export default function TodoDialog({ todo, preset, onClose }: { todo?: Todo; preset?: Partial<Todo>; onClose: () => void }) {
  const { building, todos, setTodos, meetings, vendors } = useMgmt();
  const base = { ...preset, ...todo };
  const [f, setF] = useState({
    title: base.title ?? "",
    description: base.description ?? "",
    assignees: (base.assignees ?? []) as RoleId[],
    status: base.status ?? ("未開始" as Todo["status"]),
    priority: base.priority ?? ("中" as Todo["priority"]),
    start: base.start ?? TODAY(),
    due: base.due ?? "",
    meetingId: base.meetingId ?? "",
    vendorId: base.vendorId ?? "",
    location: base.location as PlanRef | undefined,
    after: base.after ?? "",
    afterDays: base.afterDays ?? 7,
  });
  const [logNote, setLogNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    if (!f.title.trim()) return setError("請填寫標題");
    if (!f.assignees.length) return setError("請選擇至少一位追蹤者");
    setBusy(true);
    setError("");
    try {
      const body = { ...f, buildingId: building.id, location: f.location ?? null, logNote };
      const saved = await api<Todo>(todo ? `/api/todos/${todo.id}` : "/api/todos", { method: todo ? "PATCH" : "POST", json: body });
      setTodos((all) => mergeTodo(all, saved));
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!todo || !confirm(`刪除待辦「${todo.title}」？`)) return;
    await api(`/api/todos/${todo.id}`, { method: "DELETE" });
    setTodos((all) => all.filter((x) => x.id !== todo.id));
    onClose();
  }

  const meeting = meetings.find((m) => m.id === f.meetingId);
  const prev = todos.find((t) => t.id === f.after);
  const waiting = !!prev && prev.status !== "已完成" && f.status === "未開始";
  const link = base.link && TODO_LINKS[base.link];

  return (
    <Modal
      wide
      title={todo ? "編輯待辦事項" : "新增待辦事項"}
      subtitle={meeting ? `來源：${meeting.title}（${fmtDate(meeting.date)}）` : undefined}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {todo && (
            <button type="button" onClick={remove} className={BTN_DANGER}>
              刪除
            </button>
          )}
          {todo?.due && (
            <a
              href={googleCalendarUrl({ uid: todo.id, title: `⏰ ${todo.title}`, start: todo.due, description: `追蹤者：${todo.assignees.map((r) => roleOf(r).short).join("、")}\n${todo.description}`, location: todo.location?.label })}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-300 hover:underline"
            >
              📅 加入 Google 日曆
            </a>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? "儲存中…" : "儲存"}
          </button>
        </>
      }
    >
      {waiting && (
        <p className="rounded-md bg-amber-500/15 px-3 py-2 text-xs text-amber-100">
          ⏳ 等待前一步「{prev.title}」完成；完成後本項會自動開始，期限為完成日起 {f.afterDays} 天（目前日期為預估）。
        </p>
      )}
      {link && (
        <a href={link.href(building.id)} className="inline-block rounded bg-cyan-400/10 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-400/20">
          {link.label} ↗ 前往登記
        </a>
      )}
      <Field label="標題 *">
        <input className={INPUT} value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} autoFocus={!todo} />
      </Field>
      <div className="space-y-1">
        <span className="text-xs text-cyan-300">需追蹤者 *</span>
        <RolePicker value={f.assignees} onChange={(v) => set("assignees", v)} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="狀態">
          <Select value={f.status} options={TODO_STATUS} onChange={(v) => set("status", v)} />
        </Field>
        <Field label="優先度">
          <Select value={f.priority} options={TODO_PRIORITY} onChange={(v) => set("priority", v)} />
        </Field>
        <Field label="開始日">
          <input type="date" className={INPUT} value={f.start} onChange={(e) => set("start", e.target.value)} />
        </Field>
        <Field label="期限">
          <input type="date" className={INPUT} value={f.due} onChange={(e) => set("due", e.target.value)} />
        </Field>
      </div>
      <div className="space-y-1">
        <span className="text-xs text-cyan-300">相關位置（會顯示在平面圖上）</span>
        <PlanRefPicker value={f.location} onChange={(v) => set("location", v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="來源會議">
          <select className={INPUT} value={f.meetingId} onChange={(e) => set("meetingId", e.target.value)}>
            <option value="">（無）</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {fmtDate(m.date)} {m.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="負責廠商">
          <select className={INPUT} value={f.vendorId} onChange={(e) => set("vendorId", e.target.value)}>
            <option value="">（無）</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.category} · {v.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label="前一步（完成後本項才開始，例：等檢測報告 → 送建商）">
          <select className={INPUT} value={f.after} onChange={(e) => set("after", e.target.value)}>
            <option value="">（無）</option>
            {todos
              .filter((t) => t.id !== todo?.id && (t.status !== "已完成" || t.id === f.after))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.status === "已完成" ? "✓ " : ""}
                  {t.title}
                </option>
              ))}
          </select>
        </Field>
        <Field label="完成後幾天到期">
          <input type="number" min={0} max={365} className={INPUT} value={f.afterDays} disabled={!f.after} onChange={(e) => set("afterDays", Number(e.target.value))} />
        </Field>
      </div>
      <Field label="說明 / 辦理情形">
        <textarea className={`${INPUT} min-h-24`} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={4000} />
      </Field>
      {todo && (
        <div className="space-y-2">
          <span className="text-xs text-cyan-300">追蹤紀錄</span>
          <ol className="max-h-40 space-y-1 overflow-y-auto border-l border-cyan-500/30 pl-3 text-xs">
            {[...todo.log].reverse().map((l, i) => (
              <li key={i} className="text-slate-300">
                <span className="mr-2 font-mono text-slate-500">{l.at.slice(0, 16).replace("T", " ")}</span>
                {l.text}
              </li>
            ))}
          </ol>
          <input className={INPUT} value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="新增追蹤紀錄（儲存時寫入），例：已電話聯絡廠商，預計下週到場" maxLength={1000} />
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
