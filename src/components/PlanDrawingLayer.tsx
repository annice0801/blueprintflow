"use client";

import type { GroundKind, PlanDrawing, TreeTone } from "@/lib/plan-drawing";

const WALL = "#dff6ff";
const FIX = "#7dd3fc";

/** 標準層向量圖：牆、門（門扇 + 開啟弧）、落地門窗、衛浴廚具、電梯、樓梯 */
const seg = (l: { x1: number; y1: number; x2: number; y2: number }) => ({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 });

const GROUND: Record<GroundKind, { fill: string; stroke?: string }> = {
  road: { fill: "rgba(71,85,105,0.32)" },
  asphalt: { fill: "rgba(51,65,85,0.6)", stroke: "rgba(148,163,184,0.4)" },
  paving: { fill: "rgba(148,163,184,0.07)" },
  lawn: { fill: "rgba(34,197,94,0.22)", stroke: "rgba(74,222,128,0.45)" },
  planter: { fill: "rgba(21,128,61,0.38)", stroke: "rgba(74,222,128,0.6)" },
  hedge: { fill: "rgba(22,101,52,0.45)" },
  play: { fill: "rgba(110,231,183,0.14)", stroke: "rgba(110,231,183,0.6)" },
  grid: { fill: "rgba(74,222,128,0.12)", stroke: "rgba(74,222,128,0.5)" },
};
const TREE: Record<TreeTone, string> = { green: "#4ade80", orange: "#fbbf24", pink: "#f9a8d4", red: "#f87171", purple: "#c4b5fd", blue: "#67e8f9" };

/** 地面景觀：道路、鋪面、草坪、花台、樹木、遊具（畫在分區標籤之下） */
export function GroundLayer({ d }: { d: PlanDrawing }) {
  const u = d.unit;
  return (
    <g pointerEvents="none">
      {d.areas?.map((a, i) => (
        <polygon key={`a${i}`} points={a.pts.map((p) => p.join(",")).join(" ")} fill={GROUND[a.kind].fill} stroke={GROUND[a.kind].stroke ?? "none"} strokeWidth={u * 0.8} strokeDasharray={a.kind === "grid" ? `${u * 2} ${u * 2}` : undefined} />
      ))}
      {d.blobs?.map((b, i) => (
        <ellipse key={`b${i}`} cx={b.x} cy={b.y} rx={b.rx} ry={b.ry} transform={`rotate(${b.rot} ${b.x} ${b.y})`} fill="rgba(110,231,183,0.25)" stroke="rgba(167,243,208,0.8)" strokeWidth={u * 0.8} />
      ))}
      {d.trees?.map((t, i) => (
        <g key={`t${i}`}>
          <circle cx={t.x} cy={t.y} r={t.r} fill={TREE[t.tone]} fillOpacity={0.28} stroke={TREE[t.tone]} strokeOpacity={0.75} strokeWidth={u * 0.9} />
          <circle cx={t.x - t.r * 0.3} cy={t.y - t.r * 0.25} r={t.r * 0.42} fill={TREE[t.tone]} fillOpacity={0.25} />
          <circle cx={t.x} cy={t.y} r={u * 1.4} fill={TREE[t.tone]} fillOpacity={0.8} />
        </g>
      ))}
      {d.labels?.map((l, i) => (
        <text
          key={`l${i}`}
          x={l.x}
          y={l.y}
          fontSize={l.size}
          fill="#7dd3fc"
          fillOpacity={0.75}
          textAnchor="middle"
          dominantBaseline="middle"
          letterSpacing={l.vertical ? 0 : 0.05}
          style={l.vertical ? { writingMode: "vertical-rl" } : undefined}
        >
          {l.text}
        </text>
      ))}
    </g>
  );
}

