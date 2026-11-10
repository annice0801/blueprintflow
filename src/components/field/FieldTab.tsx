"use client";

import { useMemo, useState } from "react";
import { unitLabel, unitPing } from "@/lib/buildings";
import { LOG_TYPES, pointLedger, RES_ICON, RES_STATUS, RES_TYPES, type FieldLog, type FieldSettings, type Reservation, type ResStatus, type ResType, type ResTypeSetting, type Visitor } from "@/lib/field";
import { downloadIcs } from "@/lib/ics";
import type { Issue } from "@/lib/issues";
import type { PlanRef, Todo } from "@/lib/mgmt";
import { api, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, nowLocal } from "../ui";
import { fmtDate, PlanRefPicker, TODAY, upsert, useMgmt } from "../manage/common";
import Shifts, { TodayDuty } from "./Shifts";
import UnitPicker from "./UnitPicker";

type Sub = "today" | "shifts" | "reservations" | "visitors" | "logs" | "settings";
const SUBS: [Sub, string][] = [
  ["today", "今日"],
  ["shifts", "班表"],
  ["reservations", "預約"],
  ["visitors", "訪客"],
  ["logs", "值班日誌"],
  ["settings", "預約設定"],
];

export const RES_STATUS_CLS: Record<ResStatus, string> = {
  待審核: "border-amber-400/60 text-amber-200",
  已確認: "border-sky-400/60 text-sky-200",
  使用中: "border-emerald-400/60 text-emerald-200",
  已完成: "border-slate-500/60 text-slate-300",
  已取消: "border-slate-600 text-slate-500",
  未到: "border-rose-400/60 text-rose-200",
  已退回: "border-rose-400/60 text-rose-200",
};

const hm = (dt: string) => dt.slice(11, 16);

export default function FieldTab() {
  const { building } = useMgmt();
  const [sub, setSub] = useState<Sub>("today");
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1">
        {SUBS.map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} className={`rounded-full border px-3 py-1 text-sm ${sub === k ? "border-cyan-300 bg-cyan-400/20 text-cyan-50" : "border-slate-600 text-slate-300 hover:border-cyan-500/60"}`}>
            {l}
          </button>
        ))}
        <div className="flex-1" />
        <a href={`/buildings/${building.id}/book`} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 hover:underline">
          住戶預約頁面 ↗
        </a>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sub === "today" && <Today onGo={setSub} />}
        {sub === "shifts" && <Shifts />}
        {sub === "reservations" && <Reservations />}
        {sub === "visitors" && <Visitors />}
        {sub === "logs" && <Logs />}
        {sub === "settings" && <Settings />}
      </div>
    </div>
  );
}

/* ── 預約操作 ── */

function useResActions() {
  const { setReservations } = useMgmt();
  return async (r: Reservation, action: string, extra?: Record<string, unknown>) => {
    if (action === "noshow" && !confirm("標記為預約未到？將依設定扣點。")) return;
    if ((action === "reject" || action === "cancel") && !confirm(`確定${action === "reject" ? "退回" : "取消"}這筆預約？`)) return;
    try {
      setReservations((all) => upsert(all, r));
      const saved = await api<Reservation>(`/api/reservations/${r.id}`, { method: "PATCH", json: { action, ...extra } });
      setReservations((all) => upsert(all, saved));
    } catch (e) {
      alert((e as Error).message);
    }
  };
}

function ResActions({ r }: { r: Reservation }) {
  const act = useResActions();
  const b = "rounded px-2 py-0.5 text-xs border";
  return (
    <span className="flex flex-wrap gap-1">
      {r.status === "待審核" && (
        <>
          <button onClick={() => act(r, "approve")} className={`${b} border-emerald-400/60 text-emerald-200`}>
            核准
          </button>
          <button onClick={() => act(r, "reject")} className={`${b} border-rose-400/60 text-rose-200`}>
            退回
          </button>
        </>
      )}
      {r.status === "已確認" && (
        <>
          <button onClick={() => act(r, "checkin")} className={`${b} border-cyan-400/60 text-cyan-100`} title="領取磁扣時扣點">
            報到{r.points.estimate ? `（扣 ${r.points.estimate} 點）` : ""}
          </button>
          <button onClick={() => act(r, "noshow")} className={`${b} border-slate-500 text-slate-300`}>
            未到
          </button>
        </>
      )}
      {r.status === "使用中" && (
        <button onClick={() => act(r, "complete")} className={`${b} border-slate-400 text-slate-200`}>
          完成
        </button>
      )}
      {(r.status === "待審核" || r.status === "已確認") && (
        <button onClick={() => act(r, "cancel")} className={`${b} border-slate-600 text-slate-400`}>
          取消
        </button>
      )}
    </span>
  );
}

