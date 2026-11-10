"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { FEEDBACK_TYPES, overallStatus, type Feedback } from "@/lib/perms";
import { api, BTN_GHOST, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, Select } from "../ui";
import { useMe } from "./AuthProvider";

const STATUS_TONE: Record<Feedback["status"], string> = { 新回報: "text-amber-300", 處理中: "text-cyan-300", 已解決: "text-emerald-300", 不處理: "text-slate-400" };

/** 每頁右下角的「意見回報」：送出問題 / 建議，並看自己回報的處理進度 */
export default function FeedbackButton() {
  const me = useMe();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (!me || overallStatus(me.user) !== "active" || path === "/login") return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-cyan-400/50 bg-[#06142a]/95 px-3.5 py-2 text-sm text-cyan-100 shadow-[0_0_20px_rgba(76,201,255,0.25)] hover:bg-cyan-400/15"
      >
        💬 意見回報
      </button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<"new" | "mine">("new");
  const [type, setType] = useState<(typeof FEEDBACK_TYPES)[number]>("問題回報");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<Feedback[] | null>(null);

  async function submit() {
    if (view !== "new") return;
    if (!message.trim()) return setError("請填寫內容");
    setBusy(true);
    setError("");
    try {
      const photos: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.set("file", f);
        photos.push((await api<{ name: string }>("/api/uploads", { method: "POST", body: fd })).name);
      }
      await api("/api/feedback", { method: "POST", json: { type, message, photos, page: window.location.pathname + window.location.search } });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  function showMine() {
    setView("mine");
    api<Feedback[]>("/api/feedback").then(setMine, (e) => setError((e as Error).message));
  }

  return (
    <Modal
      title="意見回報"
      subtitle="系統問題、功能建議都歡迎，管理員會在這裡回覆你"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={view === "new" ? showMine : () => setView("new")} className="text-xs text-cyan-300 hover:underline">
            {view === "new" ? "查看我的回報" : "← 新增回報"}
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            關閉
          </button>
          {view === "new" && !sent && (
            <button type="submit" disabled={busy} className={BTN_PRIMARY}>
              {busy ? "送出中…" : "送出"}
            </button>
          )}
        </>
      }
    >
      {view === "mine" ? (
        mine === null ? (
          <p className="text-sm text-slate-400">載入中…</p>
        ) : mine.length === 0 ? (
          <p className="text-sm text-slate-400">還沒有回報紀錄</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((f) => (
              <li key={f.id} className="rounded-md border border-cyan-500/20 p-2.5 text-sm">
                <p className="flex items-center gap-2 text-xs">
                  <span className={STATUS_TONE[f.status]}>● {f.status}</span>
                  <span className="text-slate-400">{f.type}</span>
                  <span className="ml-auto font-mono text-slate-500">{f.createdAt.slice(0, 10)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-200">{f.message}</p>
                {f.reply && <p className="mt-2 rounded bg-cyan-400/10 px-2 py-1.5 text-xs text-cyan-100">管理員回覆：{f.reply}</p>}
              </li>
            ))}
          </ul>
        )
      ) : sent ? (
        <p className="rounded-md bg-emerald-500/15 px-3 py-3 text-sm text-emerald-100">已送出，謝謝你的回饋！處理進度可在「查看我的回報」看到。</p>
      ) : (
        <>
          <Field label="類型">
            <Select value={type} options={FEEDBACK_TYPES} onChange={setType} />
          </Field>
          <Field label="內容">
            <textarea rows={5} className={INPUT} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="哪個頁面、做了什麼操作、看到什麼結果？" maxLength={3000} autoFocus />
          </Field>
          <Field label="截圖（選填，最多 5 張）">
            <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} className="text-xs text-slate-300" />
          </Field>
          <p className="text-[11px] text-slate-500">會一併記錄你目前所在的頁面，方便管理員找到問題。</p>
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
