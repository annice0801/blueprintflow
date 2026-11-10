"use client";

import { useState } from "react";

// 圖表：單一系列用 C1；數值文字用文字色，不用系列色
export const C1 = "#3987e5";
const GRID = "#163150";

export type Usage = {
  days: number;
  daily: { date: string; users: number; views: number; actions: number }[];
  areas: { area: string; views: number; users: number }[];
  users: { email: string; name: string; role: string; status: string; views: number; views7: number; activeDays: number; actions: number; lastAt: string | null; lastLoginAt: string; top: string[] }[];
  heat: number[][];
  totals: { activeUsers: number; active7: number; views: number; actions: number };
};

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-white/[0.02] p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-3xl text-cyan-50">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

/** 每日長條圖（單一系列；標題即系列名稱，不需圖例） */
export function DailyBars({ data, unit, height = 160 }: { data: { date: string; value: number }[]; unit: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const pad = { l: 28, r: 4, t: 8, b: 20 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = max <= 5 ? max : Math.ceil(max / 5) * 5;
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / nice);
  const base = H - pad.b;
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`每日${unit}`} onMouseLeave={() => setHover(null)}>
        {(nice < 2 ? [0, 1] : [0, 0.5, 1]).map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(nice * f)} y2={y(nice * f)} stroke={GRID} strokeWidth={1} />
            <text x={pad.l - 6} y={y(nice * f)} fontSize={10} fill="#64748b" textAnchor="end" dominantBaseline="central">
              {Math.round(nice * f)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw + 1;
          const w = Math.max(1, bw - 2); // 2px 間隔
          const top = y(d.value);
          const r = Math.min(4, w / 2, base - top);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={base - pad.t} fill="transparent" />
              {d.value > 0 && <path d={`M${x} ${base} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + w - r} Q${x + w} ${top} ${x + w} ${top + r} V${base} Z`} fill={C1} opacity={hover === null || hover === i ? 1 : 0.55} />}
            </g>
          );
        })}
        {data.map((d, i) =>
          i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? (
            <text key={d.date} x={pad.l + i * bw + bw / 2} y={H - 5} fontSize={10} fill="#64748b" textAnchor="middle">
              {Number(d.date.slice(5, 7))}/{Number(d.date.slice(8))}
            </text>
          ) : null,
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 rounded-md border border-cyan-400/40 bg-[#06142a] px-2 py-1 text-xs shadow-lg" style={{ left: `${((pad.l + (hover! + 0.5) * bw) / W) * 100}%`, transform: "translateX(-50%)" }}>
          <p className="text-slate-400">{h.date}</p>
          <p className="text-cyan-50">
            {h.value} {unit}
          </p>
        </div>
      )}
    </div>
  );
}

/** 橫向長條（排行） */
export function HBars({ rows, max }: { rows: { label: string; value: number; sub?: string }[]; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs" title={r.sub}>
          <span className="truncate text-slate-300">{r.label}</span>
          <span className="h-3 rounded-r" style={{ width: `${Math.max(2, (r.value / m) * 100)}%`, background: C1 }} />
          <span className="text-right font-mono text-slate-200">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

const WEEK = ["一", "二", "三", "四", "五", "六", "日"];
// 依序：少 → 多（單一色相，深 → 亮，適合深色底）
const RAMP = ["#0d2340", "#123a68", "#1b5596", "#2b72c6", "#4f97ea", "#8cc0ff"];

/** 星期 × 時段熱度圖 */
export function Heatmap({ heat }: { heat: number[][] }) {
  const [tip, setTip] = useState<string>("");
  const max = Math.max(1, ...heat.flat());
  const step = (v: number) => (v === 0 ? "transparent" : RAMP[Math.min(RAMP.length - 1, Math.floor((v / max) * (RAMP.length - 1e-9)))]);
  return (
    <div>
      <div className="grid grid-cols-[1.5rem_repeat(24,minmax(0,1fr))] gap-[2px] text-[10px] text-slate-500">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center">
            {h % 3 === 0 ? h : ""}
          </span>
        ))}
        {heat.map((row, d) => (
          <div key={d} className="contents">
            <span className="self-center">{WEEK[d]}</span>
            {row.map((v, h) => (
              <span
                key={h}
                onMouseEnter={() => setTip(`星期${WEEK[d]} ${h}:00–${h + 1}:00　${v} 次`)}
                onMouseLeave={() => setTip("")}
                className="aspect-square rounded-[3px] border border-white/[0.04]"
                style={{ background: step(v) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
        <span>少</span>
        {RAMP.map((c) => (
          <span key={c} className="h-2.5 w-4 rounded-sm" style={{ background: c }} />
        ))}
        <span>多</span>
        <span className="ml-3 text-slate-300">{tip}</span>
      </div>
    </div>
  );
}

export const timeAgo = (iso: string | null) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "剛剛";
  if (m < 60) return `${m} 分鐘前`;
  if (m < 1440) return `${Math.round(m / 60)} 小時前`;
  return `${Math.round(m / 1440)} 天前`;
};