function ResRow({ r, showDate }: { r: Reservation; showDate?: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <span className="w-6 text-center">{RES_ICON[r.type]}</span>
      <span className="font-mono text-xs text-cyan-200">
        {showDate && `${fmtDate(r.start.slice(0, 10)).slice(5)} `}
        {hm(r.start)}–{hm(r.end)}
      </span>
      <span className="text-slate-100">{r.type}</span>
      <span className="text-xs text-slate-300">{unitLabel(r.unitId)}</span>
      <span className="text-xs text-slate-400">
        {r.name} {r.phone}
        {r.people > 1 && ` · ${r.people} 人`}
      </span>
      <span className={`rounded border px-1.5 text-[11px] ${RES_STATUS_CLS[r.status]}`}>{r.status}</span>
      {r.points.charged + r.points.overflow > 0 && (
        <span className="text-[11px] text-amber-200">
          扣 {r.points.charged} 點{r.points.overflow ? ` · 加收 NT$ ${r.points.fee}` : ""}
        </span>
      )}
      {r.consent && <span className="text-[11px] text-emerald-300" title={`同意時間 ${r.consent.at.slice(0, 16).replace("T", " ")}`}>✓ 已同意規範</span>}
      <div className="flex-1" />
      <button onClick={() => downloadIcs({ uid: r.id, title: `${r.type}｜${unitLabel(r.unitId)}`, start: r.start, end: r.end, alarmMinutes: 30 }, `${r.type}-${r.code}.ics`)} className="text-[11px] text-slate-400 hover:text-cyan-200" title="加入行事曆">
        📅
      </button>
      <ResActions r={r} />
      {r.note && <p className="w-full pl-8 text-xs text-slate-500">備註：{r.note}</p>}
    </li>
  );
}

/* ── 今日 ── */

function Today({ onGo }: { onGo: (s: Sub) => void }) {
  const { reservations, visitors, fieldlogs, announcements, goTab } = useMgmt();
  const today = TODAY();
  const todays = reservations.filter((r) => r.start.startsWith(today) && !["已取消", "已退回"].includes(r.status)).sort((a, b) => a.start.localeCompare(b.start));
  const pending = reservations.filter((r) => r.status === "待審核");
  const inside = visitors.filter((v) => !v.outAt && v.inAt.startsWith(today));
  const logs = fieldlogs.filter((l) => l.at.startsWith(today));
  const toPost = announcements.filter((a) => a.status === "張貼中" || a.status === "已核准");
  const [quick, setQuick] = useState<"res" | "visitor" | "log" | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickBtn icon="📣" label="收到通知 → 製作公告" onClick={() => goTab("announcements", { new: "1" })} />
        <QuickBtn icon="📸" label="值班紀錄（拍照）" onClick={() => setQuick("log")} />
        <QuickBtn icon="🧑‍💼" label="登記訪客" onClick={() => setQuick("visitor")} />
        <QuickBtn icon="🗓" label="代住戶 / 廠商預約" onClick={() => setQuick("res")} />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="今日預約" value={todays.length} onClick={() => onGo("reservations")} />
        <Stat label="待審核預約" value={pending.length} warn={pending.length > 0} onClick={() => onGo("reservations")} />
        <Stat label="訪客在社區內" value={inside.length} onClick={() => onGo("visitors")} />
        <Stat label="待張貼公告" value={toPost.length} warn={toPost.length > 0} onClick={() => goTab("announcements")} />
      </div>

      <section className="rounded-lg border border-cyan-500/20">
        <div className="flex items-center border-b border-cyan-500/20 px-3 py-2">
          <h3 className="text-sm font-semibold text-cyan-100">今日值班</h3>
          <div className="flex-1" />
          <button onClick={() => onGo("shifts")} className="text-xs text-cyan-300 hover:underline">
            班表 →
          </button>
        </div>
        <TodayDuty />
      </section>

      <section className="rounded-lg border border-cyan-500/20">
        <h3 className="border-b border-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100">今日預約（{fmtDate(today)}）</h3>
        <ul className="divide-y divide-cyan-500/10">
          {todays.map((r) => (
            <ResRow key={r.id} r={r} />
          ))}
          {todays.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">今天沒有預約</li>}
        </ul>
      </section>
      {pending.length > 0 && (
        <section className="rounded-lg border border-amber-400/30">
          <h3 className="border-b border-amber-400/30 px-3 py-2 text-sm font-semibold text-amber-100">待審核（{pending.length}）</h3>
          <ul className="divide-y divide-cyan-500/10">
            {pending.map((r) => (
              <ResRow key={r.id} r={r} showDate />
            ))}
          </ul>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-cyan-500/20">
          <h3 className="border-b border-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100">訪客在社區內（{inside.length}）</h3>
          <VisitorList list={inside} />
        </section>
        <section className="rounded-lg border border-cyan-500/20">
          <h3 className="border-b border-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100">今日值班紀錄（{logs.length}）</h3>
          <LogList list={logs} />
        </section>
      </div>
      {quick === "res" && <ReservationDialog onClose={() => setQuick(null)} />}
      {quick === "visitor" && (
        <Modal title="登記訪客" onClose={() => setQuick(null)}>
          <VisitorForm onDone={() => setQuick(null)} />
        </Modal>
      )}
      {quick === "log" && (
        <Modal wide title="新增值班紀錄" onClose={() => setQuick(null)}>
          <LogForm onDone={() => setQuick(null)} />
        </Modal>
      )}
    </div>
  );
}

function QuickBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-4 text-left text-sm font-semibold text-cyan-50 hover:bg-cyan-400/20">
      <span className="text-2xl">{icon}</span>
      {label}
    </button>
  );
}

