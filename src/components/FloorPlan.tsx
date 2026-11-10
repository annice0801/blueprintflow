"use client";

import { useId, useRef, useState } from "react";
import { getDetail, getPlanBounds, getZones, zoneAt, type Building, type EquipKind, type Rect, type TowerId, type ZoneKind } from "@/lib/buildings";
import { ALERT, alertOf, type Issue } from "@/lib/issues";
import type { Shop } from "@/lib/records";
import PlanDrawingLayer, { GroundLayer } from "./PlanDrawingLayer";

const ZONE_FILL: Record<ZoneKind, string> = {
  unit: "rgba(76,201,255,0.06)",
  core: "rgba(148,163,184,0.12)",
  shop: "rgba(167,139,250,0.10)",
  lobby: "rgba(76,201,255,0.12)",
  parking: "rgba(76,201,255,0.04)",
  mep: "rgba(251,191,36,0.08)",
  garden: "rgba(52,211,153,0.10)",
  roof: "rgba(76,201,255,0.05)",
  corridor: "rgba(148,163,184,0.16)",
  stair: "rgba(148,163,184,0.10)",
  elevator: "rgba(251,191,36,0.10)",
  shaft: "rgba(251,191,36,0.06)",
  room: "transparent",
};

export const EQUIP_LABEL: Record<EquipKind, string> = {
  hydrant: "消防栓箱",
  extinguisher: "滅火器",
  "smoke-detector": "偵煙器",
  sprinkler: "撒水頭",
  "smoke-vent": "排煙口",
  "emergency-light": "緊急照明",
  "exit-sign": "避難指示燈",
  panel: "配電盤",
  "water-meter": "水表",
};

/** 設備符號（以 0,0 為中心，半徑 r） */
export function EquipIcon({ kind, r }: { kind: EquipKind; r: number }) {
  const sw = r * 0.22;
  switch (kind) {
    case "hydrant":
      return (
        <g>
          <rect x={-r} y={-r * 0.7} width={r * 2} height={r * 1.4} fill="#7f1d1d" stroke="#ff4d6d" strokeWidth={sw} />
          <text fontSize={r * 0.9} fill="#fecdd3" textAnchor="middle" dominantBaseline="central" fontWeight={700}>
            FH
          </text>
        </g>
      );
    case "extinguisher":
      return (
        <g>
          <circle r={r * 0.8} fill="#ff4d6d" stroke="#fecdd3" strokeWidth={sw * 0.6} />
          <text fontSize={r * 0.75} fill="#fff" textAnchor="middle" dominantBaseline="central" fontWeight={700}>
            E
          </text>
        </g>
      );
    case "smoke-detector":
      return (
        <g>
          <circle r={r * 0.75} fill="none" stroke="#fbbf24" strokeWidth={sw} />
          <circle r={r * 0.25} fill="#fbbf24" />
        </g>
      );
    case "sprinkler":
      return (
        <g stroke="#38bdf8" strokeWidth={sw}>
          <circle r={r * 0.45} fill="#0c4a6e" />
          <line x1={-r * 0.8} y1={0} x2={r * 0.8} y2={0} />
          <line x1={0} y1={-r * 0.8} x2={0} y2={r * 0.8} />
        </g>
      );
    case "smoke-vent":
      return (
        <g>
          <rect x={-r * 0.8} y={-r * 0.8} width={r * 1.6} height={r * 1.6} fill="none" stroke="#fbbf24" strokeWidth={sw} />
          <path d={`M${-r * 0.8} ${-r * 0.8} L${r * 0.8} ${r * 0.8} M${r * 0.8} ${-r * 0.8} L${-r * 0.8} ${r * 0.8}`} stroke="#fbbf24" strokeWidth={sw * 0.7} />
        </g>
      );
    case "emergency-light":
      return (
        <g>
          <rect x={-r} y={-r * 0.45} width={r * 2} height={r * 0.9} fill="#fef08a" stroke="#ca8a04" strokeWidth={sw * 0.6} />
        </g>
      );
    case "exit-sign":
      return (
        <g>
          <rect x={-r} y={-r * 0.6} width={r * 2} height={r * 1.2} fill="#065f46" stroke="#34d399" strokeWidth={sw * 0.6} />
          <path d={`M${-r * 0.5} 0 L${r * 0.5} 0 M${r * 0.15} ${-r * 0.35} L${r * 0.5} 0 L${r * 0.15} ${r * 0.35}`} stroke="#d1fae5" strokeWidth={sw * 0.7} fill="none" />
        </g>
      );
    case "panel":
      return (
        <g>
          <rect x={-r * 0.8} y={-r} width={r * 1.6} height={r * 2} fill="#1e293b" stroke="#a78bfa" strokeWidth={sw * 0.7} />
          <path d={`M${r * 0.15} ${-r * 0.65} L${-r * 0.3} ${r * 0.1} L${r * 0.2} ${r * 0.1} L${-r * 0.15} ${r * 0.7}`} stroke="#c4b5fd" strokeWidth={sw * 0.7} fill="none" />
        </g>
      );
    case "water-meter":
      return (
        <g>
          <circle r={r * 0.8} fill="#0c4a6e" stroke="#38bdf8" strokeWidth={sw * 0.7} />
          <text fontSize={r * 0.75} fill="#e0f2fe" textAnchor="middle" dominantBaseline="central" fontWeight={700}>
            W
          </text>
        </g>
      );
  }
}

