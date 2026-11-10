"use client";

import { useMemo } from "react";
import type { FlowEdge, FlowNode } from "@/lib/sops";

export type GraphNode = FlowNode & { sub?: string; accent?: string };

type Props = {
  nodes: GraphNode[];
  edges: FlowEdge[];
  active: string | null;
  visited?: string[];
  /** next：只亮下一步；all：亮起所有下游（組織架構） */
  reach?: "next" | "all";
  onSelect: (id: string) => void;
  nodeWidth?: number;
};

const H = 58;
const GAP_X = 26;
const GAP_Y = 54;

/** 分層排版：最長路徑分層 + 父節點重心排序 */
function layout(nodes: GraphNode[], edges: FlowEdge[], W: number) {
  const ids = nodes.map((n) => n.id);
  const preds = new Map(ids.map((id) => [id, [] as string[]]));
  for (const e of edges) preds.get(e.to)?.push(e.from);
  const layer = new Map<string, number>();
  const depth = (id: string, seen = new Set<string>()): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const ps = preds.get(id) ?? [];
    const d = ps.length ? Math.max(...ps.map((p) => depth(p, seen) + 1)) : 0;
    layer.set(id, d);
    return d;
  };
  ids.forEach((id) => depth(id));

  const layers: string[][] = [];
  for (const id of ids) (layers[layer.get(id)!] ??= []).push(id);
  const pos = new Map<string, { x: number; y: number }>();
  const place = () => {
    const widest = Math.max(...layers.map((l) => l.length));
    const total = widest * W + (widest - 1) * GAP_X;
    layers.forEach((l, li) => {
      const row = l.length * W + (l.length - 1) * GAP_X;
      l.forEach((id, i) => pos.set(id, { x: (total - row) / 2 + i * (W + GAP_X) + W / 2, y: li * (H + GAP_Y) + H / 2 }));
    });
    return total;
  };
  place();
  // 依父節點平均 x 排序兩輪，減少交叉
  for (let k = 0; k < 2; k++) {
    for (let li = 1; li < layers.length; li++) {
      const bary = (id: string) => {
        const ps = preds.get(id)!.filter((p) => layer.get(p)! < li);
        return ps.length ? ps.reduce((s, p) => s + pos.get(p)!.x, 0) / ps.length : pos.get(id)!.x;
      };
      layers[li].sort((a, b) => bary(a) - bary(b));
    }
    place();
  }
  const width = place();
  return { pos, width, height: layers.length * (H + GAP_Y) - GAP_Y };
}

/** 依字寬折成最多兩行（中文 1、英數 0.55），超過以「…」結尾 */
function wrap(text: string, max: number) {
  const out: string[] = [];
  let line = "";
  let w = 0;
  for (const ch of text) {
    const cw = ch.charCodeAt(0) > 255 ? 1 : 0.55;
    if (w + cw > max) {
      out.push(line);
      line = "";
      w = 0;
    }
    line += ch;
    w += cw;
  }
  if (line) out.push(line);
  if (out.length > 2) return [out[0], out[1].slice(0, -1) + "…"];
  return out;
}

type Pt = { x: number; y: number };
const cubic = (t: number, p0: number, p1: number, p2: number, p3: number) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;

function backPath(a: Pt, b: Pt, W: number) {
  const d = `M${a.x + W / 2} ${a.y} C${a.x + W / 2 + 60} ${a.y}, ${b.x + W / 2 + 60} ${b.y}, ${b.x + W / 2} ${b.y}`;
  return { d, label: [Math.max(a.x, b.x) + W / 2 + 30, (a.y + b.y) / 2] as [number, number] };
}

/** 往下的連線；若直線路徑會穿過中間層的方塊，改從方塊旁的空隙繞過 */
function routePath(x1: number, y1: number, x2: number, y2: number, a: Pt, b: Pt, pos: Map<string, Pt>, W: number, t: number) {
  const blocker = [...pos.values()]
    .filter((n) => n.y > a.y + 1 && n.y < b.y - 1)
    .sort((m, n) => m.y - n.y)
    .find((n) => Math.abs(n.x - (x1 + ((x2 - x1) * (n.y - y1)) / (y2 - y1))) < W / 2 + 6);
  // 標籤預設放在連線前段，貼近分支起點；同一點分出多條時改放在後段，避免擠在一起
  if (!blocker) {
    const ym = (y1 + y2) / 2;
    return { d: `M${x1} ${y1} C${x1} ${ym}, ${x2} ${ym}, ${x2} ${y2 - 2}`, label: [cubic(t, x1, x1, x2, x2), cubic(t, y1, ym, ym, y2)] as [number, number] };
  }
  const side = x2 >= blocker.x ? 1 : -1;
  const xd = blocker.x + side * (W / 2 + GAP_X / 2);
  const yd = blocker.y;
  const c1 = y1 + (yd - y1) * 0.5;
  const c2 = yd + (y2 - yd) * 0.5;
  return {
    d: `M${x1} ${y1} C${x1} ${c1}, ${xd} ${c1}, ${xd} ${yd} C${xd} ${c2}, ${x2} ${c2}, ${x2} ${y2 - 2}`,
    label: [cubic(0.45, x1, x1, xd, xd), cubic(0.45, y1, c1, c1, yd)] as [number, number],
  };
}

const KIND_STYLE: Record<FlowNode["kind"], { fill: string; stroke: string }> = {
  start: { fill: "#052e2b", stroke: "#34d399" },
  step: { fill: "#071a33", stroke: "#4cc9ff" },
  decision: { fill: "#2a1d05", stroke: "#fbbf24" },
  end: { fill: "#1e1537", stroke: "#a78bfa" },
};

