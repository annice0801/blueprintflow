"use client";

import { useRef, useState } from "react";
import type { PublicArea } from "@/lib/buildings";
import type { Plant } from "@/lib/records";
import PlantDialog, { type PlantDraft } from "./PlantDialog";

export const HEALTH_COLOR: Record<Plant["health"], string> = { 良好: "#34d399", 需注意: "#ffb020", 不良: "#ff4d6d", 已移除: "#64748b" };

type Props = {
  buildingId: string;
  area: PublicArea;
  plants: Plant[];
  onChange: (plant: Plant) => void;
  onDeleted: (id: string) => void;
};

export default function GardenView({ buildingId, area, plants, onChange, onDeleted }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<PlantDraft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // 對話框身分：新增後轉為編輯時不重新掛載（保留分頁狀態）
  const [dialogKey, setDialogKey] = useState("");
  const openPlant = (id: string) => {
    setOpenId(id);
    setDialogKey(id);
  };
  const b = area.bounds;
  const pad = 0.8;
  const fs = 0.36;
  const r = 0.32;
  // 細長區域（前庭、人行道）用固定比例尺橫向捲動，清單移到下方
  const wide = b.w / b.h > 2.5;
  const PX_PER_M = 32;

  function pick(e: React.MouseEvent<SVGSVGElement>) {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    if (p.x < b.x || p.y < b.y || p.x > b.x + b.w || p.y > b.y + b.h) return;
    const x = Math.round(p.x * 10) / 10;
    const y = Math.round(p.y * 10) / 10;
    const bed = area.beds.find((d) => x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h);
    setDraft({ buildingId, areaId: area.id, x, y, bed: bed?.label ?? area.name });
    setOpenId(null);
    setDialogKey(`new-${x}-${y}`);
  }

  const open = plants.find((p) => p.id === openId);
  const sorted = [...plants].sort((a, b) => a.bed.localeCompare(b.bed, "zh-Hant") || a.name.localeCompare(b.name, "zh-Hant"));

  return (
    <div
      className={`grid h-full min-h-0 gap-3 p-3 ${wide ? "grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-1"}`}
    >
      <div className={`flex flex-col rounded-lg border border-cyan-500/20 bg-[#020a17] ${wide ? "" : "min-h-[200px]"}`}>
        <div className={wide ? "overflow-x-auto" : "flex min-h-0 flex-1"}>
        <svg
          ref={svgRef}
          viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`}
          className={`cursor-crosshair select-none ${wide ? "block" : "min-h-0 w-full flex-1"}`}
          style={wide ? { width: (b.w + pad * 2) * PX_PER_M, height: (b.h + pad * 2) * PX_PER_M } : undefined}
          onClick={pick}
        >
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#041a16" stroke="#34d399" strokeOpacity={0.5} strokeWidth={0.06} strokeDasharray="0.4 0.25" />
          {area.beds.map((d) => (
            <g key={d.id}>
              <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={Math.min(d.w, d.h) * 0.12} fill="rgba(52,211,153,0.13)" stroke="#34d399" strokeWidth={0.07} />
              <text x={d.x + d.w / 2} y={d.y + 0.15} fontSize={d.w > 2 ? fs : fs * 0.6} fill="#86efac" fillOpacity={0.7} textAnchor="middle" dominantBaseline="hanging" pointerEvents="none">
                {d.label}
              </text>
            </g>
          ))}
          {plants.map((p) => (
            <g
              key={p.id}
              transform={`translate(${p.x} ${p.y})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                openPlant(p.id);
              }}
            >
              <circle r={r * 2} fill={HEALTH_COLOR[p.health]} opacity={0.15} />
              {/* 樹冠符號 */}
              <circle r={r} fill="#052e22" stroke={HEALTH_COLOR[p.health]} strokeWidth={0.07} />
              <path d={`M0 ${-r * 0.6} L${r * 0.5} ${r * 0.35} L${-r * 0.5} ${r * 0.35} Z`} fill={HEALTH_COLOR[p.health]} />
              {p.events.length > 0 && (
                <g transform={`translate(${r * 0.9} ${-r * 0.9})`}>
                  <circle r={r * 0.55} fill="#ffb020" />
                  <text fontSize={r * 0.7} textAnchor="middle" dominantBaseline="central" fill="#020814" fontWeight={700}>
                    {p.events.length}
                  </text>
                </g>
              )}
              <text y={r + fs * 0.9} fontSize={fs * 0.8} fill="#d1fae5" textAnchor="middle" pointerEvents="none">
                {p.name}
              </text>
            </g>
          ))}
          {draft && <circle cx={draft.x} cy={draft.y} r={r * 1.4} fill="none" stroke="#fff" strokeWidth={0.06} strokeDasharray="0.2 0.15" pointerEvents="none" />}
        </svg>
        </div>
        <p className="border-t border-cyan-500/10 px-3 py-1.5 text-[11px] text-slate-400">
          {area.description} 點擊空白處新增植栽；角落數字為事件紀錄筆數。
        </p>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-cyan-500/20">
        <div className="flex items-center justify-between border-b border-cyan-500/20 px-3 py-2 text-sm">
          <span className="font-semibold text-cyan-100">植栽清單</span>
          <span className="text-xs text-slate-400">{plants.length} 株</span>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-cyan-500/10 overflow-y-auto">
          {sorted.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">尚無植栽，點擊左側花圃新增</li>}
          {sorted.map((p) => {
            const last = [...p.events].sort((a, b) => b.date.localeCompare(a.date))[0];
            return (
              <li key={p.id}>
                <button onClick={() => openPlant(p.id)} className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-cyan-400/5">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: HEALTH_COLOR[p.health] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-cyan-50">
                      {p.name} <span className="text-xs text-slate-400">{p.species}</span>
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {p.bed} · {p.health}
                      {last && ` · 最近：${last.date} ${last.typhoon ? `${last.typhoon}颱風 ` : ""}${last.type}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {(draft || open) && (
        <PlantDialog
          key={dialogKey}
          plant={open}
          draft={open ? undefined : draft ?? undefined}
          onClose={() => {
            setDraft(null);
            setOpenId(null);
          }}
          onChange={(p) => {
            onChange(p);
            setDraft(null);
            setOpenId(p.id);
          }}
          onDeleted={(id) => {
            onDeleted(id);
            setOpenId(null);
          }}
        />
      )}
    </div>
  );
}
