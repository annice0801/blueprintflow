"use client";

import { useState } from "react";
import { ALERT, alertOf, CATEGORIES, SEVERITIES, STATUSES, TOWER_LABEL, type Category, type Issue, type Severity, type Status } from "@/lib/issues";
import type { TowerId } from "@/lib/buildings";
import { api, BTN_DANGER, BTN_GHOST, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, PhotoField, Select, usePhotos } from "./ui";

export type IssueDraft = {
  buildingId: string;
  tower: TowerId;
  floor: string;
  x: number;
  y: number;
  zone: string;
};

type Props = {
  issue?: Issue; // 有值 = 編輯
  draft?: IssueDraft; // 新增
  onClose: () => void;
  onSaved: (issue: Issue) => void;
  onDeleted: (id: string) => void;
};

const SEV_STYLE: Record<Severity, string> = {
  低: "data-[on=true]:bg-sky-500/25 data-[on=true]:border-sky-400 data-[on=true]:text-sky-200",
  中: "data-[on=true]:bg-amber-500/25 data-[on=true]:border-amber-400 data-[on=true]:text-amber-200",
  高: "data-[on=true]:bg-rose-500/25 data-[on=true]:border-rose-400 data-[on=true]:text-rose-200",
};

export default function IssueDialog({ issue, draft, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState(issue?.title ?? "");
  const [description, setDescription] = useState(issue?.description ?? "");
  const [zone, setZone] = useState(issue?.zone ?? draft?.zone ?? "");
  const [category, setCategory] = useState<Category>(issue?.category ?? "結構裂縫");
  const [severity, setSeverity] = useState<Severity>(issue?.severity ?? "中");
  const [status, setStatus] = useState<Status>(issue?.status ?? "待處理");
  const [assignee, setAssignee] = useState(issue?.assignee ?? "");
  const [due, setDue] = useState(issue?.due ?? "");
  const photos = usePhotos(issue?.photos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const where = issue ?? draft!;

  async function submit() {
    if (!title.trim()) return setError("請填寫問題標題");
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("title", title);
    fd.set("description", description);
    fd.set("zone", zone);
    fd.set("category", category);
    fd.set("severity", severity);
    fd.set("status", status);
    fd.set("assignee", assignee);
    fd.set("due", due);
    photos.appendTo(fd, issue?.photos);
    if (!issue && draft) for (const [k, v] of Object.entries(draft)) if (k !== "zone") fd.set(k, String(v));
    try {
      onSaved(await api<Issue>(issue ? `/api/issues/${issue.id}` : "/api/issues", { method: issue ? "PATCH" : "POST", body: fd }));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!issue || !confirm("確定刪除這筆問題？照片也會一併刪除。")) return;
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}`, { method: "DELETE" });
      onDeleted(issue.id);
    } catch {
      setError("刪除失敗");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={issue ? "編輯問題" : "新增問題注記"}
      subtitle={`${TOWER_LABEL[where.tower]} · ${where.floor === "RF" ? "R 樓" : where.floor} · 座標 (${where.x}, ${where.y}) m`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {issue && (
            <button type="button" onClick={remove} disabled={busy} className={BTN_DANGER}>
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
      <Field label="標題 *">
        <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：A3 客廳樑底裂縫" maxLength={100} autoFocus />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="類別">
          <Select value={category} options={CATEGORIES} onChange={setCategory} />
        </Field>
        <Field label="戶別 / 區域">
          <input className={INPUT} value={zone} onChange={(e) => setZone(e.target.value)} placeholder="例：A3" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-xs text-cyan-300">嚴重程度</span>
          <div className="flex gap-1.5">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                data-on={severity === s}
                onClick={() => setSeverity(s)}
                className={`flex-1 rounded-md border border-slate-600 py-1.5 text-sm text-slate-300 ${SEV_STYLE[s]}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <Field label="狀態">
          <Select value={status} options={STATUSES} onChange={setStatus} />
        </Field>
      </div>

      <div className="space-y-2 rounded-lg border border-cyan-500/20 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-cyan-200">維修工單</span>
          <div className="flex-1" />
          <AlertBadge level={alertOf({ status, category, severity })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="負責廠商 / 人員">
            <input className={INPUT} value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="例：大安防水工程" maxLength={60} />
          </Field>
          <Field label="預計完成日">
            <input type="date" className={INPUT} value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
      </div>

      <Field label="說明">
        <textarea className={`${INPUT} min-h-24`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="位置、尺寸、發現時間、可能原因…" maxLength={2000} />
      </Field>

      <PhotoField photos={photos} />
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}

/** 3D 立體圖上的光圈等級（依類別、嚴重程度、狀態自動判斷） */
function AlertBadge({ level }: { level: keyof typeof ALERT }) {
  const a = ALERT[level];
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-slate-300" title="儲存後立即顯示在 3D 立體圖">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: a.color }} />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
      </span>
      3D 光圈：{a.label}（{a.hint}）
    </span>
  );
}