export default function FlowGraph({ nodes, edges, active, visited = [], reach = "next", onSelect, nodeWidth = 168 }: Props) {
  const W = nodeWidth;
  const { pos, width, height } = useMemo(() => layout(nodes, edges, W), [nodes, edges, W]);

  // 亮起的下一步 / 下游
  const lit = useMemo(() => {
    const set = new Set<string>();
    if (!active) return set;
    const walk = (id: string) => {
      for (const e of edges)
        if (e.from === id && !set.has(e.to)) {
          set.add(e.to);
          if (reach === "all") walk(e.to);
        }
    };
    walk(active);
    return set;
  }, [active, edges, reach]);

  const pad = 14;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`}
      className="h-auto w-full select-none"
      // 節點多時不無限縮小，改為可捲動（最小 75% 原尺寸）
      style={{ minWidth: (width + pad * 2) * 0.75, maxWidth: (width + pad * 2) * 1.15 }}
    >
      <defs>
        <marker id="fg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="#4cc9ff" />
        </marker>
        <marker id="fg-arrow-dim" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="#33506e" />
        </marker>
      </defs>

      {edges.map((e, i) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        const live = active !== null && (e.from === active || (reach === "all" && lit.has(e.from))) && lit.has(e.to);
        const trail = visited.includes(e.from) && (visited.includes(e.to) || e.to === active);
        const x1 = a.x;
        const y1 = a.y + H / 2;
        const x2 = b.x;
        const y2 = b.y - H / 2;
        const back = b.y <= a.y;
        const fanOut = edges.filter((x) => x.from === e.from).length;
        const { d, label } = back ? backPath(a, b, W) : routePath(x1, y1, x2, y2, a, b, pos, W, fanOut > 2 ? 0.7 : 0.28);
        const on = live || trail;
        return (
          <g key={i}>
            <path
              d={d}
              fill="none"
              stroke={on ? "#4cc9ff" : active ? "#1b3550" : "#33506e"}
              strokeWidth={live ? 2.2 : on ? 1.8 : 1.4}
              className={live ? "flow-edge-live" : undefined}
              markerEnd={on || !active ? "url(#fg-arrow)" : "url(#fg-arrow-dim)"}
            />
            {e.label && (
              // 標籤放在連線前段（t = 0.28），貼近分支起點，不會被誤認成別條線
              <g transform={`translate(${label.join(" ")})`}>
                <rect x={-14} y={-9} width={28} height={18} rx={4} fill="#030d1c" stroke={on ? "#4cc9ff" : "#33506e"} strokeWidth={0.8} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={11} fill={on ? "#d6f3ff" : "#7d93ab"}>
                  {e.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {nodes.map((n) => {
        const p = pos.get(n.id)!;
        const st = KIND_STYLE[n.kind];
        const isActive = n.id === active;
        const isNext = lit.has(n.id);
        const wasVisited = visited.includes(n.id);
        const dim = active !== null && !isActive && !isNext && !wasVisited;
        const lines = wrap(n.label, W / 13.5 - 1.2);
        const x = p.x - W / 2;
        const y = p.y - H / 2;
        const shape =
          n.kind === "decision" ? (
            <polygon
              className="flow-shape"
              points={`${x + 14},${y} ${x + W - 14},${y} ${x + W},${p.y} ${x + W - 14},${y + H} ${x + 14},${y + H} ${x},${p.y}`}
              fill={isActive ? st.stroke : st.fill}
              fillOpacity={isActive ? 0.35 : 1}
              stroke={st.stroke}
              strokeWidth={isActive ? 2.6 : isNext ? 2.2 : 1.2}
            />
          ) : (
            <rect
              className="flow-shape"
              x={x}
              y={y}
              width={W}
              height={H}
              rx={n.kind === "step" ? 8 : H / 2}
              fill={isActive ? st.stroke : st.fill}
              fillOpacity={isActive ? 0.35 : 1}
              stroke={st.stroke}
              strokeWidth={isActive ? 2.6 : isNext ? 2.2 : 1.2}
            />
          );
        return (
          <g
            key={n.id}
            className={`flow-node-enter cursor-pointer transition-opacity ${isNext ? "flow-node-next" : ""}`}
            opacity={dim ? 0.32 : 1}
            onClick={() => onSelect(n.id)}
            role="button"
            aria-label={n.label}
          >
            {shape}
            {n.accent && n.kind !== "decision" && <rect x={x} y={y + 8} width={4} height={H - 16} rx={2} fill={n.accent} />}
            <text x={p.x} y={p.y - (n.sub ? 7 : 0) - (lines.length - 1) * 8} textAnchor="middle" fontSize={13} fill="#e6f7ff" fontWeight={isActive ? 700 : 500}>
              {lines.map((l, i) => (
                <tspan key={i} x={p.x} dy={i === 0 ? 0 : 16} dominantBaseline="central">
                  {l}
                </tspan>
              ))}
            </text>
            {n.sub && (
              <text x={p.x} y={p.y + 8 + (lines.length - 1) * 8} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fill="#8fb3cc">
                {n.sub.length > 16 ? n.sub.slice(0, 15) + "…" : n.sub}
              </text>
            )}
            {wasVisited && !isActive && <circle cx={x + W - 8} cy={y + 8} r={4} fill="#34d399" />}
          </g>
        );
      })}
    </svg>
  );
}
