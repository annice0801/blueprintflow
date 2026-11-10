"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { REG_CATEGORIES, REG_STATUS, type Regulation } from "@/lib/mgmt";
import { api, BTN_DANGER, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, Select } from "../ui";
import { fmtDate, upsert, useMgmt } from "./common";

const STATUS_CLS: Record<Regulation["status"], string> = {
  草案: "text-slate-300",
  討論中: "text-amber-200",
  已通過: "text-sky-200",
  已公告: "text-emerald-300",
  廢止: "text-slate-500 line-through",
};

export default function RegulationsTab() {
  const params = useSearchParams();
  const { regulations, meetings, terms } = useMgmt();
  const [openId, setOpenId] = useState<string | null>(params.get("reg"));
  const [editing, setEditing] = useState<Regulation | "new" | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const shown = regulations
    .filter((r) => (!cat || r.category === cat) && (!q || `${r.title}${r.summary}${r.content}`.includes(q)))
    .sort((a, b) => REG_CATEGORIES.indexOf(a.category) - REG_CATEGORIES.indexOf(b.category) || b.updatedAt.localeCompare(a.updatedAt));
  const open = regulations.find((r) => r.id === openId);
  const hit = (text: string) => (q ? text.split("\n").filter((l) => l.includes(q)).slice(0, 3) : []);

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${INPUT} max-w-56 py-1.5`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋名稱、條文內容" />
          <select className={`${INPUT} max-w-36 py-1.5`} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="類別">
            <option value="">全部類別</option>
            {REG_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div className="flex-1" />
          <button onClick={() => setEditing("new")} className={BTN_PRIMARY}>
            ＋ 新增規範
          </button>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-cyan-500/10 overflow-y-auto rounded-lg border border-cyan-500/20">
          {shown.length === 0 && <li className="px-3 py-10 text-center text-xs text-slate-500">尚無規範條例。可新增社區規約、店面 / 裝潢 / 停車 / 寵物 / 包裹管理辦法等，並上傳原檔。</li>}
          {shown.map((r) => (
            <li key={r.id}>
              <button onClick={() => setOpenId(r.id)} className={`w-full px-3 py-2.5 text-left hover:bg-cyan-400/5 ${openId === r.id ? "bg-cyan-400/10" : ""}`}>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="rounded border border-cyan-500/30 px-1.5 text-cyan-200">{r.category}</span>
                  <span className={STATUS_CLS[r.status]}>{r.status}</span>
                  <span className="text-slate-500">{r.version}</span>
                  {r.effectiveDate && <span className="text-slate-500">生效 {fmtDate(r.effectiveDate)}</span>}
                </div>
                <p className="mt-0.5 text-sm text-cyan-50">{r.title}</p>
                {hit(r.content).map((l, i) => (
                  <p key={i} className="truncate text-[11px] text-amber-100/80">
                    …{l.trim()}
                  </p>
                ))}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-h-0 overflow-y-auto rounded-lg border border-cyan-500/20 p-4">
        {open ? (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded border border-cyan-500/30 px-1.5 text-cyan-200">{open.category}</span>
                <span className={STATUS_CLS[open.status]}>{open.status}</span>
                <span className="text-slate-400">{open.version}</span>
                <div className="flex-1" />
                <button onClick={() => setEditing(open)} className="text-cyan-300 hover:underline">
                  編輯 / 改版
                </button>
              </div>
              <h3 className="mt-1 text-lg font-semibold text-cyan-50">{open.title}</h3>
              <p className="mt-1 text-xs text-slate-400">
                {open.effectiveDate && `生效日 ${fmtDate(open.effectiveDate)}　`}
                {open.meetingId && `通過會議：${meetings.find((m) => m.id === open.meetingId)?.title ?? "—"}　`}
                {open.termId && `屆次：${terms.find((t) => t.id === open.termId)?.name ?? "—"}`}
              </p>
              {open.summary && <p className="mt-2 text-sm text-slate-300">{open.summary}</p>}
              {open.file && (
                <a href={`/api/docs/${open.file.name}`} target="_blank" rel="noreferrer" className={`${BTN_OUTLINE} mt-2 inline-block`}>
                  📄 原檔：{open.file.original}
                </a>
              )}
            </div>
            {open.content && <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md bg-black/30 p-3 text-xs leading-relaxed text-slate-300">{open.content}</pre>}
            <section>
              <h4 className="mb-1.5 text-sm font-semibold text-cyan-100">沿革</h4>
              <ol className="space-y-1 border-l border-cyan-500/30 pl-3 text-xs">
                {[...open.history].reverse().map((h, i) => (
                  <li key={i} className="text-slate-300">
                    <span className="mr-2 font-mono text-slate-500">{h.at.slice(0, 10)}</span>
                    {h.text}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">選擇左側規範查看條文</p>
        )}
      </div>
      {editing && (
        <RegulationDialog
          reg={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(r) => setOpenId(r.id)}
          onDeleted={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function RegulationDialog({ reg, onClose, onSaved, onDeleted }: { reg?: Regulation; onClose: () => void; onSaved: (r: Regulation) => void; onDeleted: () => void }) {
  const { building, meetings, terms, setRegulations } = useMgmt();
  const [f, setF] = useState({
    title: reg?.title ?? "",
    category: reg?.category ?? ("管理辦法" as Regulation["category"]),
    status: reg?.status ?? ("草案" as Regulation["status"]),
    version: reg?.version ?? "v1",
    effectiveDate: reg?.effectiveDate ?? "",
    meetingId: reg?.meetingId ?? "",
    termId: reg?.termId ?? "",
    summary: reg?.summary ?? "",
    content: reg?.content ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    if (!f.title.trim()) return setError("請填寫名稱");
    setBusy(true);
    const fd = new FormData();
    for (const [k, v] of Object.entries(f)) fd.set(k, v);
    fd.set("buildingId", building.id);
    if (file) fd.set("file", file);
    try {
      const saved = await api<Regulation>(reg ? `/api/regulations/${reg.id}` : "/api/regulations", { method: reg ? "PATCH" : "POST", body: fd });
      setRegulations((all) => upsert(all, saved));
      onSaved(saved);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function remove() {
    if (!reg || !confirm(`刪除「${reg.title}」？原檔會一併刪除。`)) return;
    await api(`/api/regulations/${reg.id}`, { method: "DELETE" });
    setRegulations((all) => all.filter((x) => x.id !== reg.id));
    onDeleted();
    onClose();
  }

  return (
    <Modal
      wide
      title={reg ? "編輯規範 / 改版" : "新增規範條例"}
      subtitle={reg ? "變更版本或狀態會自動記入沿革" : undefined}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {reg && (
            <button type="button" onClick={remove} className={BTN_DANGER}>
              刪除
            </button>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="名稱 *" className="col-span-2">
          <input className={INPUT} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="例：店面管理辦法" maxLength={120} autoFocus={!reg} />
        </Field>
        <Field label="類別">
          <Select value={f.category} options={REG_CATEGORIES} onChange={(v) => set("category", v)} />
        </Field>
        <Field label="狀態">
          <Select value={f.status} options={REG_STATUS} onChange={(v) => set("status", v)} />
        </Field>
        <Field label="版本">
          <input className={INPUT} value={f.version} onChange={(e) => set("version", e.target.value)} maxLength={20} />
        </Field>
        <Field label="生效日">
          <input type="date" className={INPUT} value={f.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
        </Field>
        <Field label="通過會議">
          <select className={INPUT} value={f.meetingId} onChange={(e) => set("meetingId", e.target.value)}>
            <option value="">（無）</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {fmtDate(m.date)} {m.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="屆次">
          <select className={INPUT} value={f.termId} onChange={(e) => set("termId", e.target.value)}>
            <option value="">（無）</option>
            {terms
              .filter((t) => t.kind === "committee")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <Field label="摘要">
        <input className={INPUT} value={f.summary} onChange={(e) => set("summary", e.target.value)} placeholder="例：新增側懸式招牌禁止規定" maxLength={1000} />
      </Field>
      <div className="space-y-1">
        <span className="text-xs text-cyan-300">原檔（.docx / .pdf / .txt，未填條文時自動帶入檔案文字）</span>
        <input
          type="file"
          accept=".docx,.pdf,.txt,.md"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-cyan-100"
        />
        {reg?.file && !file && <p className="text-[11px] text-slate-500">目前：{reg.file.original}（上傳新檔會取代並記入沿革）</p>}
      </div>
      <Field label="條文內容">
        <textarea className={`${INPUT} min-h-48 font-mono text-xs`} value={f.content} onChange={(e) => set("content", e.target.value)} maxLength={100000} placeholder="第一條　…" />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
