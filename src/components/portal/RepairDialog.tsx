"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/issues";
import { api, BTN_GHOST, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, Select } from "../ui";

export type RepairDraft = { tower: "A" | "B" | "S"; floor: string; x: number; y: number; zone: string; label: string };

/** 住戶報修：在平面圖點選位置後填寫，送出後由物業處理 */
export default function RepairDialog({ draft, onClose, onSent }: { draft: RepairDraft; onClose: () => void; onSent: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("其他");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!title.trim()) return setError("請填寫報修項目");
    setBusy(true);
    setError("");
    try {
      const photos: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.set("file", f);
        photos.push((await api<{ name: string }>("/api/uploads", { method: "POST", body: fd })).name);
      }
      await api("/api/portal/repairs", { method: "POST", json: { ...draft, title, category, description, photos } });
      onSent();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title="我要報修"
      subtitle={`📍 ${draft.label}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? "送出中…" : "送出報修"}
          </button>
        </>
      }
    >
      <Field label="報修項目 *">
        <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：梯廳燈不亮、地下室漏水" maxLength={80} autoFocus />
      </Field>
      <Field label="類別">
        <Select value={category} options={CATEGORIES} onChange={setCategory} />
      </Field>
      <Field label="狀況說明">
        <textarea rows={4} className={INPUT} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="發現時間、狀況、是否影響通行或安全" maxLength={2000} />
      </Field>
      <Field label="照片（選填，最多 5 張）">
        <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} className="text-xs text-slate-300" />
      </Field>
      <p className="text-[11px] text-slate-500">報修內容只有你和管理單位看得到；處理進度可在右側「我的報修」查看。公共區域的維修會以「維修中」標記顯示，但不會顯示報修人。</p>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
