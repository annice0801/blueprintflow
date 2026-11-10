"use client";

import { useState } from "react";
import { roleOf, type Todo } from "@/lib/mgmt";
import { planDates, PLAYBOOKS, playbookOf, type CommunityEvent } from "@/lib/playbooks";
import { api, BTN_GHOST, BTN_PRIMARY, ErrorText, Field, INPUT, Modal } from "../ui";
import { fmtDate, TODAY, useMgmt } from "./common";

export type EventPreset = { playbookId?: string; date?: string; name?: string; meetingId?: string };

/** 套用情境範本：選範本 → 填日期 → 勾選要建立的待辦（預覽日期與負責人） */
export default function EventDialog({ preset, onClose }: { preset?: EventPreset; onClose: () => void }) {
  const { building, setTodos, setEvents, goTab } = useMgmt();
  const [pid, setPid] = useState(preset?.playbookId ?? PLAYBOOKS[0].id);
  const pb = playbookOf(pid)!;
  const [name, setName] = useState(preset?.name ?? "");
  const [date, setDate] = useState(preset?.date ?? TODAY());
  const [note, setNote] = useState("");
  const [off, setOff] = useState<Set<string>>(() => new Set(pb.steps.filter((s) => s.optional).map((s) => s.key)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ event: CommunityEvent; todos: Todo[] } | null>(null);

  const keys = pb.steps.filter((s) => !off.has(s.key)).map((s) => s.key);
  const dates = date ? planDates(pb, date, keys) : new Map<string, string>();

  function pick(id: string) {
    setPid(id);
    setOff(new Set(playbookOf(id)!.steps.filter((s) => s.optional).map((s) => s.key)));
  }

  async function submit() {
    if (!date) return setError("請填寫日期");
    if (!keys.length) return setError("請至少勾選一項待辦");
    setBusy(true);
    setError("");
    try {
      const res = await api<{ event: CommunityEvent; todos: Todo[] }>("/api/events", {
        method: "POST",
        json: { buildingId: building.id, playbookId: pid, name, date, note, keys, meetingId: preset?.meetingId },
      });
      setTodos((all) => [...all, ...res.todos]);
      setEvents((all) => [...all, res.event]);
      setDone(res);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (done)
    return (
      <Modal
        title="已建立情境待辦"
        subtitle={`${pb.icon} ${done.event.name} · ${fmtDate(done.event.date)}`}
        onClose={onClose}
        footer={
          <>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => {
                goTab("timeline", { cal: "month", date: done.event.date });
                onClose();
              }}
              className={BTN_GHOST}
            >
              在月曆查看
            </button>
            <button
              type="button"
              onClick={() => {
                goTab("todos", { event: done.event.id });
                onClose();
              }}
              className={BTN_PRIMARY}
            >
              前往待辦追蹤
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          已建立 {done.todos.length} 筆待辦，已排入日／月／年曆。有「⏳」的項目會在前一步完成後自動開始。
        </p>
      </Modal>
    );

  return (
    <Modal
      wide
      title="套用情境"
      subtitle="依情境自動產生各職責待辦，可取消不需要的項目"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <span className="text-xs text-slate-400">將建立 {keys.length} 筆待辦</span>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? "建立中…" : "建立待辦"}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {PLAYBOOKS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pick(p.id)}
            aria-pressed={pid === p.id}
            className={`rounded-full border px-3 py-1.5 text-sm ${pid === p.id ? "border-cyan-300 bg-cyan-400/20 text-cyan-50" : "border-slate-600 text-slate-300 hover:border-cyan-500/60"}`}
          >
            {p.icon} {p.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="名稱">
          <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder={pb.namePlaceholder} />
        </Field>
        <Field label={pb.dateLabel}>
          <input type="date" required className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <ul className="divide-y divide-cyan-500/10 rounded-lg border border-cyan-500/20">
        {pb.steps.map((s) => {
          const on = !off.has(s.key);
          const after = s.after && pb.steps.find((x) => x.key === s.after);
          const waits = after && !off.has(after.key);
          return (
            <li key={s.key} className={`flex items-start gap-2 px-3 py-2 text-sm ${on ? "" : "opacity-50"}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => setOff((x) => (x.has(s.key) ? new Set([...x].filter((k) => k !== s.key)) : new Set([...x, s.key])))}
                className="mt-1 accent-cyan-400"
                aria-label={s.title}
              />
              <div className="min-w-0 flex-1">
                <p className="text-cyan-50">{s.title}</p>
                <p className="text-[11px] text-slate-400">
                  {s.assignees.map((r) => roleOf(r).short).join("、")}
                  {waits && <span className="ml-2 text-amber-300">⏳ 「{after.title}」完成後 {s.offset} 天</span>}
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs text-slate-300">{on && dates.get(s.key) ? fmtDate(!waits && dates.get(s.key)! < TODAY() ? TODAY() : dates.get(s.key)!) : ""}</span>
            </li>
          );
        })}
      </ul>
      <Field label="備註（會附在每筆待辦說明）">
        <textarea rows={2} className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