function Stat({ label, value, warn, onClick }: { label: string; value: number; warn?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-cyan-500/20 bg-white/[0.02] px-4 py-3 text-left hover:border-cyan-400/50">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 font-mono text-2xl ${warn ? "text-amber-200" : "text-cyan-50"}`}>{value}</p>
    </button>
  );
}

/* ── 預約清單與點數 ── */

function Reservations() {
  const { reservations, settings } = useMgmt();
  const [type, setType] = useState<ResType | "">("");
  const [status, setStatus] = useState<ResStatus | "">("");
  const [from, setFrom] = useState(TODAY());
  const [adding, setAdding] = useState(false);
  const shown = reservations
    .filter((r) => (!type || r.type === type) && (!status || r.status === status) && r.start.slice(0, 10) >= from)
    .sort((a, b) => a.start.localeCompare(b.start));
  const days = [...new Set(shown.map((r) => r.start.slice(0, 10)))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${INPUT} max-w-36 py-1.5`} value={type} onChange={(e) => setType(e.target.value as ResType | "")} aria-label="類型">
          <option value="">全部類型</option>
          {RES_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select className={`${INPUT} max-w-32 py-1.5`} value={status} onChange={(e) => setStatus(e.target.value as ResStatus | "")} aria-label="狀態">
          <option value="">全部狀態</option>
          {RES_STATUS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-300">
          自
          <input type="date" className={`${INPUT} w-40 py-1.5`} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <div className="flex-1" />
        <button onClick={() => setAdding(true)} className={BTN_PRIMARY}>
          ＋ 代為預約
        </button>
      </div>
      {days.length === 0 && <p className="py-8 text-center text-xs text-slate-500">沒有符合的預約</p>}
      {days.map((d) => (
        <section key={d} className="rounded-lg border border-cyan-500/20">
          <h3 className="border-b border-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-200">{fmtDate(d)}</h3>
          <ul className="divide-y divide-cyan-500/10">
            {shown
              .filter((r) => r.start.startsWith(d))
              .map((r) => (
                <ResRow key={r.id} r={r} />
              ))}
          </ul>
        </section>
      ))}
      {settings && <PointsLedger settings={settings} />}
      {adding && <ReservationDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function PointsLedger({ settings }: { settings: FieldSettings }) {
  const { reservations } = useMgmt();
  const [date, setDate] = useState(TODAY());
  const units = [...new Set(reservations.filter((r) => settings.types[r.type].pointsPerHour > 0).map((r) => r.unitId))];
  const rows = units.map((u) => ({ u, l: pointLedger(reservations, u, unitPing(u), settings, date) })).filter((x) => x.l.used || x.l.overflow);
  const totalFee = rows.reduce((s, x) => s + x.l.fee, 0);
  return (
    <section className="rounded-lg border border-cyan-500/20 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-cyan-100">公設點數帳</h3>
        <span className="text-xs text-slate-400">
          每坪 {settings.pointPerPing} 點 · 每{settings.pointPeriod}歸零 · 不足每點 NT$ {settings.feePerPoint} 併入管理費
        </span>
        <div className="flex-1" />
        <input type="month" className={`${INPUT} w-40 py-1 text-xs`} value={date.slice(0, 7)} onChange={(e) => setDate(`${e.target.value}-01`)} aria-label="期間" />
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">本期尚無扣點</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-1 font-normal">戶別</th>
              <th className="font-normal">權狀坪數</th>
              <th className="font-normal">本期發放</th>
              <th className="font-normal">已扣</th>
              <th className="font-normal">剩餘</th>
              <th className="font-normal">不足點數</th>
              <th className="font-normal">管理費加收</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ u, l }) => (
              <tr key={u} className="border-t border-cyan-500/10 font-mono text-slate-200">
                <td className="py-1 font-sans">{unitLabel(u)}</td>
                <td>{unitPing(u) || "—"}</td>
                <td>{l.allot}</td>
                <td>{l.used}</td>
                <td>{l.left}</td>
                <td className={l.overflow ? "text-amber-200" : ""}>{l.overflow}</td>
                <td className={l.fee ? "text-amber-200" : ""}>{l.fee ? `NT$ ${l.fee.toLocaleString()}` : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-cyan-500/30 text-slate-300">
              <td colSpan={6} className="py-1 text-right">
                本期管理費加收合計（納入公設維護基金）
              </td>
              <td className="font-mono text-amber-200">NT$ {totalFee.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}

export function ReservationDialog({ onClose, preset }: { onClose: () => void; preset?: Partial<Reservation> }) {
  const { building, setReservations, settings } = useMgmt();
  const [f, setF] = useState({
    type: preset?.type ?? ("卸貨" as ResType),
    unitId: preset?.unitId ?? "",
    name: preset?.name ?? "",
    phone: preset?.phone ?? "",
    date: preset?.start?.slice(0, 10) ?? TODAY(),
    from: preset?.start?.slice(11, 16) ?? "10:00",
    to: preset?.end?.slice(11, 16) ?? "11:00",
    people: 1,
    note: "",
    consent: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ts = settings?.types[f.type];

  async function save() {
    setBusy(true);
    setError("");
    try {
      let consentVersion: string | undefined;
      if (f.consent) consentVersion = (await api<{ version: string }>(`/api/reservations/rules?type=${encodeURIComponent(f.type)}`)).version;
      const saved = await api<Reservation>("/api/reservations", {
        method: "POST",
        json: { buildingId: building.id, source: "物業", type: f.type, unitId: f.unitId, name: f.name, phone: f.phone, start: `${f.date}T${f.from}`, end: `${f.date}T${f.to}`, people: f.people, note: f.note, ...(consentVersion && { consent: true, consentVersion }) },
      });
      setReservations((all) => upsert(all, saved));
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title="代為預約"
      subtitle="物業登記（施工、廠商到場僅能由物業登記）"
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? "儲存中…" : "建立預約"}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {RES_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => setF({ ...f, type: t })} className={`rounded-full border px-3 py-1 text-sm ${f.type === t ? "border-cyan-300 bg-cyan-400/20 text-cyan-50" : "border-slate-600 text-slate-300"}`}>
            {RES_ICON[t]} {t}
          </button>
        ))}
      </div>
      {ts && (
        <p className="text-xs text-slate-400">
          開放 {ts.openFrom}–{ts.openTo}
          {ts.weekdaysOnly && " · 假日不開放"} · 每次最多 {ts.maxHours} 小時 · 同時段 {ts.capacity} 組{ts.pointsPerHour ? ` · 每小時 ${ts.pointsPerHour} 點` : ""}
          {ts.deposit && ` · ${ts.deposit}`}
        </p>
      )}
      <Field label={f.type === "裝潢施工" || f.type === "廠商到場" ? "施工 / 服務戶別" : "戶別"}>
        <UnitPicker building={building} value={f.unitId} onChange={(unitId) => setF({ ...f, unitId })} />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label={f.type === "廠商到場" ? "廠商 / 聯絡人" : "姓名"} className="sm:col-span-2">
          <input className={INPUT} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} />
        </Field>
        <Field label="電話" className="sm:col-span-2">
          <input type="tel" className={INPUT} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={30} />
        </Field>
        <Field label="人數">
          <input type="number" min={1} className={INPUT} value={f.people} onChange={(e) => setF({ ...f, people: Number(e.target.value) })} />
        </Field>
        <Field label="日期" className="sm:col-span-2">
          <input type="date" className={INPUT} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="開始">
          <input type="time" step={1800} className={INPUT} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        </Field>
        <Field label="結束">
          <input type="time" step={1800} className={INPUT} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </Field>
      </div>
      <Field label="備註">
        <input className={INPUT} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} placeholder="例：搬家公司車牌、施工項目" />
      </Field>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="accent-cyan-400" />
        住戶已閱讀並同意預約規範（紙本或口頭確認）
      </label>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}

/* ── 訪客 ── */

function Visitors() {
  const { visitors, settings } = useMgmt();
  const [q, setQ] = useState("");
  const shown = visitors.filter((v) => !q || `${v.name}${v.plate}${v.purpose}${unitLabel(v.unitId)}`.includes(q));
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="rounded-lg border border-cyan-500/20 p-3">
        <h3 className="mb-2 text-sm font-semibold text-cyan-100">登記訪客</h3>
        <VisitorForm />
        <p className="mt-2 text-[11px] text-slate-500">訪客資料屬個資，保存 {settings?.visitorRetentionDays ?? 90} 天後自動刪除（可在預約設定調整）。</p>
      </section>
      <section className="rounded-lg border border-cyan-500/20">
        <div className="flex items-center gap-2 border-b border-cyan-500/20 px-3 py-2">
          <h3 className="text-sm font-semibold text-cyan-100">訪客紀錄</h3>
          <div className="flex-1" />
          <input className={`${INPUT} max-w-48 py-1 text-xs`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋姓名、車牌、戶別" />
        </div>
        <VisitorList list={shown} />
      </section>
    </div>
  );
}

function VisitorForm({ onDone }: { onDone?: () => void }) {
  const { building, setVisitors } = useMgmt();
  const [f, setF] = useState({ name: "", unitId: "", purpose: "拜訪", plate: "", count: 1, note: "" });
  const [error, setError] = useState("");
  async function save() {
    try {
      const v = await api<Visitor>("/api/visitors", { method: "POST", json: { ...f, buildingId: building.id, inAt: nowLocal() } });
      setVisitors((all) => [v, ...all]);
      setF({ name: "", unitId: "", purpose: "拜訪", plate: "", count: 1, note: "" });
      setError("");
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="space-y-2">
      <input className={INPUT} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="訪客姓名 *" maxLength={40} />
      <UnitPicker building={building} value={f.unitId} onChange={(unitId) => setF({ ...f, unitId })} />
      <div className="flex flex-wrap gap-1">
        {["拜訪", "送貨", "外送", "看屋", "廠商", "其他"].map((p) => (
          <button key={p} type="button" onClick={() => setF({ ...f, purpose: p })} className={`rounded-full border px-2.5 py-0.5 text-xs ${f.purpose === p ? "border-cyan-300 bg-cyan-400/20 text-cyan-50" : "border-slate-600 text-slate-300"}`}>
            {p}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={INPUT} value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} placeholder="車牌（選填）" maxLength={12} />
        <input type="number" min={1} className={INPUT} value={f.count} onChange={(e) => setF({ ...f, count: Number(e.target.value) })} aria-label="人數" />
      </div>
      <ErrorText>{error}</ErrorText>
      <button onClick={save} className={`${BTN_PRIMARY} w-full`}>
        登記進入
      </button>
    </div>
  );
}

function VisitorList({ list }: { list: Visitor[] }) {
  const { setVisitors } = useMgmt();
  async function out(v: Visitor) {
    const saved = await api<Visitor>(`/api/visitors/${v.id}`, { method: "PATCH", json: {} });
    setVisitors((all) => upsert(all, saved));
  }
  return (
    <ul className="divide-y divide-cyan-500/10">
      {list.map((v) => (
        <li key={v.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <span className="font-mono text-xs text-cyan-200">
            {fmtDate(v.inAt.slice(0, 10)).slice(5)} {hm(v.inAt)}
            {v.outAt && ` → ${hm(v.outAt)}`}
          </span>
          <span className="text-slate-100">{v.name}</span>
          {v.count > 1 && <span className="text-xs text-slate-400">{v.count} 人</span>}
          <span className="text-xs text-slate-400">
            {v.purpose}
            {v.unitId && ` · ${unitLabel(v.unitId)}`}
            {v.plate && ` · 🚗 ${v.plate}`}
          </span>
          <div className="flex-1" />
          {!v.outAt ? (
            <button onClick={() => out(v)} className="rounded border border-cyan-400/50 px-2 py-0.5 text-xs text-cyan-100">
              離開
            </button>
          ) : (
            <span className="text-[11px] text-slate-500">已離開</span>
          )}
        </li>
      ))}
      {list.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">無</li>}
    </ul>
  );
}

/* ── 值班日誌 ── */

function Logs() {
  const { fieldlogs } = useMgmt();
  const [type, setType] = useState("");
  const shown = fieldlogs.filter((l) => !type || l.type === type);
  return (
    <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-lg border border-cyan-500/20 p-3">
        <h3 className="mb-2 text-sm font-semibold text-cyan-100">新增紀錄</h3>
        <LogForm />
      </section>
      <section className="rounded-lg border border-cyan-500/20">
        <div className="flex flex-wrap items-center gap-1 border-b border-cyan-500/20 px-3 py-2">
          <h3 className="mr-2 text-sm font-semibold text-cyan-100">值班日誌</h3>
          {["", ...LOG_TYPES].map((t) => (
            <button key={t} onClick={() => setType(t)} className={`rounded px-2 py-0.5 text-xs ${type === t ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400"}`}>
              {t || "全部"}
            </button>
          ))}
        </div>
        <LogList list={shown} />
      </section>
    </div>
  );
}

