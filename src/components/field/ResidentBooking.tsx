"use client";

import { useEffect, useState } from "react";
import { unitLabel, unitPing, type Building } from "@/lib/buildings";
import { RES_ICON, RESIDENT_TYPES, type Reservation, type ResType, type ResTypeSetting } from "@/lib/field";
import { downloadIcs, googleCalendarUrl } from "@/lib/ics";
import { api, BTN_GHOST, BTN_PRIMARY, ErrorText, Field, INPUT, Modal } from "../ui";
import { RES_STATUS_CLS } from "./FieldTab";
import UnitPicker from "./UnitPicker";

type Rules = { type: ResType; text: string; version: string; setting: ResTypeSetting; feePerPoint: number; pointPeriod: string };
type Ledger = { allot: number; used: number; left: number; overflow: number; fee: number; key: string };

const localDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const toHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default function ResidentBooking({ building }: { building: Building }) {
  const [step, setStep] = useState<"type" | "form" | "done" | "mine">("type");
  const [rules, setRules] = useState<Rules | null>(null);
  const [agreeing, setAgreeing] = useState<Rules | null>(null);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState<Reservation | null>(null);
  const [error, setError] = useState("");

  async function pick(type: ResType) {
    setError("");
    try {
      const r = await api<Rules>(`/api/reservations/rules?buildingId=${building.id}&type=${encodeURIComponent(type)}`);
      if (!r.setting.enabled) return setError(`${type}目前暫停預約`);
      setChecked(false);
      setAgreeing(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-10 pt-6 text-slate-200">
      <header className="mb-5 flex items-center gap-3">
        <div className="flex-1">
          <p className="font-mono text-[11px] tracking-[0.3em] text-cyan-400/80">BLUEPRINTFLOW</p>
          <h1 className="text-xl font-semibold text-cyan-50">{building.name} · 住戶預約</h1>
        </div>
        <button onClick={() => setStep(step === "mine" ? "type" : "mine")} className="rounded-md border border-cyan-500/40 px-3 py-1.5 text-sm text-cyan-200">
          {step === "mine" ? "← 新預約" : "我的預約"}
        </button>
      </header>

      {step === "type" && (
        <>
          <p className="mb-3 text-sm text-slate-400">請選擇預約項目</p>
          <div className="grid grid-cols-2 gap-3">
            {RESIDENT_TYPES.map((t) => (
              <button key={t} onClick={() => pick(t)} className="flex flex-col items-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-6 text-cyan-50 active:scale-[0.98]">
                <span className="text-4xl">{RES_ICON[t]}</span>
                <span className="text-base font-semibold">{t}</span>
              </button>
            ))}
          </div>
          <ErrorText>{error}</ErrorText>
        </>
      )}

      {step === "form" && rules && (
        <BookingForm
          building={building}
          rules={rules}
          onBack={() => setStep("type")}
          onDone={(r) => {
            setDone(r);
            setStep("done");
          }}
        />
      )}

      {step === "done" && done && (
        <div className="space-y-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-5 text-center">
          <p className="text-4xl">{done.status === "待審核" ? "🕒" : "✅"}</p>
          <h2 className="text-lg font-semibold text-emerald-100">{done.status === "待審核" ? "已送出，待管理室審核" : "預約成功"}</h2>
          <p className="text-sm text-slate-200">
            {RES_ICON[done.type]} {done.type}｜{unitLabel(done.unitId)}
            <br />
            {done.start.replace("T", " ")} – {done.end.slice(11)}
          </p>
          <p className="font-mono text-2xl tracking-widest text-cyan-100">{done.code}</p>
          <p className="text-xs text-slate-400">預約編號，請截圖保存。查詢或取消請用「我的預約」（戶別 + 電話）。</p>
          {done.points.estimate > 0 && <p className="text-xs text-amber-200">使用當日至管理中心領取磁扣時扣 {done.points.estimate} 點</p>}
          <div className="flex justify-center gap-2">
            <a href={googleCalendarUrl({ uid: done.id, title: `${done.type}預約｜${building.name}`, start: done.start, end: done.end })} target="_blank" rel="noreferrer" className={BTN_PRIMARY}>
              加入 Google 日曆
            </a>
            <button onClick={() => downloadIcs({ uid: done.id, title: `${done.type}預約｜${building.name}`, start: done.start, end: done.end, alarmMinutes: 60 }, `預約-${done.code}.ics`)} className={BTN_GHOST}>
              下載 .ics
            </button>
          </div>
          <button onClick={() => setStep("type")} className="text-sm text-cyan-300 underline">
            再預約一筆
          </button>
        </div>
      )}

      {step === "mine" && <MyReservations building={building} />}

      {agreeing && (
        <Modal
          title={`${agreeing.type}預約規範`}
          subtitle="請詳閱以下規範，勾選同意後才能繼續預約"
          onClose={() => setAgreeing(null)}
          onSubmit={() => {
            if (!checked) return;
            setRules(agreeing);
            setAgreeing(null);
            setStep("form");
          }}
          footer={
            <>
              <button type="button" onClick={() => setAgreeing(null)} className={BTN_GHOST}>
                取消
              </button>
              <div className="flex-1" />
              <button type="submit" disabled={!checked} className={BTN_PRIMARY}>
                同意並繼續 →
              </button>
            </>
          }
        >
          <div className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-black/30 p-3 text-sm leading-relaxed text-slate-200">{agreeing.text}</div>
          <ul className="space-y-0.5 text-xs text-slate-400">
            <li>
              開放時間 {agreeing.setting.openFrom}–{agreeing.setting.openTo}
              {agreeing.setting.weekdaysOnly && "（假日不開放）"} · 每次最多 {agreeing.setting.maxHours} 小時
            </li>
            {agreeing.setting.pointsPerHour > 0 && (
              <li>
                每小時 {agreeing.setting.pointsPerHour} 點，點數每{agreeing.pointPeriod}歸零；不足每點 NT$ {agreeing.feePerPoint} 併入管理費
              </li>
            )}
            {agreeing.setting.deposit && <li>{agreeing.setting.deposit}</li>}
            {agreeing.setting.needApproval && <li>此項目需管理室審核後生效</li>}
          </ul>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-cyan-400/40 bg-cyan-400/5 px-3 py-3 text-sm text-cyan-50">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-5 w-5 accent-cyan-400" />
            我已閱讀並同意以上規範，違反時願依社區規定辦理
          </label>
        </Modal>
      )}
    </div>
  );
}

function BookingForm({ building, rules, onBack, onDone }: { building: Building; rules: Rules; onBack: () => void; onDone: (r: Reservation) => void }) {
  const s = rules.setting;
  const minDate = rules.type === "搬家" ? localDate(3) : localDate();
  const [f, setF] = useState({ unitId: "", name: "", phone: "", date: minDate, from: "", hours: Math.min(1, s.maxHours), people: 1, note: "" });
  const [booked, setBooked] = useState<{ start: string; end: string }[]>([]);
  const [now] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api<{ start: string; end: string }[]>(`/api/reservations/availability?buildingId=${building.id}&type=${encodeURIComponent(rules.type)}&date=${f.date}`).then((b) => alive && setBooked(b));
    return () => {
      alive = false;
    };
  }, [building.id, rules.type, f.date]);

  useEffect(() => {
    if (!s.pointsPerHour || !f.unitId || f.phone.replace(/\D/g, "").length < 6) return;
    let alive = true;
    const t = setTimeout(() => {
      api<{ ledger: Ledger }>(`/api/reservations?buildingId=${building.id}&unitId=${f.unitId}&phone=${encodeURIComponent(f.phone)}`).then((x) => alive && setLedger(x.ledger));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [building.id, f.unitId, f.phone, s.pointsPerHour]);

  // 30 分鐘一格的開始時間；已達容量者標示額滿
  const slots: { hm: string; full: boolean }[] = [];
  const dow = new Date(`${f.date}T00:00`).getDay();
  const closed = s.weekdaysOnly && (dow === 0 || dow === 6);
  for (let m = toMin(s.openFrom); m + f.hours * 60 <= toMin(s.openTo); m += 30) {
    const st = `${f.date}T${toHm(m)}`;
    const en = `${f.date}T${toHm(m + f.hours * 60)}`;
    if (st < now) continue;
    slots.push({ hm: toHm(m), full: booked.filter((b) => b.start < en && b.end > st).length >= s.capacity });
  }
  const est = Math.ceil(f.hours * s.pointsPerHour);
  const over = ledger ? Math.max(0, est - ledger.left) : 0;

  async function submit() {
    if (!f.from) return setError("請選擇開始時間");
    setBusy(true);
    setError("");
    try {
      const end = toHm(toMin(f.from) + f.hours * 60);
      const r = await api<Reservation>("/api/reservations", {
        method: "POST",
        json: { buildingId: building.id, type: rules.type, unitId: f.unitId, name: f.name, phone: f.phone, start: `${f.date}T${f.from}`, end: `${f.date}T${end}`, people: f.people, note: f.note, consentVersion: rules.version },
      });
      onDone(r);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const big = `${INPUT} py-3 text-base`;
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-cyan-300">
        ← 重新選擇
      </button>
      <h2 className="text-lg font-semibold text-cyan-50">
        {RES_ICON[rules.type]} {rules.type}預約 <span className="text-xs font-normal text-emerald-300">✓ 已同意規範</span>
      </h2>
      <Field label="戶別">
        <UnitPicker building={building} value={f.unitId} onChange={(unitId) => setF({ ...f, unitId })} className="py-3 text-base" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="姓名">
          <input className={big} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} autoComplete="name" />
        </Field>
        <Field label="手機">
          <input type="tel" className={big} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={30} autoComplete="tel" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="日期">
          <input type="date" min={minDate} className={big} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, from: "" })} />
        </Field>
        <Field label="時數">
          <select className={big} value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value), from: "" })}>
            {Array.from({ length: s.maxHours * 2 }, (_, i) => (i + 1) / 2).map((h) => (
              <option key={h} value={h}>
                {h} 小時
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="space-y-1.5">
        <span className="text-xs text-cyan-300">開始時間</span>
        {closed ? (
          <p className="text-sm text-rose-300">{rules.type}假日不開放，請選擇平日</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-slate-500">這天沒有可預約的時段</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {slots.map((x) => (
              <button
                key={x.hm}
                disabled={x.full}
                onClick={() => setF({ ...f, from: x.hm })}
                className={`rounded-lg border py-2.5 font-mono text-sm ${f.from === x.hm ? "border-cyan-300 bg-cyan-400/30 text-white" : x.full ? "border-slate-700 text-slate-600 line-through" : "border-slate-600 text-slate-200"}`}
              >
                {x.hm}
              </button>
            ))}
          </div>
        )}
      </div>
      {(rules.type === "健身房" || rules.type === "兒童遊戲室") && (
        <Field label="使用人數">
          <input type="number" min={1} className={big} value={f.people} onChange={(e) => setF({ ...f, people: Number(e.target.value) })} />
        </Field>
      )}
      <Field label="備註（選填）">
        <input className={big} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} placeholder={rules.type === "搬家" ? "搬家公司、車牌" : ""} />
      </Field>

      {s.pointsPerHour > 0 && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-50">
          <p>
            本次預計扣 <b className="font-mono">{est}</b> 點（使用當日領取磁扣時扣點）
          </p>
          {f.unitId && <p className="text-xs text-amber-100/80">權狀 {unitPing(f.unitId) || "—"} 坪 · 每坪 1 點</p>}
          {ledger ? (
            <p className="text-xs">
              本期（{ledger.key}）發放 {ledger.allot} 點，已用 {ledger.used} 點，剩餘 <b>{ledger.left}</b> 點
              {over > 0 && (
                <span className="block text-rose-200">
                  不足 {over} 點，將以每點 NT$ {rules.feePerPoint} 併入管理費（約 NT$ {over * rules.feePerPoint}）
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-amber-100/70">填寫戶別與手機後顯示本期剩餘點數</p>
          )}
        </div>
      )}
      {s.deposit && <p className="text-xs text-slate-400">💰 {s.deposit}</p>}
      <ErrorText>{error}</ErrorText>
      <button onClick={submit} disabled={busy || closed} className={`${BTN_PRIMARY} w-full py-3.5 text-base`}>
        {busy ? "送出中…" : s.needApproval ? "送出預約（待管理室審核）" : "確認預約"}
      </button>
    </div>
  );
}

