"use client";

import { useState } from "react";
import {
  addMonths,
  DUE_COLOR,
  dueState,
  everyLabel,
  INSPECTION_LEVELS,
  INSPECTION_RESULTS,
  lastRecord,
  nextDue,
  type DueState,
  type InspectionPlan,
  type InspectionRecord,
} from "@/lib/inspections";
import { api, BTN_DANGER, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, Select } from "../ui";
import { fmtDate, TODAY, upsert, useMgmt } from "./common";

const ORDER: DueState[] = ["逾期", "30 天內", "未設定", "已排定", "停用"];
const CATEGORIES = ["消防", "建築", "設備", "衛生", "組織"] as const;
const DAY = 86400000;
const url = (p: InspectionPlan, sub = "") => `/api/inspections/${encodeURIComponent(p.id)}${sub}`;

function countdown(due: string, today: string) {
  const n = Math.round((Date.parse(due) - Date.parse(today)) / DAY);
  return n < 0 ? `逾期 ${-n} 天` : n === 0 ? "今天到期" : `還有 ${n} 天`;
}

export default function InspectionsTab() {
  const { inspections, setInspections, building, vendors, openTodo } = useMgmt();
  const today = TODAY();
  const [level, setLevel] = useState<"全部" | (typeof INSPECTION_LEVELS)[number]>("全部");
  const [showOff, setShowOff] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [recordFor, setRecordFor] = useState<InspectionPlan | null>(null);
  const [edit, setEdit] = useState<InspectionPlan | "new" | null>(null);

  const save = (p: InspectionPlan) => setInspections((all) => upsert(all, p));
  const rows = inspections
    .filter((p) => (level === "全部" || p.level === level) && (showOff || p.enabled))
    .map((p) => ({ p, state: dueState(p, today), due: nextDue(p) }))
    .sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || (a.due || "9").localeCompare(b.due || "9"));
  const count = (s: DueState) => inspections.filter((p) => dueState(p, today) === s).length;

  async function removeRecord(p: InspectionPlan, r: InspectionRecord) {
    if (!confirm(`刪除 ${fmtDate(r.date)} 的辦理紀錄？`)) return;
    save(await api<InspectionPlan>(`${url(p, "/records")}?recordId=${r.id}`, { method: "DELETE" }));
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(["逾期", "30 天內", "未設定", "已排定"] as DueState[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-slate-200">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: DUE_COLOR[s] }} />
            {s}
            <b className="text-sm text-cyan-50">{count(s)}</b>
          </span>
        ))}
        <div className="mx-1 flex overflow-hidden rounded-md border border-cyan-500/40">
          {(["全部", ...INSPECTION_LEVELS] as const).map((l) => (
            <button key={l} onClick={() => setLevel(l)} className={`px-3 py-1.5 ${level === l ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400"}`}>
              {l}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-slate-300">
          <input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} className="accent-cyan-400" />
          顯示停用項目
        </label>
        <div className="flex-1" />
        <button onClick={() => setEdit("new")} className={BTN_OUTLINE}>
          ＋ 自訂項目
        </button>
      </div>
      <p className="text-[11px] text-slate-400">
        依地方政府規定與本社區規模（地上 22 層、約 75 m 高層建築物、1F 店鋪）預設。登記辦理日後自動推算下次期限，到期項目會出現在「時程規劃」與訂閱行事曆。頻率與適用與否請以主管機關最新規定及消防 / 建築專業人員意見為準。
      </p>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {rows.map(({ p, state, due }) => {
          const last = lastRecord(p);
          const isOpen = open === p.id;
          return (
            <div key={p.id} className={`overflow-hidden rounded-lg border border-cyan-500/20 bg-white/[0.02] ${p.enabled ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5" style={{ borderLeft: `4px solid ${DUE_COLOR[state]}` }}>
                <button onClick={() => setOpen(isOpen ? null : p.id)} className="min-w-56 flex-1 text-left">
                  <p className="flex items-center gap-2 text-sm font-semibold text-cyan-50">
                    <span className="text-slate-500">{isOpen ? "▾" : "▸"}</span>
                    {p.name}
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-normal ${p.level === "法定" ? "bg-rose-500/15 text-rose-200" : "bg-slate-500/20 text-slate-300"}`}>{p.level}</span>
                    <span className="text-[11px] font-normal text-slate-500">{p.category}</span>
                  </p>
                  <p className="mt-0.5 truncate pl-5 text-[11px] text-slate-400">
                    {everyLabel(p.everyMonths)} · {p.authority}
                  </p>
                </button>
                <div className="w-36 text-xs">
                  <p className="text-slate-500">上次辦理</p>
                  <p className="text-slate-200">{last ? `${fmtDate(last.date)} ${last.result === "合格" ? "" : `· ${last.result}`}` : "—"}</p>
                </div>
                <div className="w-36 text-xs">
                  <p className="text-slate-500">下次期限</p>
                  {due ? (
                    <p style={{ color: state === "已排定" ? undefined : DUE_COLOR[state] }} className="text-slate-200">
                      {fmtDate(due)}
                      <span className="ml-1 text-[11px]">{p.enabled && countdown(due, today)}</span>
                    </p>
                  ) : (
                    <button onClick={() => setEdit(p)} className="text-amber-300 hover:underline">
                      設定期限
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setRecordFor(p)} className={BTN_OUTLINE}>
                    登記辦理
                  </button>
                  <button
                    onClick={() =>
                      openTodo("new", {
                        title: `${p.name}${due ? `（期限 ${fmtDate(due)}）` : ""}`,
                        description: [p.how, p.basis && `法源：${p.basis}`, p.authority && `主管機關：${p.authority}`].filter(Boolean).join("\n"),
                        due: due || "",
                        start: due ? new Date(Date.parse(due) - 45 * DAY).toISOString().slice(0, 10) : "",
                        assignees: ["gm"],
                      })
                    }
                    className={BTN_OUTLINE}
                    title="建立待辦並指派追蹤者"
                  >
                    建立待辦
                  </button>
                  <button onClick={() => setEdit(p)} className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-white/5" aria-label="設定">
                    ⚙
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="grid gap-3 border-t border-cyan-500/10 px-4 py-3 text-xs md:grid-cols-2">
                  <dl className="space-y-1.5">
                    {(
                      [
                        ["法源", p.basis],
                        ["主管機關", p.authority],
                        ["辦理方式", p.how],
                        ["委託廠商", p.vendor],
                        ["備註", p.note],
                      ] as const
                    )
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <dt className="w-16 shrink-0 text-cyan-300">{k}</dt>
                          <dd className="whitespace-pre-wrap text-slate-300">{v}</dd>
                        </div>
                      ))}
                  </dl>
                  <div>
                    <p className="mb-1.5 text-cyan-300">歷次紀錄</p>
                    {p.records.length === 0 ? (
                      <p className="text-slate-500">尚無紀錄</p>
                    ) : (
                      <ul className="space-y-1">
                        {[...p.records]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((r) => (
                            <li key={r.id} className="group flex items-start gap-2 rounded bg-white/[0.03] px-2 py-1.5">
                              <span className="w-20 shrink-0 text-slate-200">{fmtDate(r.date)}</span>
                              <span className={r.result === "合格" || r.result === "已改善複查合格" ? "text-emerald-300" : "text-amber-300"}>{r.result}</span>
                              <span className="min-w-0 flex-1 text-slate-400">{[r.vendor, r.cost && `NT$ ${r.cost}`, r.note].filter(Boolean).join(" · ")}</span>
                              <button onClick={() => removeRecord(p, r)} className="text-slate-500 opacity-0 hover:text-rose-300 group-hover:opacity-100" aria-label="刪除紀錄">
                                ✕
                              </button>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <datalist id="insp-vendors">
        {vendors.map((v) => (
          <option key={v.id} value={v.name} />
        ))}
      </datalist>
      {recordFor && <RecordDialog plan={recordFor} onClose={() => setRecordFor(null)} onSaved={save} />}
      {edit && <PlanDialog plan={edit === "new" ? null : edit} buildingId={building.id} onClose={() => setEdit(null)} onSaved={save} onRemoved={(p, restored) => setInspections((all) => (restored ? upsert(all, restored) : all.filter((x) => x.id !== p.id)))} />}
    </div>
  );
}

function RecordDialog({ plan, onClose, onSaved }: { plan: InspectionPlan; onClose: () => void; onSaved: (p: InspectionPlan) => void }) {
  const [f, setF] = useState({ date: TODAY(), result: "合格" as (typeof INSPECTION_RESULTS)[number], vendor: plan.vendor, cost: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      onSaved(await api<InspectionPlan>(url(plan, "/records"), { method: "POST", json: f }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title="登記辦理結果"
      subtitle={`${plan.name} · ${everyLabel(plan.everyMonths)}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? "儲存中…" : "登記"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="辦理日">
          <input type="date" required className={INPUT} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="結果">
          <Select value={f.result} options={INSPECTION_RESULTS} onChange={(result) => setF({ ...f, result })} />
        </Field>
        <Field label="檢查 / 檢修廠商">
          <input list="insp-vendors" className={INPUT} value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />
        </Field>
        <Field label="費用（元）">
          <input className={INPUT} inputMode="numeric" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
        </Field>
        <Field label="缺失項目 / 改善期限 / 備註" className="col-span-2">
          <textarea rows={3} className={INPUT} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
      </div>
      {f.date && <p className="text-xs text-slate-400">登記後，下次期限將推算為 {fmtDate(addMonths(f.date, plan.everyMonths))}</p>}
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}

function PlanDialog({
  plan,
  buildingId,
  onClose,
  onSaved,
  onRemoved,
}: {
  plan: InspectionPlan | null;
  buildingId: string;
  onClose: () => void;
  onSaved: (p: InspectionPlan) => void;
  onRemoved: (p: InspectionPlan, restored?: InspectionPlan) => void;
}) {
  const custom = !plan?.defId;
  const [f, setF] = useState({
    name: plan?.name ?? "",
    category: plan?.category ?? ("設備" as (typeof CATEGORIES)[number]),
    level: plan?.level ?? ("建議" as (typeof INSPECTION_LEVELS)[number]),
    everyMonths: plan?.everyMonths ?? 12,
    dueOverride: plan?.dueOverride ?? "",
    vendor: plan?.vendor ?? "",
    enabled: plan?.enabled ?? true,
    basis: plan?.basis ?? "",
    authority: plan?.authority ?? "",
    how: plan?.how ?? "",
    note: plan?.note ?? "",
  });
  const [lastDate, setLastDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      let p = plan
        ? await api<InspectionPlan>(url(plan), { method: "PATCH", json: f })
        : await api<InspectionPlan>("/api/inspections", { method: "POST", json: { ...f, buildingId } });
      // 補登上次辦理日：建立一筆紀錄，之後依此推算
      if (lastDate) p = await api<InspectionPlan>(url(p, "/records"), { method: "POST", json: { date: lastDate, result: "合格", vendor: f.vendor, note: "補登" } });
      onSaved(p);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!plan) return;
    const msg = custom ? `刪除自訂項目「${plan.name}」與所有紀錄？` : `將「${plan.name}」還原為預設值？歷次紀錄會一併清除；只想略過請改為停用。`;
    if (!confirm(msg)) return;
    await api(url(plan), { method: "DELETE" });
    const fresh = custom ? undefined : (await api<InspectionPlan[]>(`/api/inspections?buildingId=${buildingId}`)).find((x) => x.id === plan.id);
    onRemoved(plan, fresh);
    onClose();
  }

  return (
    <Modal
      wide
      title={plan ? "檢測項目設定" : "新增自訂檢測項目"}
      subtitle={plan?.name}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {plan && plan.updatedAt && (
            <button type="button" onClick={remove} className={BTN_DANGER}>
              {custom ? "刪除項目" : "還原預設"}
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
        <Field label="項目名稱" className="col-span-2">
          <input required className={INPUT} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="類別">
          <Select value={f.category} options={CATEGORIES} onChange={(category) => setF({ ...f, category })} />
        </Field>
        <Field label="性質">
          <Select value={f.level} options={INSPECTION_LEVELS} onChange={(level) => setF({ ...f, level })} />
        </Field>
        <Field label="週期（月）">
          <input type="number" min={1} max={120} className={INPUT} value={f.everyMonths} onChange={(e) => setF({ ...f, everyMonths: Number(e.target.value) })} />
        </Field>
        <Field label="補登上次辦理日">
          <input type="date" className={INPUT} value={lastDate} onChange={(e) => setLastDate(e.target.value)} />
        </Field>
        <Field label="或直接指定下次期限">
          <input type="date" className={INPUT} value={f.dueOverride} onChange={(e) => setF({ ...f, dueOverride: e.target.value })} />
        </Field>
        <Field label="委託廠商">
          <input list="insp-vendors" className={INPUT} value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />
        </Field>
        <Field label="法源" className="col-span-2 sm:col-span-4">
          <input className={INPUT} value={f.basis} onChange={(e) => setF({ ...f, basis: e.target.value })} />
        </Field>
        <Field label="主管機關" className="col-span-2">
          <input className={INPUT} value={f.authority} onChange={(e) => setF({ ...f, authority: e.target.value })} />
        </Field>
        <Field label="辦理方式" className="col-span-2">
          <input className={INPUT} value={f.how} onChange={(e) => setF({ ...f, how: e.target.value })} />
        </Field>
        <Field label="備註" className="col-span-2 sm:col-span-4">
          <textarea rows={2} className={INPUT} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} className="accent-cyan-400" />
        啟用（本社區需要辦理此項目）
      </label>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
