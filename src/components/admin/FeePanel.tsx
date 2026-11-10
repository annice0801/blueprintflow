"use client";

import { useEffect, useMemo, useState } from "react";
import { residentUnits, unitLabel, type Building } from "@/lib/buildings";
import { FEE_STATUS, PAY_METHODS, type FeeBill, type FeeSettings, type FeeStatus } from "@/lib/households";
import { useCan } from "../auth/AuthProvider";
import { api, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, Field, INPUT, Modal } from "../ui";
import { Stat } from "./charts";

const TONE: Record<FeeStatus, string> = { 未繳: "text-amber-300", 部分繳: "text-orange-300", 已繳: "text-emerald-300", 免繳: "text-slate-400" };
const thisPeriod = () => new Date().toISOString().slice(0, 7);
const money = (n: number) => `$${n.toLocaleString()}`;

/** 管理費：費率、每月開單、繳費登記、收繳率與欠繳 */
export default function FeePanel({ building }: { building: Building }) {
  const can = useCan();
  const edit = can("fees", "edit");
  const [period, setPeriod] = useState(thisPeriod());
  const [bills, setBills] = useState<FeeBill[]>([]);
  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [status, setStatus] = useState<"" | FeeStatus | "open">("");
  const [q, setQ] = useState("");
  const [pay, setPay] = useState<FeeBill | null>(null);
  const [showRates, setShowRates] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = () => api<FeeBill[]>("/api/fees").then(setBills, (e) => setError((e as Error).message));
  useEffect(() => {
    load();
    api<FeeSettings>("/api/fees/settings").then(setSettings, () => {});
  }, []);

  const order = useMemo(() => new Map(residentUnits(building).map((u, i) => [u.id, i])), [building]);
  const month = bills.filter((b) => b.period === period);
  const due = month.reduce((s, b) => s + (b.status === "免繳" ? 0 : b.amount), 0);
  const got = month.reduce((s, b) => s + b.paid, 0);
  const rate = due ? Math.round((got / due) * 1000) / 10 : 0;
  const arrears = useMemo(() => {
    const m = new Map<string, { periods: string[]; amount: number; payer: string }>();
    for (const b of bills)
      if (b.status === "未繳" || b.status === "部分繳") {
        const x = m.get(b.unitId) ?? { periods: [], amount: 0, payer: b.payerName };
        x.periods.push(b.period);
        x.amount += b.amount - b.paid;
        x.payer = b.payerName;
        m.set(b.unitId, x);
      }
    return [...m.entries()].sort((a, b) => b[1].periods.length - a[1].periods.length || b[1].amount - a[1].amount);
  }, [bills]);

  const rows = month
    .filter((b) => (status === "open" ? b.status === "未繳" || b.status === "部分繳" : !status || b.status === status) && (!q || `${unitLabel(b.unitId)} ${b.payerName}`.includes(q)))
    .sort((a, b) => (order.get(a.unitId) ?? 0) - (order.get(b.unitId) ?? 0));

  async function generate(overwrite = false) {
    setError("");
    setMsg("");
    try {
      const r = await api<{ created: number; updated: number }>("/api/fees", { method: "POST", json: { period, overwrite } });
      setMsg(`${period}：新開 ${r.created} 張${overwrite ? `，重算 ${r.updated} 張未繳帳單` : ""}`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function exportCsv() {
    const head = ["戶別", "月份", "應繳", "已繳", "狀態", "繳費人身分", "繳費人", "繳費日", "方式", "備註"];
    const body = month.map((b) => [unitLabel(b.unitId), b.period, b.amount, b.paid, b.status, b.payerRole, b.payerName, b.paidAt, b.method, b.note]);
    const csv = "﻿" + [head, ...body].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${building.name}管理費_${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" className={`${INPUT} max-w-44 py-1.5`} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="月份" />
        {edit && (
          <>
            <button onClick={() => generate(false)} className={BTN_PRIMARY}>
              產生 {period} 帳單
            </button>
            {month.length > 0 && (
              <button onClick={() => confirm("依目前坪數、車位與費率，重算本月「未繳」帳單金額？已繳帳單不受影響。") && generate(true)} className={BTN_OUTLINE}>
                重算未繳金額
              </button>
            )}
            <button onClick={() => setShowRates((v) => !v)} className={BTN_OUTLINE}>
              ⚙ 費率設定
            </button>
          </>
        )}
        {month.length > 0 && (
          <button onClick={exportCsv} className={BTN_OUTLINE}>
            ⬇ 匯出 CSV
          </button>
        )}
        {msg && <span className="text-xs text-emerald-300">{msg}</span>}
      </div>
      <ErrorText>{error}</ErrorText>
      {showRates && settings && (
        <Rates
          s={settings}
          onSaved={(s) => {
            setSettings(s);
            setShowRates(false);
            setMsg("費率已更新，可按「重算未繳金額」套用到本月");
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`${period} 應收`} value={money(due)} sub={`${month.length} 戶`} />
        <Stat label="已收" value={money(got)} sub={`${month.filter((b) => b.status === "已繳").length} 戶已繳清`} />
        <Stat label="收繳率" value={`${rate}%`} sub={`未收 ${money(Math.max(0, due - got))}`} />
        <Stat label="累計欠繳戶" value={<span className={arrears.length ? "text-rose-300" : ""}>{arrears.length}</span>} sub={`共 ${money(arrears.reduce((s, [, a]) => s + a.amount, 0))}`} />
      </div>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-0 flex-col rounded-lg border border-cyan-500/20">
          <div className="flex flex-wrap items-center gap-1 border-b border-cyan-500/20 px-3 py-2 text-xs">
            {(["", "open", ...FEE_STATUS] as const).map((k) => (
              <button key={k || "all"} onClick={() => setStatus(k)} className={`rounded px-2 py-1 ${status === k ? "bg-cyan-400/20 text-cyan-50" : "text-slate-400 hover:text-cyan-200"}`}>
                {k === "" ? `全部 ${month.length}` : k === "open" ? "待收" : `${k} ${month.filter((b) => b.status === k).length}`}
              </button>
            ))}
            <input className={`${INPUT} ml-auto max-w-48 py-1 text-xs`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋戶別、繳費人" />
          </div>
          {month.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              {period} 尚未開單{edit && "，按上方「產生帳單」依坪數與車位自動計算"}
            </p>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-[#06142a] text-left text-xs text-cyan-300">
                  <tr className="border-b border-cyan-500/30">
                    <th className="px-3 py-2">戶別</th>
                    <th className="px-3 py-2">繳費人</th>
                    <th className="px-3 py-2">應繳</th>
                    <th className="px-3 py-2">已繳</th>
                    <th className="px-3 py-2">狀態</th>
                    <th className="px-3 py-2">繳費日 / 方式</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className="border-b border-cyan-500/10">
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-cyan-100">{unitLabel(b.unitId)}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-300">
                        {b.payerName || <span className="text-slate-600">（未登錄）</span>}
                        <span className="ml-1 text-[10px] text-slate-500">{b.payerRole}</span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs">{money(b.amount)}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{money(b.paid)}</td>
                      <td className={`px-3 py-1.5 text-xs ${TONE[b.status]}`}>{b.status}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-400">{b.paidAt ? `${b.paidAt} · ${b.method}` : "—"}</td>
                      <td className="px-3 py-1.5 text-right">
                        {edit && (
                          <button onClick={() => setPay(b)} className="text-xs text-cyan-300 hover:underline">
                            {b.status === "已繳" ? "修改" : "登記繳費"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="flex min-h-0 flex-col rounded-lg border border-cyan-500/20">
          <h3 className="border-b border-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-50">欠繳名單（全部月份）</h3>
          {arrears.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">沒有欠繳</p>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-cyan-500/10 overflow-y-auto">
              {arrears.map(([unit, a]) => (
                <li key={unit} className="px-3 py-2">
                  <p className="flex text-sm">
                    <span className="font-mono text-xs text-cyan-100">{unitLabel(unit)}</span>
                    <span className="ml-auto font-mono text-xs text-rose-300">{money(a.amount)}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {a.payer || "（未登錄）"} · 欠 {a.periods.length} 期：{a.periods.sort().join("、")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {pay && <PayDialog bill={pay} onClose={() => setPay(null)} onSaved={(b) => setBills((all) => all.map((x) => (x.id === b.id ? b : x)))} />}
    </div>
  );
}

function Rates({ s, onSaved }: { s: FeeSettings; onSaved: (s: FeeSettings) => void }) {
  const [f, setF] = useState(s);
  const [error, setError] = useState("");
  async function save() {
    try {
      onSaved(await api<FeeSettings>("/api/fees/settings", { method: "PUT", json: f }));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const field = (k: keyof FeeSettings, label: string) => (
    <Field label={label}>
      <input type="number" min={0} className={INPUT} value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
    </Field>
  );
  return (
    <section className="rounded-lg border border-cyan-500/20 p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {field("perPing", "每坪單價（元 / 月）")}
        {field("car", "汽車位（元 / 月）")}
        {field("moto", "機車位（元 / 月）")}
        {field("bike", "腳踏車位（元 / 月）")}
        {field("dueDay", "每月繳費期限（日）")}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-[11px] text-slate-500">每戶管理費 = 權狀坪數 × 每坪單價 + 各類車位月費（「社區租用」車位不計）；個別戶可在名冊設定特殊金額。</p>
        <div className="flex-1" />
        <button onClick={save} className={BTN_PRIMARY}>
          儲存費率
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
    </section>
  );
}

function PayDialog({ bill, onClose, onSaved }: { bill: FeeBill; onClose: () => void; onSaved: (b: FeeBill) => void }) {
  const [f, setF] = useState({ paid: bill.paid || bill.amount, amount: bill.amount, paidAt: bill.paidAt || new Date().toISOString().slice(0, 10), method: bill.method || "轉帳", note: bill.note });
  const [error, setError] = useState("");
  async function submit(waive = false) {
    try {
      onSaved(await api<FeeBill>(`/api/fees/${encodeURIComponent(bill.id)}`, { method: "PATCH", json: waive ? { waive: true, note: f.note } : f }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title="登記繳費"
      subtitle={`${unitLabel(bill.unitId)} · ${bill.period} · ${bill.payerName || "未登錄繳費人"}`}
      onClose={onClose}
      onSubmit={() => submit()}
      footer={
        <>
          <button type="button" onClick={() => confirm("將本期設為免繳？") && submit(true)} className="text-xs text-slate-400 hover:underline">
            設為免繳
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" className={BTN_PRIMARY}>
            儲存
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="應繳金額">
          <input type="number" min={0} className={INPUT} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
        </Field>
        <Field label="實收金額">
          <input type="number" min={0} className={INPUT} value={f.paid} onChange={(e) => setF({ ...f, paid: Number(e.target.value) })} />
        </Field>
        <Field label="繳費日">
          <input type="date" className={INPUT} value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} />
        </Field>
        <Field label="方式">
          <select className={INPUT} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            {PAY_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="備註（收據號碼等）" className="col-span-2">
          <input className={INPUT} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
      </div>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