/** 電梯（X）、樓梯（踏階）、管道間（斜線）的平面符號 */
function ZoneSymbol({ z }: { z: Rect }) {
  const st = { stroke: "#94a3b8", strokeWidth: 0.04, strokeOpacity: 0.7 };
  if (z.kind === "elevator") {
    const i = 0.15;
    return (
      <g pointerEvents="none" {...st}>
        <rect x={z.x + i} y={z.y + i} width={z.w - i * 2} height={z.h - i * 2} fill="none" />
        <line x1={z.x + i} y1={z.y + i} x2={z.x + z.w - i} y2={z.y + z.h - i} />
        <line x1={z.x + z.w - i} y1={z.y + i} x2={z.x + i} y2={z.y + z.h - i} />
      </g>
    );
  }
  if (z.kind === "stair") {
    // 雙跑樓梯：中線分兩跑，每 0.28 m 一階
    const vertical = z.h >= z.w;
    const len = vertical ? z.h : z.w;
    const steps = Math.floor((len - 0.6) / 0.28);
    const lines = Array.from({ length: steps }, (_, k) => 0.3 + k * 0.28);
    return (
      <g pointerEvents="none" {...st}>
        {vertical ? (
          <>
            <line x1={z.x + z.w / 2} y1={z.y + 0.3} x2={z.x + z.w / 2} y2={z.y + z.h - 0.3} />
            {lines.map((d) => (
              <line key={d} x1={z.x + 0.08} y1={z.y + d} x2={z.x + z.w - 0.08} y2={z.y + d} />
            ))}
          </>
        ) : (
          <>
            <line x1={z.x + 0.3} y1={z.y + z.h / 2} x2={z.x + z.w - 0.3} y2={z.y + z.h / 2} />
            {lines.map((d) => (
              <line key={d} x1={z.x + d} y1={z.y + 0.08} x2={z.x + d} y2={z.y + z.h - 0.08} />
            ))}
          </>
        )}
      </g>
    );
  }
  if (z.kind === "shaft") {
    const n = Math.ceil((z.w + z.h) / 0.25);
    return (
      <g pointerEvents="none">
        <clipPath id={`clip-${z.id}`}>
          <rect x={z.x} y={z.y} width={z.w} height={z.h} />
        </clipPath>
        <g clipPath={`url(#clip-${z.id})`} {...st}>
          {Array.from({ length: n }, (_, k) => (
            <line key={k} x1={z.x + k * 0.25} y1={z.y} x2={z.x + k * 0.25 - z.h} y2={z.y + z.h} />
          ))}
        </g>
      </g>
    );
  }
  return null;
}

function textWidth(t: string, size: number) {
  return [...t].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 1 : 0.6), 0) * size;
}

/** 與 3D 光圈同一套等級顏色 */
export function pinColor(i: Issue) {
  return ALERT[alertOf(i)].color;
}