function LogForm({ onDone }: { onDone?: () => void }) {
  const { building, setFieldlogs } = useMgmt();
  const [f, setF] = useState({ type: "巡檢" as FieldLog["type"], text: "", by: "", location: undefined as PlanRef | undefined });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previews = useMemo(() => files.map((x) => URL.createObjectURL(x)), [files]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const photos: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.set("file", file);
        photos.push((await api<{ name: string }>("/api/uploads", { method: "POST", body: fd })).name);
      }
      const log = await api<FieldLog>("/api/fieldlogs", { method: "POST", json: { ...f, location: f.location ?? null, photos, buildingId: building.id, at: nowLocal() } });
      setFieldlogs((all) => [log, ...all]);
      setF({ ...f, text: "", location: undefined });
      setFiles([]);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {LOG_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => setF({ ...f, type: t })} className={`rounded-full border px-2.5 py-1 text-xs ${f.type === t ? "border-cyan-300 bg-cyan-400/20 text-cyan-50" : "border-slate-600 text-slate-300"}`}>
            {t}
          </button>
        ))}
      </div>
      <textarea className={`${INPUT} min-h-24`} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="例：B1 車道柵欄感應異常，已通知廠商；A 棟大廳燈管閃爍" maxLength={2000} />
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-cyan-500/40 py-4 text-sm text-cyan-200 hover:bg-cyan-400/5">
        📷 拍照 / 選擇照片
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            setFiles((x) => [...x, ...Array.from(e.target.files ?? [])].slice(0, 12));
            e.target.value = "";
          }}
        />
      </label>
      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {previews.map((src, i) => (
            <button key={src} type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="relative" title="移除">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="aspect-square w-full rounded object-cover" />
              <span className="absolute right-0.5 top-0.5 rounded-full bg-black/70 px-1 text-[10px] text-white">✕</span>
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <span className="text-xs text-cyan-300">位置（選填，會標在平面圖）</span>
        <PlanRefPicker value={f.location} onChange={(v) => setF({ ...f, location: v })} />
      </div>
      <input className={INPUT} value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })} placeholder="填寫人 / 班別（例：日班保全 王先生）" maxLength={40} />
      <ErrorText>{error}</ErrorText>
      <button onClick={save} disabled={busy} className={`${BTN_PRIMARY} w-full py-2.5`}>
        {busy ? "上傳中…" : "送出紀錄"}
      </button>
    </div>
  );
}