function MyReservations({ building }: { building: Building }) {
  const [unitId, setUnitId] = useState("");
  const [phone, setPhone] = useState("");
  const [list, setList] = useState<Reservation[] | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const r = await api<{ reservations: Reservation[]; ledger: Ledger }>(`/api/reservations?buildingId=${building.id}&unitId=${unitId}&phone=${encodeURIComponent(phone)}`);
      setList(r.reservations.sort((a, b) => b.start.localeCompare(a.start)));
      setLedger(r.ledger);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function cancel(r: Reservation) {
    if (!confirm(`取消 ${r.start.replace("T", " ")} 的${r.type}預約？`)) return;
    try {
      await api(`/api/reservations/${r.id}`, { method: "PATCH", json: { action: "cancel", phone } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <UnitPicker building={building} value={unitId} onChange={setUnitId} className="py-3 text-base" />
      <input type="tel" className={`${INPUT} py-3 text-base`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="預約時填寫的手機" />
      <button onClick={load} disabled={!unitId || phone.replace(/\D/g, "").length < 6} className={`${BTN_PRIMARY} w-full py-3`}>
        查詢
      </button>
      <ErrorText>{error}</ErrorText>
      {ledger && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          本期公設點數：剩餘 <b>{ledger.left}</b> / {ledger.allot} 點{ledger.fee > 0 && `，已累計管理費加收 NT$ ${ledger.fee}`}
        </p>
      )}
      {list && (
        <ul className="space-y-2">
          {list.length === 0 && <li className="text-center text-sm text-slate-500">查無預約</li>}
          {list.map((r) => (
            <li key={r.id} className="rounded-xl border border-cyan-500/30 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{RES_ICON[r.type]}</span>
                <span className="flex-1 text-cyan-50">{r.type}</span>
                <span className={`rounded border px-1.5 text-xs ${RES_STATUS_CLS[r.status]}`}>{r.status}</span>
              </div>
              <p className="mt-1 font-mono text-sm text-slate-300">
                {r.start.replace("T", " ")} – {r.end.slice(11)} · #{r.code}
              </p>
              {(r.status === "待審核" || r.status === "已確認") && (
                <button onClick={() => cancel(r)} className="mt-2 text-sm text-rose-300 underline">
                  取消預約
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
