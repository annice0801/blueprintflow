"use client";

import { useState } from "react";
import { GATE_ACTIONS, GATE_PARTS, GATES, gateState, partState, REPAIR_ACTIONS, type Gate, type GateAction, type GateLog } from "@/lib/records";
import { api, BTN_GHOST, BTN_PRIMARY, ErrorText, Field, fmtDateTime, INPUT, nowLocal, Select } from "./ui";

const TONE = {
  open: { color: "#34d399", text: "text-emerald-300" },
  closed: { color: "#4cc9ff", text: "text-cyan-300" },
  bad: { color: "#ff4d6d", text: "text-rose-300" },
  idle: { color: "#64748b", text: "text-slate-400" },
} as const;

type Props = {
  buildingId: string;
  logs: GateLog[];
  onSaved: (log: GateLog) => void;
  onDeleted: (id: string) => void;
};

export default function DrivewayView({ buildingId, logs, onSaved, onDeleted }: Props) {
  const [filter, setFilter] = useState<Gate | "全部">("全部");
  const [view, setView] = useState<"control" | "repair">("control");
  const [editing, setEditing] = useState<GateLog | null>(null);
  const [form, setForm] = useState(() => blank("汽車"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function blank(gate: Gate) {
    return { gate, action: "開啟" as GateAction, at: nowLocal(), operator: "", note: "", part: "" };
  }

  function chooseGate(gate: Gate, part?: string) {
    setFilter(gate);
    if (part) setView("repair");
    if (!editing) setForm((f) => ({ ...f, gate, ...(part ? { part, action: "故障" as GateAction } : { part: f.gate === gate ? f.part : "" }) }));
  }

  function edit(log: GateLog) {
    setEditing(log);
    setForm({ gate: log.gate, action: log.action, at: log.at, operator: log.operator, note: log.note, part: log.part ?? "" });
  }

  function cancel() {
    setEditing(null);
    setForm(blank(form.gate));
    setError("");
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const log = await api<GateLog>(editing ? `/api/gate-logs/${editing.id}` : "/api/gate-logs", {
        method: editing ? "PATCH" : "POST",
        json: { ...form, buildingId },
      });
      onSaved(log);
      setEditing(null);
      setForm(blank(form.gate));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(log: GateLog) {
    if (!confirm(`刪除 ${fmtDateTime(log.at)} ${log.gate}道閘「${log.action}」紀錄？`)) return;
    await api(`/api/gate-logs/${log.id}`, { method: "DELETE" });
    onDeleted(log.id);
    if (editing?.id === log.id) cancel();
  }

  const isRepair = (l: GateLog) => REPAIR_ACTIONS.includes(l.action) || !!l.part;
  const shown = logs.filter((l) => (filter === "全部" || l.gate === filter) && (view === "repair" ? isRepair(l) : !isRepair(l))).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="grid h-full min-h-0 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
      <div className="flex min-h-[320px] flex-col gap-3 lg:min-h-0">
        <div className="grid grid-cols-2 gap-3">
          {GATES.map((g) => {
            const s = gateState(logs, g);
            return (
              <button
                key={g}
                onClick={() => chooseGate(g)}
                className={`rounded-lg border px-4 py-3 text-left transition ${filter === g ? "border-cyan-300 bg-cyan-400/10" : "border-cyan-500/25 hover:border-cyan-400/60"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: TONE[s.tone].color, boxShadow: `0 0 10px ${TONE[s.tone].color}` }} />
                  <span className="text-sm font-semibold text-cyan-50">{g}道閘</span>
                  <span className={`ml-auto text-sm font-semibold ${TONE[s.tone].text}`}>{s.label}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {s.last ? `最後：${fmtDateTime(s.last.at)}${s.last.operator ? ` · ${s.last.operator}` : ""}` : "尚無操作紀錄"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {GATE_PARTS[g].map((p) => {
                    const ps = partState(logs, g, p);
                    return (
                      <span
                        key={p}
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          chooseGate(g, p);
                        }}
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${ps.bad ? "border-rose-400/60 text-rose-200" : ps.fixing ? "border-amber-400/60 text-amber-200" : "border-slate-600 text-slate-300"}`}
                        title={ps.last ? `${ps.last.action} ${fmtDateTime(ps.last.at)}` : "無維修紀錄"}
                      >
                        {ps.bad ? "⚠ " : ps.fixing ? "🔧 " : ""}
                        {p}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
        <div className="min-h-0 flex-1 rounded-lg border border-cyan-500/20 bg-[#020a17] p-2">
          <DrivewayDrawing logs={logs} car={gateState(logs, "汽車").tone} moto={gateState(logs, "機車").tone} selected={filter} onGate={chooseGate} />
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <div className="space-y-3 rounded-lg border border-cyan-400/40 bg-cyan-400/5 p-3">
          <h3 className="text-sm font-semibold text-cyan-100">{editing ? "編輯紀錄" : "新增開關紀錄"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="道閘">
              <Select value={form.gate} options={GATES} onChange={(gate) => setForm((f) => ({ ...f, gate }))} />
            </Field>
            <Field label="動作">
              <Select value={form.action} options={GATE_ACTIONS} onChange={(action) => setForm((f) => ({ ...f, action }))} />
            </Field>
            <Field label="時間">
              <input type="datetime-local" className={INPUT} value={form.at} onChange={(e) => setForm((f) => ({ ...f, at: e.target.value }))} />
            </Field>
            <Field label="操作人">
              <input className={INPUT} value={form.operator} onChange={(e) => setForm((f) => ({ ...f, operator: e.target.value }))} placeholder="例：保全 王先生" maxLength={40} />
            </Field>
          </div>
          <Field label="感應器 / 設備（故障、維修時選擇）">
            <select className={INPUT} value={form.part} onChange={(e) => setForm((f) => ({ ...f, part: e.target.value }))}>
              <option value="">（整座道閘）</option>
              {GATE_PARTS[form.gate].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="備註">
            <input className={INPUT} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="例：颱風期間常開、感應器故障叫修" maxLength={1000} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            {editing && (
              <button onClick={cancel} className={BTN_GHOST}>
                取消
              </button>
            )}
            <button onClick={save} disabled={busy} className={BTN_PRIMARY}>
              {busy ? "儲存中…" : editing ? "更新紀錄" : "新增紀錄"}
            </button>
          </div>
        </div>

        <div className="flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-lg border border-cyan-500/20">
          <div className="flex items-center gap-1 border-b border-cyan-500/20 px-3 py-2">
            {(
              [
                ["control", "控制紀錄"],
                ["repair", "維修紀錄"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={`mr-1 rounded px-2 py-0.5 text-sm ${view === k ? "bg-cyan-400/20 font-semibold text-cyan-50" : "text-slate-400"}`}>
                {l}
              </button>
            ))}
            <div className="flex-1" />
            {(["全部", ...GATES] as const).map((g) => (
              <button
                key={g}
                onClick={() => setFilter(g)}
                className={`rounded px-2 py-0.5 text-xs ${filter === g ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400 hover:text-cyan-200"}`}
              >
                {g}
              </button>
            ))}
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-cyan-500/10 overflow-y-auto">
            {shown.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">尚無紀錄</li>}
            {shown.map((l) => (
              <li key={l.id} className={`group flex items-start gap-2 px-3 py-2 ${editing?.id === l.id ? "bg-cyan-400/10" : ""}`}>
                <span className="mt-0.5 rounded border border-cyan-500/40 px-1 text-[11px] text-cyan-200">{l.gate}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-cyan-50">
                    {l.part && <span className="mr-1 text-amber-200">{l.part}</span>}
                    {l.action} <span className="font-mono text-xs text-slate-400">{fmtDateTime(l.at)}</span>
                  </p>
                  {(l.operator || l.note) && <p className="truncate text-[11px] text-slate-400">{[l.operator, l.note].filter(Boolean).join(" · ")}</p>}
                </div>
                <button onClick={() => edit(l)} className="text-xs text-cyan-300 hover:underline">
                  編輯
                </button>
                <button onClick={() => remove(l)} className="text-xs text-rose-300 hover:underline">
                  刪除
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

type Tone = keyof typeof TONE;

/** 車道示意圖：上半部平面（出入口、汽機車道閘），下半部剖面（坡道至 B1–B4） */
function DrivewayDrawing({ logs, car, moto, selected, onGate }: { logs: GateLog[]; car: Tone; moto: Tone; selected: Gate | "全部"; onGate: (g: Gate, part?: string) => void }) {
  const line = "#4cc9ff";
  // 感應線圈（虛線框）：依設備狀態著色，點擊直接登錄該設備維修
  const sensor = (g: Gate, part: string, x: number, y1: number, y2: number, label: string) => {
    const ps = partState(logs, g, part);
    const c = ps.bad ? "#ff4d6d" : ps.fixing ? "#ffb020" : "#34d399";
    return (
      <g className="cursor-pointer" onClick={() => onGate(g, part)}>
        <title>{`${g}道閘 ${part}${ps.last ? `：${ps.last.action} ${fmtDateTime(ps.last.at)}` : ""}`}</title>
        <rect x={x - 1.6} y={y1 + 0.6} width={3.2} height={y2 - y1 - 1.2} rx={0.4} fill={c} fillOpacity={0.12} stroke={c} strokeWidth={0.22} strokeDasharray="0.6 0.4">
          {ps.bad && <animate attributeName="stroke-opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />}
        </rect>
        <text x={x} y={(y1 + y2) / 2 + 0.5} fontSize={1.2} fill={c} textAnchor="middle">
          {label}
        </text>
      </g>
    );
  };
  const gate = (g: Gate, y1: number, y2: number, tone: Tone) => {
    const open = tone === "open";
    const c = TONE[tone].color;
    const sel = selected === g;
    return (
      <g className="cursor-pointer" onClick={() => onGate(g)}>
        <rect x={66} y={y1 - 1.5} width={10} height={y2 - y1 + 3} fill={sel ? "rgba(76,201,255,0.12)" : "transparent"} stroke={sel ? line : "none"} strokeWidth={0.2} rx={0.8} />
        <rect x={70} y={y1 - 1.2} width={2} height={2} fill="#0b2545" stroke={c} strokeWidth={0.25} />
        {/* 柵欄臂：關閉時橫跨車道，開啟時收到車道邊 */}
        <line x1={71} y1={y1 - 0.2} x2={open ? 63 : 71} y2={open ? y1 - 0.2 : y2} stroke={c} strokeWidth={0.6} strokeLinecap="round" strokeDasharray={open ? "1.2 0.6" : undefined} />
        <circle cx={73.5} cy={y1 - 0.2} r={0.7} fill={c}>
          {tone === "bad" && <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />}
        </circle>
        <text x={71} y={y2 + 3} fontSize={1.6} fill="#d6f3ff" textAnchor="middle">
          {g}道閘
        </text>
      </g>
    );
  };

  return (
    <svg viewBox="0 0 100 78" className="h-full w-full select-none">
      <defs>
        <marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0 0 L6 3 L0 6 Z" fill={line} />
        </marker>
        <pattern id="hatch" width="1.5" height="1.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="1.5" stroke="#1b4f75" strokeWidth="0.3" />
        </pattern>
      </defs>

      <text x={2} y={4} fontSize={2} fill="#a5e4ff" fontWeight={700}>
        平面 · 車道出入口
      </text>
      {/* 道路與人行道 */}
      <rect x={86} y={6} width={13} height={36} fill="#0a1a2e" />
      <text x={92.5} y={24} fontSize={2} fill="#7dd3fc" textAnchor="middle" writingMode="tb" letterSpacing={0.6}>
        東側道路
      </text>
      <rect x={80} y={6} width={6} height={36} fill="url(#hatch)" />
      <text x={83} y={8.5} fontSize={1.3} fill="#7dd3fc" textAnchor="middle">
        人行道
      </text>
      {/* 機車道（上） */}
      <rect x={20} y={10} width={60} height={6} fill="rgba(167,139,250,0.08)" stroke="#a78bfa" strokeWidth={0.25} />
      <line x1={58} y1={13} x2={24} y2={13} stroke="#a78bfa" strokeWidth={0.3} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
      <text x={40} y={12.2} fontSize={1.4} fill="#c4b5fd" textAnchor="middle">
        機車 進出
      </text>
      {/* 汽車道（下，雙向） */}
      <rect x={20} y={22} width={60} height={12} fill="rgba(76,201,255,0.06)" stroke={line} strokeWidth={0.25} />
      <line x1={20} y1={28} x2={80} y2={28} stroke={line} strokeWidth={0.15} strokeDasharray="2 1.2" />
      <line x1={58} y1={25} x2={24} y2={25} stroke={line} strokeWidth={0.3} markerEnd="url(#arrow)" />
      <line x1={24} y1={31} x2={58} y2={31} stroke={line} strokeWidth={0.3} markerEnd="url(#arrow)" />
      <text x={40} y={24.4} fontSize={1.4} fill="#7dd3fc" textAnchor="middle">
        汽車 入
      </text>
      <text x={40} y={33.4} fontSize={1.4} fill="#7dd3fc" textAnchor="middle">
        汽車 出
      </text>
      {/* 感應器：汽車道閘前（路側）第一感應點、閘後第二感應點；機車道閘各自一組 */}
      {sensor("機車", "感應器", 76.5, 10, 16, "感")}
      {sensor("汽車", "第一感應點", 76.5, 22, 34, "①")}
      {sensor("汽車", "第二感應點", 64, 22, 34, "②")}
      {(() => {
        const ps = partState(logs, "汽車", "路口紅綠燈");
        const c = ps.bad ? "#ff4d6d" : ps.fixing ? "#ffb020" : "#34d399";
        return (
          <g className="cursor-pointer" onClick={() => onGate("汽車", "路口紅綠燈")}>
            <title>汽車道閘 路口紅綠燈</title>
            <rect x={81} y={35.2} width={3.6} height={1.8} rx={0.4} fill="#0b2545" stroke={c} strokeWidth={0.2} />
            <circle cx={82} cy={36.1} r={0.5} fill="#ff4d6d" />
            <circle cx={83.6} cy={36.1} r={0.5} fill="#34d399" />
            <text x={82.8} y={38.6} fontSize={1} fill="#7dd3fc" textAnchor="middle">
              紅綠燈
            </text>
          </g>
        );
      })()}
      {/* 坡道起點 */}
      <rect x={6} y={10} width={14} height={24} fill="url(#hatch)" stroke={line} strokeWidth={0.25} />
      <text x={13} y={22} fontSize={1.6} fill="#d6f3ff" textAnchor="middle">
        坡道 ↓
      </text>

      {gate("機車", 10, 16, moto)}
      {gate("汽車", 22, 34, car)}

      {/* 剖面 */}
      <text x={2} y={47} fontSize={2} fill="#a5e4ff" fontWeight={700}>
        剖面 · 坡道至地下室
      </text>
      {["1F", "B1", "B2", "B3", "B4"].map((lv, i) => {
        const y = 50 + i * 6.5;
        return (
          <g key={lv}>
            <line x1={10} y1={y} x2={96} y2={y} stroke={i === 0 ? "#7dd3fc" : "#1b74a8"} strokeWidth={i === 0 ? 0.35 : 0.2} />
            <text x={2} y={y + 0.6} fontSize={1.6} fill="#a5e4ff">
              {lv}
            </text>
            {i < 4 && (
              <line
                x1={i % 2 ? 30 : 76}
                y1={y}
                x2={i % 2 ? 76 : 30}
                y2={y + 6.5}
                stroke={line}
                strokeWidth={0.45}
                markerEnd="url(#arrow)"
              />
            )}
          </g>
        );
      })}
      <text x={90} y={49} fontSize={1.3} fill="#7dd3fc" textAnchor="middle">
        出入口
      </text>
    </svg>
  );
}
