"use client";

import { useState } from "react";
import { GROUP_COLOR, roleOf } from "@/lib/mgmt";
import { SOPS } from "@/lib/sops";
import FlowGraph, { type GraphNode } from "../FlowGraph";
import { BTN_OUTLINE, BTN_PRIMARY } from "../ui";
import { roleName, useMgmt } from "./common";

const KIND_LABEL = { start: "起點", step: "步驟", decision: "判斷", end: "結束" } as const;

export default function SopTab({ initial }: { initial?: string }) {
  const { roles, vendors, goTab } = useMgmt();
  const [sopId, setSopId] = useState(initial && SOPS.some((s) => s.id === initial) ? initial : SOPS[0].id);
  const sop = SOPS.find((s) => s.id === sopId)!;
  const start = sop.nodes.find((n) => n.kind === "start")!.id;
  const [path, setPath] = useState<string[]>([start]);
  const active = path[path.length - 1];
  const node = sop.nodes.find((n) => n.id === active)!;
  const nextEdges = sop.edges.filter((e) => e.from === active);

  const choose = (id: string) => {
    setSopId(id);
    setPath([SOPS.find((s) => s.id === id)!.nodes.find((n) => n.kind === "start")!.id]);
  };
  // 點下一步沿路徑前進；點其他方塊直接跳到該步
  const select = (id: string) => setPath((p) => (nextEdges.some((e) => e.to === id) ? [...p, id] : p.includes(id) ? p.slice(0, p.indexOf(id) + 1) : [id]));

  const nodes: GraphNode[] = sop.nodes.map((n) => ({
    ...n,
    sub: [n.roles?.map((r) => roleOf(r).short).join("、"), n.time].filter(Boolean).join(" · ") || undefined,
    accent: n.roles?.[0] ? GROUP_COLOR[roleOf(n.roles[0]).group] : undefined,
  }));
  const contacts = node.vendor ? vendors.filter((v) => v.category === node.vendor) : [];
  const categories = [...new Set(SOPS.map((s) => s.category))];

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
      <nav className="min-h-0 space-y-3 overflow-y-auto">
        {categories.map((c) => (
          <div key={c}>
            <p className="mb-1 px-2 text-[11px] font-semibold tracking-widest text-cyan-400/80">{c}</p>
            {SOPS.filter((s) => s.category === c).map((s) => (
              <button
                key={s.id}
                onClick={() => choose(s.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${s.id === sopId ? "bg-cyan-400/15 text-cyan-50" : "text-slate-300 hover:bg-white/5"}`}
              >
                <span>{s.icon}</span>
                {s.title}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex min-h-0 flex-col rounded-lg border border-cyan-500/20 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-cyan-50">
            {sop.icon} {sop.title}
          </h3>
          <p className="text-xs text-slate-400">{sop.summary}</p>
          <div className="flex-1" />
          <button onClick={() => setPath([start])} className={BTN_OUTLINE}>
            ↺ 從頭開始
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto">
          <FlowGraph nodes={nodes} edges={sop.edges} active={active} visited={path.slice(0, -1)} onSelect={select} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">發光閃爍的方塊是下一步，點它前進；點已走過的方塊可退回。綠點代表已完成的步驟。</p>
      </div>

      <aside className="min-h-0 space-y-4 overflow-y-auto rounded-lg border border-cyan-500/20 p-4">
        <div>
          <p className="text-xs text-cyan-300">
            步驟 {path.length} · {KIND_LABEL[node.kind]}
          </p>
          <h4 className="mt-0.5 text-lg font-semibold text-cyan-50">{node.label}</h4>
          {node.time && <p className="mt-1 text-xs text-amber-200">⏰ 時限：{node.time}</p>}
          {node.detail && <p className="mt-2 text-sm text-slate-300">{node.detail}</p>}
        </div>
        {node.roles && (
          <section>
            <h5 className="mb-1 text-xs font-semibold text-cyan-100">負責人</h5>
            <ul className="space-y-1 text-sm">
              {node.roles.map((r) => (
                <li key={r} className="flex items-center gap-2 text-slate-200">
                  <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[roleOf(r).group] }} />
                  {roleName(r, roles, false)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {node.vendor && (
          <section>
            <h5 className="mb-1 text-xs font-semibold text-cyan-100">聯絡廠商（{node.vendor}）</h5>
            {contacts.length === 0 ? (
              <button onClick={() => goTab("vendors")} className="text-xs text-cyan-300 hover:underline">
                尚未建立「{node.vendor}」廠商，前往新增 ↗
              </button>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {contacts.map((v) => (
                  <li key={v.id} className="rounded-md bg-white/5 px-2 py-1.5">
                    <p className="text-slate-100">{v.name}</p>
                    <p className="text-xs text-slate-400">
                      {v.contact}{" "}
                      {v.phone && (
                        <a href={`tel:${v.phone.replace(/[^\d+]/g, "")}`} className="text-cyan-300">
                          {v.phone}
                        </a>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <section>
          <h5 className="mb-1.5 text-xs font-semibold text-cyan-100">{nextEdges.length ? "下一步" : "流程結束"}</h5>
          <div className="space-y-1.5">
            {nextEdges.map((e) => (
              <button key={e.to} onClick={() => select(e.to)} className={`${BTN_PRIMARY} flex w-full items-center gap-2 text-left`}>
                {e.label && <span className="rounded bg-slate-950/40 px-1.5 text-xs">{e.label}</span>}
                <span className="flex-1">{sop.nodes.find((n) => n.id === e.to)!.label}</span>→
              </button>
            ))}
            {!nextEdges.length && (
              <button onClick={() => setPath([start])} className={`${BTN_OUTLINE} w-full`}>
                ↺ 重新開始
              </button>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
