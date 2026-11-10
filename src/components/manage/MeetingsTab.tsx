"use client";

import { useEffect, useRef, useState } from "react";
import { ATTENDANCE, MEETING_TYPES, TODO_STATUS, roleOf, type Attendance, type Meeting, type MeetingDraft, type PlanRef, type RoleId, type Term, type Todo } from "@/lib/mgmt";
import { api, BTN_DANGER, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, Select } from "../ui";
import { fmtDate, planLink, PlanRefPicker, RoleChips, RolePicker, StatusBadge, upsert, useMgmt, type MeetingSummary } from "./common";
import { STATUS_MARK } from "./terms";
import { googleCalendarUrl } from "@/lib/ics";
import { addDays, playbookOf, type CommunityEvent, type PlaybookSuggestion } from "@/lib/playbooks";

type Parsed = { file: { name: string; original: string }; text: string; draft: MeetingDraft; ocr?: boolean; suggestions?: PlaybookSuggestion[] };

export default function MeetingsTab({ focusId }: { focusId?: string }) {
  const { meetings: all, terms, building } = useMgmt();
  const [termId, setTermId] = useState("");
  const term = terms.find((t) => t.id === termId);
  const meetings = term ? all.filter((m) => m.date && (!term.start || m.date >= term.start) && (!term.end || m.date <= term.end)) : all;
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [openId, setOpenId] = useState<string | null>(focusId ?? null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.set("file", file);
    try {
      setParsed(await api<Parsed>("/api/meetings/parse", { method: "POST", body: fd }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const open = all.find((m) => m.id === openId);

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <div className="flex min-h-0 flex-col gap-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void upload(e.dataTransfer.files[0]);
          }}
          className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${drag ? "border-cyan-300 bg-cyan-400/10" : "border-cyan-500/40"}`}
        >
          <p className="text-sm text-cyan-100">拖曳會議紀錄到這裡，或</p>
          <button onClick={() => input.current?.click()} disabled={uploading} className={`${BTN_PRIMARY} mt-2`}>
            {uploading ? "解析中…（掃描檔需較久）" : "選擇檔案上傳"}
          </button>
          <p className="mt-2 text-[11px] text-slate-400">支援 .docx、.pdf（含掃描檔，自動文字辨識，每頁約 3 秒）、.txt。系統會找出提到的地點、待辦事項、追蹤者與期限，確認後才存檔。</p>
          <a href={`/api/meetings/agenda?buildingId=${building.id}`} className="mt-2 inline-block text-xs text-cyan-300 hover:underline">
            📝 依前次會議代辦，產生下次會議議程（Word）
          </a>
          <input
            ref={input}
            type="file"
            accept=".docx,.pdf,.txt,.md"
            className="hidden"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {error && (
            <div className="mt-3 text-left">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-cyan-500/20">
          <div className="flex items-center justify-between border-b border-cyan-500/20 px-3 py-2 text-sm">
            <span className="font-semibold text-cyan-100">會議紀錄</span>
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <select className="rounded border border-cyan-500/30 bg-slate-950/60 px-1.5 py-0.5 text-xs text-cyan-50" value={termId} onChange={(e) => setTermId(e.target.value)} aria-label="依屆次篩選">
                <option value="">全部屆次</option>
                {terms
                  .filter((t) => t.kind === "committee")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
              {meetings.length} 份
            </span>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-cyan-500/10 overflow-y-auto">
            {meetings.length === 0 && <li className="px-3 py-8 text-center text-xs text-slate-500">尚未匯入會議紀錄</li>}
            {meetings.map((m) => (
              <MeetingRow key={m.id} m={m} active={m.id === openId} onClick={() => setOpenId(m.id)} />
            ))}
          </ul>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto rounded-lg border border-cyan-500/20">
        {open ? <MeetingDetail key={open.id} m={open} onDeleted={() => setOpenId(null)} /> : <p className="px-4 py-10 text-center text-sm text-slate-500">選擇左側會議查看內容</p>}
      </div>

      {parsed && (
        <ImportReview
          parsed={parsed}
          onClose={async (saved) => {
            if (!saved) await api(`/api/meetings/parse?file=${parsed.file.name}`, { method: "DELETE" }).catch(() => {});
            else setOpenId(saved);
            setParsed(null);
          }}
        />
      )}
    </div>
  );
}

function MeetingRow({ m, active, onClick }: { m: MeetingSummary; active: boolean; onClick: () => void }) {
  const { todos } = useMgmt();
  const mine = todos.filter((t) => t.meetingId === m.id);
  const open = mine.filter((t) => t.status !== "已完成").length;
  return (
    <li>
      <button onClick={onClick} className={`w-full px-3 py-2.5 text-left hover:bg-cyan-400/5 ${active ? "bg-cyan-400/10" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-cyan-300">{fmtDate(m.date)}</span>
          <span className="rounded border border-cyan-500/30 px-1.5 text-[10px] text-cyan-200">{m.type}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-cyan-50">{m.title}</p>
        <p className="text-[11px] text-slate-400">
          📍 {m.mentions.length} 個地點 · ✅ 待辦 {mine.length}（未完成 {open}）
        </p>
      </button>
    </li>
  );
}

function MeetingDetail({ m, onDeleted }: { m: MeetingSummary; onDeleted: () => void }) {
  const { building, todos, setMeetings, setTodos, openTodo, openEvent } = useMgmt();
  const [text, setText] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const mine = todos.filter((t) => t.meetingId === m.id);

  useEffect(() => {
    if (!showText || text !== null) return;
    let alive = true;
    api<Meeting>(`/api/meetings/${m.id}`).then((full) => alive && setText(full.text));
    return () => {
      alive = false;
    };
  }, [showText, text, m.id]);

  async function remove() {
    if (!confirm(`刪除「${m.title}」？原檔與地點標記會刪除；匯入的待辦事項會保留。`)) return;
    await api(`/api/meetings/${m.id}`, { method: "DELETE" });
    setMeetings((all) => all.filter((x) => x.id !== m.id));
    setTodos((all) => all.map((t) => (t.meetingId === m.id ? { ...t, meetingId: undefined } : t)));
    onDeleted();
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-cyan-300">{fmtDate(m.date)}</span>
          <span className="rounded border border-cyan-500/30 px-1.5 text-cyan-200">{m.type}</span>
          {m.place && <span>📍 {m.place}</span>}
        </div>
        <h3 className="mt-1 text-lg font-semibold text-cyan-50">{m.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {m.file && (
            <a href={`/api/docs/${m.file.name}`} target="_blank" rel="noreferrer" className={BTN_OUTLINE}>
              📄 原檔：{m.file.original}
            </a>
          )}
          <button onClick={() => setShowText((v) => !v)} className={BTN_OUTLINE}>
            {showText ? "隱藏全文" : "顯示全文"}
          </button>
          <button onClick={() => openTodo("new", { meetingId: m.id, start: m.date })} className={BTN_OUTLINE}>
            ＋ 新增待辦
          </button>
          {m.date && (
            <a href={googleCalendarUrl({ uid: m.id, title: m.title, start: m.date, location: m.place })} target="_blank" rel="noreferrer" className={BTN_OUTLINE}>
              📅 日曆
            </a>
          )}
          <div className="flex-1" />
          <button onClick={remove} className={BTN_DANGER}>
            刪除會議
          </button>
        </div>
      </div>

      {showText && <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-black/30 p-3 text-xs leading-relaxed text-slate-300">{text ?? "載入中…"}</pre>}

      <section>
        <h4 className="mb-2 text-sm font-semibold text-cyan-100">出缺席（{m.attendance?.length ?? 0}）</h4>
        {m.attendance?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {m.attendance.map((a) => (
              <span key={a.name} className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-xs text-slate-200">
                <span className={STATUS_MARK[a.status].cls}>{STATUS_MARK[a.status].mark}</span>
                {a.title && <span className="text-slate-400">{a.title}</span>}
                {a.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">未偵測到出席名單</p>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-sm font-semibold text-cyan-100">提到的地點（{m.mentions.length}）</h4>
        {m.mentions.length === 0 && <p className="text-xs text-slate-500">沒有對應到平面圖的地點</p>}
        <ul className="space-y-2">
          {m.mentions.map((x) => (
            <li key={x.id} className="rounded-md border border-cyan-500/20 bg-white/[0.02] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-cyan-50">📍 {x.label}</span>
                <span className="text-[11px] text-slate-500">{x.floor === "RF" ? "R 樓" : x.floor}</span>
                <div className="flex-1" />
                <a href={planLink(building.id, x)} className="text-xs text-cyan-300 hover:underline">
                  在平面圖查看 ↗
                </a>
              </div>
              {x.snippet && <p className="mt-1 text-xs leading-relaxed text-slate-400">「{x.snippet}」</p>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h4 className="text-sm font-semibold text-cyan-100">待辦事項（{mine.length}）</h4>
          <div className="flex-1" />
          <button onClick={() => openEvent({ meetingId: m.id, date: m.date })} className="text-xs text-cyan-300 hover:underline">
            ＋ 套用情境（檢測、颱風、下次會議…）
          </button>
        </div>
        <ul className="divide-y divide-cyan-500/10 rounded-md border border-cyan-500/20">
          {mine.length === 0 && <li className="px-3 py-4 text-center text-xs text-slate-500">無</li>}
          {mine.map((t) => (
            <li key={t.id}>
              <button onClick={() => openTodo(t)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-cyan-400/5">
                <StatusBadge status={t.status} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-cyan-50">{t.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <RoleChips ids={t.assignees} />
                    {t.due && <span>期限 {fmtDate(t.due)}</span>}
                    {t.location && <span>📍 {t.location.label}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type DraftTodo = MeetingDraft["todos"][number] & { on: boolean; editRoles?: boolean };
type DraftMention = MeetingDraft["mentions"][number] & { on: boolean };

function ImportReview({ parsed, onClose }: { parsed: Parsed; onClose: (savedId?: string) => void }) {
  const { building, setMeetings, setTodos, setTerms, setEvents, roles } = useMgmt();
  const d = parsed.draft;
  // 內容提到颱風、第三方檢測、下次會議…→ 建議套用情境；文中有日期的預設勾選
  const [suggest, setSuggest] = useState(() =>
    (parsed.suggestions ?? []).map((x) => ({ ...x, on: !!x.date, name: "", date: x.date || (x.playbookId === "meeting" ? addDays(d.date || new Date().toISOString().slice(0, 10), 30) : d.date) })),
  );
  const [meta, setMeta] = useState({ title: d.title, type: d.type, date: d.date, place: d.place });
  const [mentions, setMentions] = useState<DraftMention[]>(d.mentions.map((x) => ({ ...x, on: true })));
  const [todos, setDraftTodos] = useState<DraftTodo[]>(d.todos.map((t) => ({ ...t, on: true })));
  const [applyRoles, setApplyRoles] = useState(d.roleNames.length > 0 && d.roleNames.some((r) => roles.get(r.id)?.name !== r.name));
  const [termName, setTermName] = useState(d.termName);
  const [attendance, setAttendance] = useState<Attendance[]>(d.attendance);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patchTodo = (i: number, p: Partial<DraftTodo>) => setDraftTodos((all) => all.map((t, j) => (j === i ? { ...t, ...p } : t)));

  async function save() {
    if (!meta.title.trim()) return setError("請填寫會議名稱");
    setBusy(true);
    setError("");
    try {
      const res = await api<{ meeting: Meeting; todos: Todo[]; terms: Term[] }>("/api/meetings", {
        method: "POST",
        json: {
          buildingId: building.id,
          ...meta,
          file: parsed.file,
          text: parsed.text,
          mentions: mentions.filter((x) => x.on),
          todos: todos.filter((t) => t.on).map((t) => ({ title: t.title, description: t.description, assignees: t.assignees, due: t.due, status: t.status, location: t.location })),
          roleNames: applyRoles ? d.roleNames : [],
          termName,
          attendance,
        },
      });
      const summary: MeetingSummary = { ...res.meeting, textLength: parsed.text.length };
      delete (summary as Partial<Meeting>).text;
      setMeetings((all) => upsert(all, summary).sort((a, b) => b.date.localeCompare(a.date)));
      setTodos((all) => [...all, ...res.todos]);
      for (const sg of suggest.filter((x) => x.on && x.date)) {
        const ev = await api<{ event: CommunityEvent; todos: Todo[] }>("/api/events", {
          method: "POST",
          json: { buildingId: building.id, playbookId: sg.playbookId, name: sg.name, date: sg.date, meetingId: res.meeting.id, note: `來源：${meta.title}\n「${sg.reason}」` },
        });
        setTodos((all) => [...all, ...ev.todos]);
        setEvents((all) => [...all, ev.event]);
      }
      if (res.terms.length) setTerms((list) => res.terms.reduce((acc, t) => upsert(acc, t), list));
      onClose(res.meeting.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const onTodos = todos.filter((t) => t.on).length;
  return (
    <Modal
      wide
      title="確認匯入會議紀錄"
      subtitle={parsed.file.original}
      onClose={() => onClose()}
      onSubmit={save}
      footer={
        <>
          <span className="text-xs text-slate-400">
            將建立 {mentions.filter((x) => x.on).length} 個地點標記、{onTodos} 筆待辦
            {suggest.some((x) => x.on) && `、${suggest.filter((x) => x.on).length} 組情境待辦`}
          </span>
          <div className="flex-1" />
          <button type="button" onClick={() => onClose()} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? "匯入中…" : "確認匯入"}
          </button>
        </>
      }
    >
      {parsed.ocr && (
        <p className="rounded-md bg-amber-500/15 px-3 py-2 text-xs text-amber-100">
          這是掃描檔，內容由文字辨識（OCR）取得，人名、數字與日期可能有錯字，請逐項核對後再匯入。原檔會一併保存。
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="會議名稱" className="col-span-2">
          <input className={INPUT} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        </Field>
        <Field label="類型">
          <Select value={meta.type} options={MEETING_TYPES} onChange={(type) => setMeta({ ...meta, type })} />
        </Field>
        <Field label="日期">
          <input type="date" className={INPUT} value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
        </Field>
        <Field label="地點" className="col-span-2 sm:col-span-4">
          <input className={INPUT} value={meta.place} onChange={(e) => setMeta({ ...meta, place: e.target.value })} />
        </Field>
      </div>

      {d.roleNames.length > 0 && (
        <div className="space-y-2 rounded-md border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs text-slate-200">
          <label className="flex cursor-pointer items-start gap-2">
            <input type="checkbox" checked={applyRoles} onChange={(e) => setApplyRoles(e.target.checked)} className="mt-0.5 accent-violet-400" />
            <span>
              偵測到職務名單，寫入組織架構的屆次：
              <span className="text-violet-200">{d.roleNames.map((r) => `${roleOf(r.id).short} ${r.name}`).join("、")}</span>
            </span>
          </label>
          {applyRoles && (
            <label className="flex items-center gap-2 pl-5">
              管委會屆次
              <input className={`${INPUT} w-32 py-1 text-xs`} value={termName} onChange={(e) => setTermName(e.target.value)} placeholder="例：第一屆" />
              <span className="text-slate-400">（沒有同名屆次會自動建立）</span>
            </label>
          )}
        </div>
      )}

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-cyan-100">出缺席名單（{attendance.length}）</h4>
        {attendance.length === 0 && <p className="text-xs text-slate-500">未偵測到出席名單，可手動新增</p>}
        <div className="flex flex-wrap gap-1.5">
          {attendance.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-white/5 py-0.5 pl-2 pr-1 text-xs">
              {a.title && <span className="text-slate-400">{a.title}</span>}
              <input className="w-14 bg-transparent text-slate-100 outline-none" value={a.name} onChange={(e) => setAttendance((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="姓名" />
              <select className="bg-transparent text-cyan-200 outline-none" value={a.status} onChange={(e) => setAttendance((l) => l.map((x, j) => (j === i ? { ...x, status: e.target.value as Attendance["status"] } : x)))} aria-label="狀態">
                {ATTENDANCE.map((s) => (
                  <option key={s} className="bg-[#06142a]">
                    {s}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setAttendance((l) => l.filter((_, j) => j !== i))} className="px-1 text-rose-300" aria-label="移除">
                ✕
              </button>
            </span>
          ))}
          <button type="button" onClick={() => setAttendance((l) => [...l, { name: "", status: "出席", title: "" }])} className="rounded border border-dashed border-cyan-500/40 px-2 py-0.5 text-xs text-cyan-300">
            ＋ 新增
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-cyan-100">提到的地點（將標記在平面圖）</h4>
          <div className="flex-1" />
          <button type="button" className="text-xs text-cyan-300" onClick={() => setMentions((a) => a.map((x) => ({ ...x, on: !a.every((y) => y.on) })))}>
            全選 / 全不選
          </button>
        </div>
        {mentions.length === 0 && <p className="text-xs text-slate-500">沒有偵測到對應地點</p>}
        {mentions.map((x, i) => (
          <div key={i} className={`rounded-md border px-3 py-2 ${x.on ? "border-cyan-500/40 bg-cyan-400/5" : "border-slate-700 opacity-60"}`}>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={x.on} onChange={(e) => setMentions((a) => a.map((y, j) => (j === i ? { ...y, on: e.target.checked } : y)))} className="accent-cyan-400" />
              <span className="text-sm text-cyan-50">📍 {x.label}</span>
              <span className="text-[11px] text-slate-500">{x.floor}</span>
            </label>
            <p className="mt-1 text-xs text-slate-400">「{x.snippet}」</p>
            {x.on && (
              <div className="mt-2">
                <PlanRefPicker value={x} onChange={(v) => v && setMentions((a) => a.map((y, j) => (j === i ? { ...y, ...v } : y)))} />
              </div>
            )}
          </div>
        ))}
      </section>

      {suggest.length > 0 && (
        <section className="space-y-2 rounded-lg border border-pink-400/30 bg-pink-400/5 p-3">
          <h4 className="text-sm font-semibold text-cyan-100">建議套用情境（勾選後一併建立各職責待辦，並排入日／月／年曆）</h4>
          {suggest.map((sg, i) => {
            const pb = playbookOf(sg.playbookId)!;
            const patch = (p: Partial<typeof sg>) => setSuggest((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
            return (
              <div key={sg.playbookId} className="grid grid-cols-[auto_1fr_10rem_9rem] items-center gap-2 text-sm">
                <input type="checkbox" checked={sg.on} onChange={(e) => patch({ on: e.target.checked })} className="accent-cyan-400" aria-label={pb.name} />
                <div className="min-w-0">
                  <p className="text-cyan-50">
                    {pb.icon} {pb.name}
                    <span className="ml-2 text-[11px] text-slate-400">{pb.steps.length} 項待辦</span>
                  </p>
                  <p className="truncate text-[11px] text-slate-400">「{sg.reason}」</p>
                </div>
                <input className={`${INPUT} py-1`} value={sg.name} onChange={(e) => patch({ name: e.target.value })} placeholder={pb.namePlaceholder} />
                <input type="date" className={`${INPUT} py-1`} value={sg.date} onChange={(e) => patch({ date: e.target.value })} title={pb.dateLabel} />
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-cyan-100">待辦事項（{onTodos} / {todos.length}）</h4>
          <div className="flex-1" />
          <button type="button" className="text-xs text-cyan-300" onClick={() => setDraftTodos((a) => a.map((t) => ({ ...t, on: !a.every((y) => y.on) })))}>
            全選 / 全不選
          </button>
        </div>
        {todos.map((t, i) => (
          <div key={i} className={`space-y-2 rounded-md border px-3 py-2 ${t.on ? "border-cyan-500/40 bg-cyan-400/5" : "border-slate-700 opacity-60"}`}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={t.on} onChange={(e) => patchTodo(i, { on: e.target.checked })} className="accent-cyan-400" aria-label="匯入此待辦" />
              <input className={`${INPUT} py-1`} value={t.title} onChange={(e) => patchTodo(i, { title: e.target.value })} />
            </div>
            {t.on && (
              <>
                <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 text-xs">
                  <span className="text-slate-400">追蹤者</span>
                  <span className="flex flex-wrap items-center gap-1">
                    <RoleChips ids={t.assignees} max={4} />
                    <button type="button" className="text-cyan-300" onClick={() => patchTodo(i, { editRoles: !t.editRoles })}>
                      {t.editRoles ? "完成" : "修改"}
                    </button>
                  </span>
                  <select className={`${INPUT} w-24 py-1 text-xs`} value={t.status} onChange={(e) => patchTodo(i, { status: e.target.value as Todo["status"] })}>
                    {TODO_STATUS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <input type="date" className={`${INPUT} w-36 py-1 text-xs`} value={t.due} onChange={(e) => patchTodo(i, { due: e.target.value })} aria-label="期限" />
                </div>
                {t.editRoles && <RolePicker value={t.assignees} onChange={(v: RoleId[]) => patchTodo(i, { assignees: v.length ? v : t.assignees })} />}
                <PlanRefPicker value={t.location} onChange={(v: PlanRef | undefined) => patchTodo(i, { location: v })} />
                {t.description && <p className="whitespace-pre-wrap text-[11px] text-slate-400">{t.description}</p>}
              </>
            )}
          </div>
        ))}
      </section>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
