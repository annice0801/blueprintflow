"use client";

import { useState } from "react";
import { FEEDBACK_STATUS, FEEDBACK_TYPES, type Feedback, type FeedbackStatus, type MemberRow } from "@/lib/perms";
import { roleOf } from "@/lib/mgmt";
import { upsert } from "../manage/common";
import { api, BTN_PRIMARY, ErrorText, INPUT } from "../ui";
import { timeAgo } from "./charts";

const TONE: Record<FeedbackStatus, string> = { 新回報: "bg-amber-500/20 text-amber-200", 處理中: "bg-cyan-500/20 text-cyan-200", 已解決: "bg-emerald-500/20 text-emerald-200", 不處理: "bg-slate-500/20 text-slate-300" };

/** 意見回報收件匣：篩選、查看內容與截圖、改狀態、回覆回報者 */
export default function FeedbackPanel({ items, setItems, users }: { items: Feedback[]; setItems: React.Dispatch<React.SetStateAction<Feedback[]>>; users: MemberRow[] }) {
  const [status, setStatus] = useState<"" | FeedbackStatus | "open">("open");
  const [type, setType] = useState("");
  const [sel, setSel] = useState<string | null>(items[0]?.id ?? null);
  const rows = items.filter((f) => (status === "open" ? f.status === "新回報" || f.status === "處理中" : !status || f.status === status) && (!type || f.type === type));
  const cur = items.find((f) => f.id === sel) ?? rows[0];
  const count = (s: FeedbackStatus) => items.filter((f) => f.status === s).length;

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex flex-wrap gap-1 text-xs">
          {(
            [
              ["open", `待處理 ${count("新回報") + count("處理中")}`],
              ...FEEDBACK_STATUS.map((s) => [s, `${s} ${count(s)}`]),
              ["", "全部"],
            ] as [typeof status, string][]
          ).map(([k, l]) => (
            <button key={k || "all"} onClick={() => setStatus(k)} className={`rounded-md px-2.5 py-1 ${status === k ? "bg-cyan-400/20 text-cyan-50" : "text-slate-400 hover:bg-white/5"}`}>
              {l}
            </button>
          ))}
          <select className={`${INPUT} ml-auto max-w-32 py-1 text-xs`} value={type} onChange={(e) => setType(e.target.value)} aria-label="類型">
            <option value="">全部類型</option>
            {FEEDBACK_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-cyan-500/10 overflow-y-auto rounded-lg border border-cyan-500/20">
          {rows.length === 0 && <li className="py-10 text-center text-xs text-slate-500">沒有符合的回報</li>}
          {rows.map((f) => (
            <li key={f.id}>
              <button onClick={() => setSel(f.id)} className={`w-full px-3 py-2.5 text-left hover:bg-cyan-400/5 ${cur?.id === f.id ? "bg-cyan-400/10" : ""}`}>
                <p className="flex items-center gap-2 text-xs">
                  <span className={`rounded px-1.5 py-0.5 ${TONE[f.status]}`}>{f.status}</span>
                  <span className="text-slate-400">{f.type}</span>
                  <span className="ml-auto text-slate-500">{timeAgo(f.createdAt)}</span>
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-200">{f.message}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {f.name || f.email}
                  {f.photos.length > 0 && ` · 📎 ${f.photos.length}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {cur ? <Detail key={cur.id} f={cur} who={users.find((u) => u.email === cur.email)} onSaved={(x) => setItems((all) => upsert(all, x))} onRemoved={() => setItems((all) => all.filter((x) => x.id !== cur.id))} /> : <div />}
    </div>
  );
}

function Detail({ f, who, onSaved, onRemoved }: { f: Feedback; who?: MemberRow; onSaved: (f: Feedback) => void; onRemoved: () => void }) {
  const [reply, setReply] = useState(f.reply);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function patch(body: Partial<Pick<Feedback, "status" | "reply">>) {
    setBusy(true);
    setError("");
    try {
      onSaved(await api<Feedback>(`/api/admin/feedback/${f.id}`, { method: "PATCH", json: body }));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }
  async function remove() {
    if (!confirm("刪除這則回報？")) return;
    await api(`/api/admin/feedback/${f.id}`, { method: "DELETE" });
    onRemoved();
  }
  return (
    <section className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border border-cyan-500/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs ${TONE[f.status]}`}>{f.status}</span>
        <span className="text-sm text-slate-300">{f.type}</span>
        <span className="ml-auto text-xs text-slate-500">{new Date(f.createdAt).toLocaleString("zh-TW", { hour12: false })}</span>
      </div>
      <div className="text-xs text-slate-400">
        <p>
          回報者：<span className="text-cyan-50">{f.name || f.email}</span> · {f.email}
          {who?.membership.orgRole && ` · ${roleOf(who.membership.orgRole).short}`}
        </p>
        <p>
          頁面：
          <a href={f.page} target="_blank" rel="noreferrer" className="font-mono text-cyan-300 hover:underline">
            {f.page || "—"}
          </a>
        </p>
        <p className="truncate" title={f.userAgent}>
          裝置：{f.userAgent || "—"}
        </p>
      </div>
      <p className="whitespace-pre-wrap rounded-md bg-white/[0.03] p-3 text-sm text-slate-100">{f.message}</p>
      {f.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {f.photos.map((p) => (
            <a key={p} href={`/api/uploads/${p}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/uploads/${p}`} alt="回報截圖" className="h-28 rounded border border-cyan-500/20 object-cover" />
            </a>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-cyan-300">處理狀態</span>
        {FEEDBACK_STATUS.map((s) => (
          <button key={s} disabled={busy || s === f.status} onClick={() => patch({ status: s })} className={`rounded-md border px-2.5 py-1 text-xs ${s === f.status ? "border-cyan-300 bg-cyan-400/20 text-cyan-50" : "border-slate-600 text-slate-300 hover:border-cyan-500/60"}`}>
            {s}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <span className="text-xs text-cyan-300">回覆回報者（對方在「查看我的回報」看得到）</span>
        <textarea rows={3} className={INPUT} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} />
        <div className="flex items-center gap-2">
          <button onClick={remove} className="text-xs text-rose-300 hover:underline">
            刪除
          </button>
          <div className="flex-1" />
          <button disabled={busy || reply === f.reply} onClick={() => patch({ reply, ...(f.status === "新回報" && { status: "處理中" as const }) })} className={BTN_PRIMARY}>
            送出回覆
          </button>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      <ol className="space-y-1 border-l border-cyan-500/30 pl-3 text-[11px] text-slate-400">
        {[...f.history].reverse().map((h, i) => (
          <li key={i}>
            <span className="mr-2 font-mono text-slate-500">{h.at.slice(0, 16).replace("T", " ")}</span>
            {h.text}
            <span className="text-slate-600"> · {h.by}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