/** 平面圖上的會議 / 待辦標記 */
export type PlanNote = {
  id: string;
  kind: "todo" | "meeting" | "record";
  floor: string;
  tower: TowerId;
  x: number;
  y: number;
  title: string;
  sub: string;
  snippet?: string;
  color: string;
  href: string;
  label: string;
};

type Props = {
  building: Building;
  tower: TowerId;
  floor: string;
  issues: Issue[];
  draft: { x: number; y: number } | null;
  onPick: (p: { x: number; y: number; zone?: Rect }) => void;
  onOpenIssue: (issue: Issue) => void;
  /** 點擊可進入的區域（花圃、店鋪、車道）標籤 */
  onZoneLink?: (zone: Rect) => void;
  shops?: Map<string, Shop>;
  /** 戶型詳細圖：放大到這一戶 */
  focus?: Rect;
  notes?: PlanNote[];
  onOpenNote?: (n: PlanNote, at: { x: number; y: number }) => void;
  /** 由管理中心連過來時高亮的分區 */
  highlightZone?: string;
};

const SHOP_DOT: Record<Shop["status"], string> = { 營業中: "#34d399", 裝潢中: "#ffb020", 空置招租: "#94a3b8", 歇業: "#ff4d6d" };
const LINK_HINT = (z: Rect) => (z.link === "shop" ? "" : " ›");