export default function PlanDrawingLayer({ d }: { d: PlanDrawing }) {
  const u = d.unit; // 原圖 1 px 的公尺數，用來設定線寬與設備尺寸
  const thin = u * 0.55;
  return (
    <g pointerEvents="none" strokeLinecap="square" fill="none">
      {/* 結構柱（1F） */}
      {d.columns?.map((c, i) => (
        <rect key={`c${i}`} x={c.x} y={c.y} width={c.w} height={c.h} fill="#a5e4ff" fillOpacity={0.7} />
      ))}

      {/* 欄杆 / 雨遮外緣 */}
      {d.rails.map((l, i) => (
        <line key={`r${i}`} {...seg(l)} stroke={FIX} strokeOpacity={0.45} strokeWidth={thin} />
      ))}

      {/* 牆 */}
      {d.walls.map((w, i) => (
        <line key={`w${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke={WALL} strokeWidth={w.ext ? u * 2.6 : u * 1.6} />
      ))}

      {/* 落地門 / 窗：牆上開口 + 折疊門扇 */}
      {d.folds.map((f, i) => {
        const horiz = f.y1 === f.y2;
        const len = horiz ? f.x2 - f.x1 : f.y2 - f.y1;
        const out = (f.dir === "U" || f.dir === "L" ? -1 : 1) * Math.min(Math.abs(len) * 0.45, u * 6);
        const p = (t: number, k: number) => (horiz ? `${f.x1 + len * t},${f.y1 + out * k}` : `${f.x1 + out * k},${f.y1 + len * t}`);
        return (
          <g key={`f${i}`}>
            <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#030d1c" strokeWidth={u * 2.8} strokeLinecap="butt" />
            <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={FIX} strokeWidth={thin} strokeLinecap="butt" />
            <polyline points={`${p(0, 0)} ${p(0.25, 1)} ${p(0.5, 0)} ${p(0.75, 1)} ${p(1, 0)}`} stroke={FIX} strokeWidth={thin} strokeLinejoin="round" />
          </g>
        );
      })}

      {/* 門：門洞遮牆、門扇、開啟弧 */}
      {d.doors.map((dr, i) => {
        const r = Math.hypot(dr.ox - dr.hx, dr.oy - dr.hy);
        const cross = (dr.ox - dr.hx) * (dr.cy - dr.hy) - (dr.oy - dr.hy) * (dr.cx - dr.hx);
        return (
          <g key={`d${i}`}>
            <line x1={dr.hx} y1={dr.hy} x2={dr.cx} y2={dr.cy} stroke="#030d1c" strokeWidth={u * 2.8} strokeLinecap="butt" />
            <line x1={dr.hx} y1={dr.hy} x2={dr.ox} y2={dr.oy} stroke={WALL} strokeWidth={u * 0.9} />
            <path d={`M${dr.ox} ${dr.oy} A${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${dr.cx} ${dr.cy}`} stroke={FIX} strokeWidth={thin} strokeDasharray={`${u * 1.2} ${u * 0.6}`} />
          </g>
        );
      })}

      {d.dashed.map((l, i) => (
        <line key={`x${i}`} {...seg(l)} stroke={FIX} strokeOpacity={0.7} strokeWidth={thin} strokeDasharray={`${u * 2} ${u * 1.4}`} />
      ))}
      {d.lines.map((l, i) => (
        <line key={`l${i}`} {...seg(l)} stroke={FIX} strokeWidth={thin} />
      ))}
      {d.polylines.map((pl, i) => (
        <polyline key={`p${i}`} points={pl.map((q) => q.join(",")).join(" ")} stroke={FIX} strokeWidth={u * 0.9} />
      ))}

      {/* 樓梯：外框、踏階、中央扶手 */}
      {d.stairs.map((s, i) => {
        const step = u * 4.3;
        const n = Math.floor((s.orient === "v" ? s.w : s.h) / step);
        return (
          <g key={`s${i}`} stroke={FIX} strokeWidth={thin}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} />
            {Array.from({ length: n }, (_, k) =>
              s.orient === "v" ? (
                <line key={k} x1={s.x + (k + 0.5) * step} y1={s.y} x2={s.x + (k + 0.5) * step} y2={s.y + s.h} />
              ) : (
                <line key={k} x1={s.x} y1={s.y + (k + 0.5) * step} x2={s.x + s.w} y2={s.y + (k + 0.5) * step} />
              ),
            )}
            <line x1={s.x} y1={s.mid} x2={s.x + s.w * 0.8} y2={s.mid} stroke={WALL} strokeWidth={u * 1.8} />
          </g>
        );
      })}

      {/* 衛浴、廚具、電梯 */}
      {d.fixtures.map((f, i) => {
        const k = `x${i}`;
        switch (f.kind) {
          case "basin":
            return (
              <g key={k} stroke={FIX} strokeWidth={thin}>
                <circle cx={f.x} cy={f.y} r={u * 2.6} />
                <circle cx={f.x} cy={f.y} r={u * 0.6} fill={FIX} />
              </g>
            );
          case "toilet": {
            // 水箱貼牆、馬桶座朝 dir
            const rot = { R: 0, D: 90, L: 180, U: 270 }[f.dir];
            return (
              <g key={k} transform={`translate(${f.x} ${f.y}) rotate(${rot})`} stroke={FIX} strokeWidth={thin}>
                <rect x={-u * 5.2} y={-u * 3.2} width={u * 2.4} height={u * 6.4} rx={u * 0.5} />
                <ellipse cx={u * 0.6} cy={0} rx={u * 3.6} ry={u * 2.6} />
              </g>
            );
          }
          case "tub":
            return (
              <g key={k} stroke={FIX} strokeWidth={thin}>
                <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={u} />
                <rect x={f.x + u * 1.2} y={f.y + u * 1.2} width={f.w - u * 2.4} height={f.h - u * 2.4} rx={Math.min(f.w, f.h) * 0.4} />
              </g>
            );
          case "stove":
            return (
              <g key={k} stroke={FIX} strokeWidth={thin}>
                <rect x={f.x} y={f.y} width={f.w} height={f.h} />
                {[0.28, 0.72].flatMap((a) =>
                  [0.3, 0.7].map((b) => <circle key={`${a}${b}`} cx={f.x + f.w * a} cy={f.y + f.h * b} r={Math.min(f.w, f.h) * 0.16} />),
                )}
              </g>
            );
          case "ksink":
            return (
              <g key={k} stroke={FIX} strokeWidth={thin}>
                <rect x={f.x} y={f.y} width={f.w} height={f.h} />
                <rect x={f.x + f.w * 0.15} y={f.y + f.h * 0.18} width={f.w * 0.7} height={f.h * 0.64} rx={u * 0.8} />
              </g>
            );
          case "xbox":
            return (
              <g key={k} stroke={FIX} strokeWidth={thin}>
                <rect x={f.x} y={f.y} width={f.w} height={f.h} />
                <line x1={f.x} y1={f.y} x2={f.x + f.w} y2={f.y + f.h} />
                <line x1={f.x + f.w} y1={f.y} x2={f.x} y2={f.y + f.h} />
              </g>
            );
          case "hatch": {
            const n = Math.ceil((f.w + f.h) / (u * 1.6));
            return (
              <g key={k} stroke={FIX} strokeWidth={thin}>
                <rect x={f.x} y={f.y} width={f.w} height={f.h} />
                <clipPath id={`h-${i}-${f.x}`}>
                  <rect x={f.x} y={f.y} width={f.w} height={f.h} />
                </clipPath>
                <g clipPath={`url(#h-${i}-${f.x})`}>
                  {Array.from({ length: n }, (_, j) => (
                    <line key={j} x1={f.x + j * u * 1.6} y1={f.y} x2={f.x + j * u * 1.6 - f.h} y2={f.y + f.h} />
                  ))}
                </g>
              </g>
            );
          }
          default:
            return <rect key={k} x={f.x} y={f.y} width={f.w} height={f.h} stroke={FIX} strokeWidth={thin} />;
        }
      })}
    </g>
  );
}