function LogList({ list }: { list: FieldLog[] }) {
  const { building, setFieldlogs, setTodos, openTodo, todos } = useMgmt();
  const [busy, setBusy] = useState("");

  async function toIssue(l: FieldLog) {
    if (!l.location) return alert("請先在紀錄上指定位置，才能轉成平面圖問題注記");
    setBusy(l.id);
    try {
      const fd = new FormData();
      fd.set("buildingId", building.id);
      fd.set("tower", l.location.tower);
      fd.set("floor", l.location.floor);
      fd.set("x", String(l.location.x));
      fd.set("y", String(l.location.y));
      fd.set("zone", l.location.label);
      fd.set("title", l.text.split("\n")[0].slice(0, 60) || `${l.type}紀錄`);
      fd.set("description", `${l.text}\n（由值班日誌 ${l.at.replace("T", " ")} ${l.by} 轉入）`);
      fd.set("category", "其他");
      fd.set("severity", l.type === "異常" ? "中" : "低");
      fd.set("status", "待處理");
      for (const p of l.photos) {
        const blob = await (await fetch(`/api/uploads/${p}`)).blob();
        fd.append("photos", new File([blob], p, { type: blob.type }));
      }
      const issue = await api<Issue>("/api/issues", { method: "POST", body: fd });
      const saved = await api<FieldLog>(`/api/fieldlogs/${l.id}`, { method: "PATCH", json: { issueId: issue.id } });
      setFieldlogs((all) => upsert(all, saved));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function toTodo(l: FieldLog) {
    setBusy(l.id);
    try {
      const todo = await api<Todo>("/api/todos", {
        method: "POST",
        json: { buildingId: building.id, title: l.text.split("\n")[0].slice(0, 80) || `${l.type}紀錄追蹤`, description: `${l.text}\n（由值班日誌 ${l.at.replace("T", " ")} ${l.by} 轉入）`, assignees: ["gm"], priority: l.type === "異常" ? "高" : "中", location: l.location ?? null },
      });
      setTodos((all) => [...all, todo]);
      const saved = await api<FieldLog>(`/api/fieldlogs/${l.id}`, { method: "PATCH", json: { todoId: todo.id } });
      setFieldlogs((all) => upsert(all, saved));
      openTodo(todo);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <ul className="divide-y divide-cyan-500/10">
      {list.map((l) => (
        <li key={l.id} className="space-y-1.5 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-cyan-200">
              {fmtDate(l.at.slice(0, 10)).slice(5)} {hm(l.at)}
            </span>
            <span className={`rounded border px-1.5 ${l.type === "異常" ? "border-rose-400/60 text-rose-200" : "border-cyan-500/40 text-cyan-200"}`}>{l.type}</span>
            {l.by && <span className="text-slate-400">{l.by}</span>}
            {l.location && <span className="text-slate-400">📍 {l.location.label}</span>}
            <div className="flex-1" />
            {l.issueId ? (
              <span className="text-emerald-300">✓ 已轉問題注記</span>
            ) : (
              <button disabled={busy === l.id} onClick={() => toIssue(l)} className="text-cyan-300 hover:underline">
                轉問題注記
              </button>
            )}
            {l.todoId ? (
              <button onClick={() => { const t = todos.find((x) => x.id === l.todoId); if (t) openTodo(t); }} className="text-emerald-300 hover:underline">
                ✓ 已轉待辦
              </button>
            ) : (
              <button disabled={busy === l.id} onClick={() => toTodo(l)} className="text-cyan-300 hover:underline">
                轉待辦
              </button>
            )}
          </div>
          {l.text && <p className="whitespace-pre-wrap text-sm text-slate-200">{l.text}</p>}
          {l.photos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {l.photos.map((p) => (
                <a key={p} href={`/api/uploads/${p}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/uploads/${p}`} alt="" className="h-20 w-20 rounded object-cover" />
                </a>
              ))}
            </div>
          )}
        </li>
      ))}
      {list.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">無</li>}
    </ul>
  );
}

/* ── 預約設定 ── */

function Settings() {
  const { building, settings, setSettings, regulations } = useMgmt();
  const [draft, setDraft] = useState<FieldSettings | null>(settings);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  if (!draft) return <p className="text-sm text-slate-500">載入中…</p>;
  const setType = (t: ResType, p: Partial<ResTypeSetting>) => setDraft({ ...draft, types: { ...draft.types, [t]: { ...draft.types[t], ...p } } });

  async function save() {
    try {
      const s = await api<FieldSettings>("/api/field/settings", { method: "PUT", json: { ...draft, buildingId: building.id } });
      setSettings(s);
      setDraft(s);
      setSaved("已儲存");
      setError("");
      setTimeout(() => setSaved(""), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const inp = `${INPUT} py-1 text-xs`;

  return (
    <div className="space-y-4 pb-6">
      <section className="rounded-lg border border-cyan-500/20 p-3">
        <h3 className="mb-2 text-sm font-semibold text-cyan-100">公設點數（依第 3 次例會決議）</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="每坪發放點數">
            <input type="number" step="0.5" className={inp} value={draft.pointPerPing} onChange={(e) => setDraft({ ...draft, pointPerPing: Number(e.target.value) })} />
          </Field>
          <Field label="歸零週期">
            <select className={inp} value={draft.pointPeriod} onChange={(e) => setDraft({ ...draft, pointPeriod: e.target.value as "月" | "季" })}>
              <option>月</option>
              <option>季</option>
            </select>
          </Field>
          <Field label="不足每點折算管理費（元）">
            <input type="number" className={inp} value={draft.feePerPoint} onChange={(e) => setDraft({ ...draft, feePerPoint: Number(e.target.value) })} />
          </Field>
          <Field label="預約未到扣點">
            <input type="number" className={inp} value={draft.noShowPenalty} onChange={(e) => setDraft({ ...draft, noShowPenalty: Number(e.target.value) })} />
          </Field>
          <Field label="訪客資料保存（天）">
            <input type="number" className={inp} value={draft.visitorRetentionDays} onChange={(e) => setDraft({ ...draft, visitorRetentionDays: Number(e.target.value) })} />
          </Field>
        </div>
      </section>
      {RES_TYPES.map((t) => {
        const s = draft.types[t];
        return (
          <section key={t} className={`rounded-lg border p-3 ${s.enabled ? "border-cyan-500/20" : "border-slate-700 opacity-70"}`}>
            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <h3 className="text-sm font-semibold text-cyan-100">
                {RES_ICON[t]} {t}
              </h3>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={s.enabled} onChange={(e) => setType(t, { enabled: e.target.checked })} className="accent-cyan-400" />
                開放預約
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={s.needApproval} onChange={(e) => setType(t, { needApproval: e.target.checked })} className="accent-cyan-400" />
                住戶預約需物業審核
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={s.weekdaysOnly} onChange={(e) => setType(t, { weekdaysOnly: e.target.checked })} className="accent-cyan-400" />
                假日不開放
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <Field label="開放起">
                <input type="time" className={inp} value={s.openFrom} onChange={(e) => setType(t, { openFrom: e.target.value })} />
              </Field>
              <Field label="開放迄">
                <input type="time" className={inp} value={s.openTo} onChange={(e) => setType(t, { openTo: e.target.value })} />
              </Field>
              <Field label="每次最多（時）">
                <input type="number" step="0.5" className={inp} value={s.maxHours} onChange={(e) => setType(t, { maxHours: Number(e.target.value) })} />
              </Field>
              <Field label="同時段組數">
                <input type="number" className={inp} value={s.capacity} onChange={(e) => setType(t, { capacity: Number(e.target.value) })} />
              </Field>
              <Field label="每小時扣點">
                <input type="number" className={inp} value={s.pointsPerHour} onChange={(e) => setType(t, { pointsPerHour: Number(e.target.value) })} />
              </Field>
              <Field label="連結規範條例">
                <select className={inp} value={s.regulationId} onChange={(e) => setType(t, { regulationId: e.target.value })}>
                  <option value="">（無）</option>
                  {regulations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="保證金 / 費用說明" className="mt-2">
              <input className={inp} value={s.deposit} onChange={(e) => setType(t, { deposit: e.target.value })} />
            </Field>
            <Field label="預約前需同意的規範（修改後，住戶需重新同意）" className="mt-2">
              <textarea className={`${INPUT} min-h-24 text-xs`} value={s.rules} onChange={(e) => setType(t, { rules: e.target.value })} />
            </Field>
          </section>
        );
      })}
      <section className="rounded-lg border border-cyan-500/20 p-3">
        <h3 className="mb-2 text-sm font-semibold text-cyan-100">公告張貼位置</h3>
        <div className="space-y-1.5">
          {draft.postingSpots.map((p, i) => (
            <div key={p.id} className="flex gap-2">
              <input className={inp} value={p.label} onChange={(e) => setDraft({ ...draft, postingSpots: draft.postingSpots.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <button onClick={() => setDraft({ ...draft, postingSpots: draft.postingSpots.filter((_, j) => j !== i) })} className="px-2 text-rose-300" aria-label="移除">
                ✕
              </button>
            </div>
          ))}
          <button onClick={() => setDraft({ ...draft, postingSpots: [...draft.postingSpots, { id: crypto.randomUUID(), label: "" }] })} className={`${BTN_OUTLINE} w-full`}>
            ＋ 新增位置
          </button>
        </div>
      </section>
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-cyan-500/20 bg-[#020814] py-3">
        <ErrorText>{error}</ErrorText>
        <div className="flex-1" />
        {saved && <span className="text-sm text-emerald-300">{saved}</span>}
        <button onClick={save} className={BTN_PRIMARY}>
          儲存設定
        </button>
      </div>
    </div>
  );
}