export default function FloorPlan({ building, tower, floor, issues, draft, onPick, onOpenIssue, onZoneLink, shops, focus, notes = [], onOpenNote, highlightZone }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = `plan-clip-${useId().replace(/:/g, "")}`; // 同頁有兩張平面圖時避免 id 重複
  const [showRooms, setShowRooms] = useState(true);
  const [showEquip, setShowEquip] = useState(true);
  const b = focus ? { x: focus.x - 0.6, y: focus.y - 0.6, w: focus.w + 1.2, h: focus.h + 1.2 } : getPlanBounds(floor, tower);
  const pad = focus ? 0.4 : 1.5;
  const zones = getZones(floor, tower);
  const detail = getDetail(floor, tower);
  const hasDetail = detail.rooms.length > 0;
  const drawing = detail.drawing; // 有向量圖時，牆與設備由圖層繪製，分區只當點選範圍
  const rooms = showRooms || focus ? detail.rooms.filter((r) => !focus || r.id.startsWith(`${focus.id}-`)) : [];
  const equip = showEquip && !focus ? detail.equip : [];
  const sitewide = tower === "S";

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    if (p.x < b.x || p.y < b.y || p.x > b.x + b.w || p.y > b.y + b.h) return;
    const x = Math.round(p.x * 10) / 10;
    const y = Math.round(p.y * 10) / 10;
    onPick({ x, y, zone: zoneAt(floor, tower, x, y) });
  }

  const gridLines = [];
  for (let gx = Math.ceil(b.x); gx <= b.x + b.w; gx++)
    gridLines.push(<line key={`x${gx}`} x1={gx} y1={b.y} x2={gx} y2={b.y + b.h} stroke={gx % 5 ? "#0c2f4a" : "#164a70"} strokeWidth={gx % 5 ? 0.04 : 0.07} />);
  for (let gy = Math.ceil(b.y); gy <= b.y + b.h; gy++)
    gridLines.push(<line key={`y${gy}`} x1={b.x} y1={gy} x2={b.x + b.w} y2={gy} stroke={gy % 5 ? "#0c2f4a" : "#164a70"} strokeWidth={gy % 5 ? 0.04 : 0.07} />);

  const fs = sitewide ? 0.9 : focus ? 0.32 : 0.6;
  const pinR = sitewide ? 0.75 : focus ? 0.22 : 0.5;
  const usedEquip = [...new Set(equip.map((e) => e.kind))];
  const sb = (sitewide ? 10 : 5) * building.planScale; // 比例尺長度（實際公尺 × 示意比例）

  return (
    <div className="relative h-full w-full">
    <svg
      ref={svgRef}
      viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`}
      className="h-full w-full cursor-crosshair select-none"
      onClick={handleClick}
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.18" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={clipId}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#030d1c" />
      {gridLines}


      {/* 棟別外框 */}
      {building.towers.filter((t) => sitewide || t.id === tower).map((t) => (
        <polygon
          key={t.id}
          points={t.footprint.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke="#4cc9ff"
          strokeWidth={sitewide ? 0.12 : drawing || focus ? 0.06 : 0.22}
          strokeOpacity={drawing ? 0.35 : 1}
          strokeDasharray={sitewide ? "0.6 0.4" : undefined}
          filter={drawing ? undefined : "url(#glow)"}
        />
      ))}

      {drawing?.areas && <GroundLayer d={drawing} />}

      {zones.map((z) => {
        const cx = z.x + z.w / 2;
        const cy = z.y + z.h / 2;
        const cornerLabel = z.kind === "unit" && rooms.length > 0; // 有隔間時戶號移到角落
        const nameLen = Math.max(2, (z.short ?? z.label).length + (z.link ? 1.5 : 0));
        const size = focus
          ? fs * 1.2
          : z.kind === "unit"
            ? cornerLabel
              ? fs * 0.95
              : fs * 1.6
            : sitewide
              ? Math.min(0.85, z.h * 0.32, (z.w / nameLen) * 0.9)
              : Math.min(fs * 0.62, z.h * 0.3, (z.w / nameLen) * 0.95);
        const shop = z.link === "shop" ? shops?.get(z.id) : undefined;
        const name = z.short ?? z.label;
        const text = `${name}${z.link && !focus ? LINK_HINT(z) : ""}`;
        // 有隔間時，戶號放在客餐廳中央（客餐廳文字不另外顯示）
        const living = cornerLabel ? rooms.find((r) => r.id.startsWith(`${z.id}-`) && r.short === "客餐廳") : undefined;
        const labelX = living ? living.x + living.w / 2 : cx;
        const labelY = living ? living.y + living.h / 2 : cy;
        if (focus && z.id !== focus.id && z.kind === "unit") return null;
        return (
          <g key={z.id}>
            {drawing ? (
              z.poly ? (
                <polygon points={z.poly.map((p) => p.join(",")).join(" ")} fill={drawing.areas ? "transparent" : ZONE_FILL[z.kind]} className="hover:fill-cyan-400/15" />
              ) : (
                <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={drawing.areas ? "transparent" : ZONE_FILL[z.kind]} className="hover:fill-cyan-400/15" />
              )
            ) : z.poly ? (
              <polygon points={z.poly.map((p) => p.join(",")).join(" ")} fill={ZONE_FILL[z.kind]} stroke="#4cc9ff" strokeOpacity={0.8} strokeWidth={0.14} />
            ) : (
              <rect
                x={z.x}
                y={z.y}
                width={z.w}
                height={z.h}
                fill={ZONE_FILL[z.kind]}
                stroke="#4cc9ff"
                strokeOpacity={z.kind === "unit" ? 0.8 : 0.55}
                strokeWidth={z.kind === "unit" ? 0.14 : 0.06}
              />
            )}
            {!drawing && <ZoneSymbol z={z} />}
            {focus ? null : z.link && onZoneLink ? (
              <g
                className="cursor-pointer [&:hover>rect]:fill-cyan-400/30"
                onClick={(e) => {
                  e.stopPropagation();
                  onZoneLink(z);
                }}
              >
                {/* 中文字寬約 1em，英數約 0.6em */}
                <rect
                  x={labelX - (textWidth(text, size) + size) / 2}
                  y={labelY - (shop ? size * 1.2 : size * 0.7)}
                  width={textWidth(text, size) + size}
                  height={size * 1.4}
                  rx={size * 0.3}
                  fill="rgba(76,201,255,0.12)"
                  stroke="#4cc9ff"
                  strokeWidth={0.06}
                />
                <text x={labelX} y={shop ? labelY - size * 0.5 : labelY} fontSize={size} fill="#d6f3ff" fontWeight={z.kind === "unit" ? 700 : 400} textAnchor="middle" dominantBaseline="middle" pointerEvents="none">
                  {text}
                </text>
              </g>
            ) : z.kind === "shaft" && !focus ? null : (
              <text
                x={cx}
                y={cy}
                fontSize={size}
                fill="#a5e4ff"
                fillOpacity={z.kind === "unit" ? 0.85 : 0.7}
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight={z.kind === "unit" ? 700 : 400}
                pointerEvents="none"
              >
                {name}
              </text>
            )}
            {shop && (
              <g pointerEvents="none">
                <circle cx={cx - textWidth((shop.shopName || shop.status).slice(0, 6), size * 0.75) / 2 - size * 0.5} cy={cy + size * 1.05} r={size * 0.22} fill={SHOP_DOT[shop.status]} />
                <text x={cx + size * 0.15} y={cy + size * 1.1} fontSize={size * 0.75} fill="#e2f6ff" textAnchor="middle" dominantBaseline="middle">
                  {(shop.shopName || shop.status).slice(0, 6)}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {drawing && <PlanDrawingLayer d={drawing} />}

      {/* 戶內隔間 */}
      {rooms.map((r) => (
        <g key={r.id} pointerEvents="none">
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={r.short === "陽台" || r.short === "工作陽台" ? "rgba(52,211,153,0.07)" : !drawing && (r.short === "走道" || r.short === "玄關") ? "rgba(148,163,184,0.05)" : "none"}
            stroke="#7dd3fc"
            strokeOpacity={drawing ? 0 : 0.45}
            strokeWidth={focus ? 0.04 : 0.03}
          />
          {(focus || (r.w > 1.1 && r.h > 0.7 && r.short !== "客餐廳")) && (
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2}
              fontSize={Math.min(focus ? (drawing ? 0.2 : 0.32) : drawing ? 0.2 : 0.27, r.h * 0.3, r.w / (r.short!.length + 1))}
              fill="#bae6fd"
              fillOpacity={drawing ? 0.5 : 0.75}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {r.short}
            </text>
          )}
        </g>
      ))}

      {/* 鋼板制震壁 */}
      {detail.dampers.map((d, i) => {
        const horiz = d.y1 === d.y2;
        const t = 0.32;
        return (
          <g key={`dm${i}`} pointerEvents="none">
            <rect
              x={Math.min(d.x1, d.x2) - (horiz ? 0 : t / 2)}
              y={Math.min(d.y1, d.y2) - (horiz ? t / 2 : 0)}
              width={horiz ? Math.abs(d.x2 - d.x1) : t}
              height={horiz ? t : Math.abs(d.y2 - d.y1)}
              fill={d.dir === "X" ? "#a78bfa" : "#fb923c"}
              stroke="#fff"
              strokeWidth={0.04}
            />
            <circle cx={(d.x1 + d.x2) / 2} cy={(d.y1 + d.y2) / 2} r={0.55} fill="none" stroke={d.dir === "X" ? "#a78bfa" : "#fb923c"} strokeWidth={0.06} />
          </g>
        );
      })}

      {/* 結構柱 */}
      {detail.columns.map((c) => (
        <rect key={c.id} x={c.x} y={c.y} width={c.w} height={c.h} fill="#a5e4ff" fillOpacity={drawing ? 0.6 : 0.85} pointerEvents="none" />
      ))}

      {/* 設備 */}
      {equip.map((e) => (
        <g key={e.id} transform={`translate(${e.x} ${e.y})`} pointerEvents="none">
          <EquipIcon kind={e.kind} r={0.17} />
        </g>
      ))}

      </g>

      {/* 比例尺：實際 5 m（平面為示意比例 planScale） */}
      {!focus && (
      <g transform={`translate(${b.x + 0.5} ${b.y + b.h - 0.6})`} pointerEvents="none">
        <line x1={0} y1={0} x2={sb} y2={0} stroke="#a5e4ff" strokeWidth={0.08} />
        <line x1={0} y1={-0.25} x2={0} y2={0.25} stroke="#a5e4ff" strokeWidth={0.08} />
        <line x1={sb} y1={-0.25} x2={sb} y2={0.25} stroke="#a5e4ff" strokeWidth={0.08} />
        <text x={sb / 2} y={-0.4} fontSize={sitewide ? 0.7 : 0.45} fill="#a5e4ff" textAnchor="middle">
          {sitewide ? "10 m" : "5 m"}
        </text>
      </g>
      )}

      {/* 高亮分區（從管理中心連入） */}
      {(() => {
        const hz = highlightZone ? [...zones, ...detail.rooms].find((z) => z.id === highlightZone) : undefined;
        return hz ? (
          <rect x={hz.x} y={hz.y} width={hz.w} height={hz.h} fill="rgba(167,139,250,0.18)" stroke="#a78bfa" strokeWidth={sitewide ? 0.25 : 0.15} pointerEvents="none">
            <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </rect>
        ) : null;
      })()}

      {/* 會議提及（菱形）/ 待辦（方形）；同一點的多筆標記稍微錯開 */}
      {notes.map((n, idx) => {
        const r = pinR * 0.62;
        const dup = notes.slice(0, idx).filter((m) => Math.abs(m.x - n.x) < 0.3 && Math.abs(m.y - n.y) < 0.3).length;
        const cx = n.x + r * 1.6 + dup * r * 1.5;
        const cy = n.y - r * 1.6;
        return (
          <g
            key={n.id}
            transform={`translate(${cx} ${cy})`}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpenNote?.(n, { x: e.clientX, y: e.clientY });
            }}
          >
            <title>{`${{ todo: "待辦", meeting: "會議", record: "維修" }[n.kind]}：${n.title}`}</title>
            {n.kind === "meeting" ? (
              <rect x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" fill={n.color} stroke="#020814" strokeWidth={0.06} />
            ) : (
              <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.25} fill={n.color} stroke="#020814" strokeWidth={0.06} />
            )}
            <text fontSize={r * 1.15} textAnchor="middle" dominantBaseline="central" fill="#020814" fontWeight={700} pointerEvents="none">
              {{ todo: "✓", meeting: "會", record: "修" }[n.kind]}
            </text>
          </g>
        );
      })}

      {issues.map((i, idx) => (
        <g
          key={i.id}
          transform={`translate(${i.x} ${i.y})`}
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onOpenIssue(i);
          }}
        >
          <circle r={pinR * 1.8} fill={pinColor(i)} opacity={0.18} />
          <circle r={pinR} fill={pinColor(i)} stroke="#020814" strokeWidth={0.08} filter="url(#glow)" />
          <text fontSize={pinR * 1.1} fill="#020814" textAnchor="middle" dominantBaseline="central" fontWeight={700} pointerEvents="none">
            {idx + 1}
          </text>
        </g>
      ))}

      {draft && (
        <g transform={`translate(${draft.x} ${draft.y})`} pointerEvents="none">
          <circle r={pinR * 1.6} fill="none" stroke="#fff" strokeWidth={0.08} strokeDasharray="0.3 0.2">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle r={pinR * 0.5} fill="#fff" />
        </g>
      )}
    </svg>

      {hasDetail && !focus && (
        <div className="absolute bottom-2 right-2 max-w-[260px] space-y-1.5 rounded-md border border-cyan-500/30 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <label className="flex cursor-pointer items-center gap-1">
              <input type="checkbox" checked={showRooms} onChange={(e) => setShowRooms(e.target.checked)} className="accent-cyan-400" />
              戶內隔間
            </label>
            <label className="flex cursor-pointer items-center gap-1">
              <input type="checkbox" checked={showEquip} onChange={(e) => setShowEquip(e.target.checked)} className="accent-cyan-400" />
              設備
            </label>
          </div>
          {usedEquip.length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 shrink-0 bg-[#a5e4ff]/85" />
                結構柱
              </span>
              {detail.dampers.some((d) => d.dir === "X") && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-3 shrink-0 bg-[#a78bfa]" />
                  制震壁 X 向
                </span>
              )}
              {detail.dampers.some((d) => d.dir === "Y") && (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-1.5 shrink-0 bg-[#fb923c]" />
                  制震壁 Y 向
                </span>
              )}
              {usedEquip.map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <svg viewBox="-1 -1 2 2" className="h-3.5 w-3.5 shrink-0">
                    <EquipIcon kind={k} r={0.85} />
                  </svg>
                  {EQUIP_LABEL[k]}
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-500">
            隔間、柱位、門窗與衛浴廚具依銷售簡介平面圖描繪；消防水電設備位置為示意，依實際竣工圖為準
          </p>
        </div>
      )}
    </div>
  );
}
