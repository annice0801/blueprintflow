"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MyRepair, PortalAnnouncement, PortalMeeting, PortalRegulation, PortalRepair } from "@/lib/perms";
import { api } from "../ui";

type Tab = "repairs" | "announcements" | "meetings" | "regulations" | "mine";
const TABS: [Tab, string][] = [
  ["repairs", "維修進度"],
  ["announcements", "公告"],
  ["meetings", "會議結果"],
  ["regulations", "規範"],
  ["mine", "我的報修"],
];
const STATUS_TONE: Record<string, string> = { 待處理: "text-amber-300", 待維修: "text-rose-300", 處理中: "text-cyan-300", 維修中: "text-cyan-300", 已排定: "text-slate-300", 已完成: "text-emerald-300" };
const fmt = (d: string) => (d ? d.slice(0, 10).replaceAll("-", "/") : "");

/** 住戶專區側欄：維修進度、公告、會議結果、規範、我的報修（資料皆已去除隱私） */
export default function ResidentPanel({ buildingId, repairs, onLocate, onReport, refreshKey }: { buildingId: string; repairs: PortalRepair[]; onLocate: (r: PortalRepair) => void; onReport: () => void; refreshKey: number }) {
  const [tab, setTab] = useState<Tab>("repairs");
  const [ann, setAnn] = useState<PortalAnnouncement[] | null>(null);
  const [meetings, setMeetings] = useState<PortalMeeting[] | null>(null);
  const [regs, setRegs] = useState<PortalRegulation[] | null>(null);
  const [mine, setMine] = useState<MyRepair[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (tab === "announcements" && !ann) api<PortalAnnouncement[]>("/api/portal/announcements").then(setAnn, () => setAnn([]));
    if (tab === "meetings" && !meetings) api<PortalMeeting[]>("/api/portal/meetings").then(setMeetings, () => setMeetings([]));
    if (tab === "regulations" && !regs) api<PortalRegulation[]>("/api/portal/regulations").then(setRegs, () => setRegs([]));
  }, [tab, ann, meetings, regs]);
  useEffect(() => {
    if (tab === "mine") api<MyRepair[]>("/api/portal/repairs?mine=1").then(setMine, () => setMine([]));
  }, [tab, refreshKey]);

  const empty = (t: string) => <p className="px-4 py-8 text-center text-xs text-slate-500">{t}</p>;
  const loading = <p className="px-4 py-8 text-center text-xs text-slate-500">載入中…</p>;
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 border-b border-cyan-500/20 p-3">
        <button onClick={onReport} className="flex-1 rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
          🛠 我要報修
        </button>
        <Link href={`/buildings/${buildingId}/book`} className="rounded-md border border-cyan-500/40 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10">
          📅 公設預約
        </Link>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-cyan-500/20 px-2 py-1.5 text-xs">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded px-2 py-1 ${tab === k ? "bg-cyan-400/20 text-cyan-50" : "text-slate-400 hover:text-cyan-200"}`}>
            {l}
            {k === "repairs" && repairs.length > 0 && <span className="ml-1 text-amber-300">{repairs.length}</span>}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "repairs" &&
          (repairs.length === 0 ? (
            empty("目前公共區域沒有維修中的項目")
          ) : (
            <ul className="divide-y divide-cyan-500/10">
              {repairs.map((r) => (
                <li key={r.id}>
                  <button onClick={() => onLocate(r)} className="w-full px-4 py-2.5 text-left hover:bg-cyan-400/5">
                    <p className="text-sm text-cyan-50">{r.title}</p>
                    <p className="text-[11px] text-slate-400">
                      📍 {r.label} · <span className={STATUS_TONE[r.status] ?? ""}>{r.status}</span>
                      {r.expected && ` · 預計 ${fmt(r.expected)}`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ))}

        {tab === "announcements" &&
          (!ann ? loading : ann.length === 0 ? empty("目前沒有公告") : (
            <ul className="divide-y divide-cyan-500/10">
              {ann.map((a) => (
                <li key={a.id} className="px-4 py-2.5">
                  <button onClick={() => toggle(a.id)} className="w-full text-left">
                    <p className="text-sm text-cyan-50">{a.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {a.start ? `${fmt(a.start)}${a.end ? ` – ${fmt(a.end)}` : ""}` : fmt(a.postedAt)}
                      {a.area && ` · ${a.area}`}
                    </p>
                  </button>
                  {open === a.id && (
                    <div className="mt-2 space-y-2">
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{a.body}</p>
                      {a.bodyEn && <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-500">{a.bodyEn}</p>}
                      {a.photos.map((p) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={p} src={`/api/uploads/${p}`} alt="" className="max-h-40 rounded border border-cyan-500/20" />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ))}

        {tab === "meetings" &&
          (!meetings ? loading : meetings.length === 0 ? empty("尚無會議紀錄") : (
            <ul className="divide-y divide-cyan-500/10">
              {meetings.map((m) => (
                <li key={m.id} className="px-4 py-2.5">
                  <button onClick={() => toggle(m.id)} className="w-full text-left">
                    <p className="text-sm text-cyan-50">{m.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {fmt(m.date)} · {m.type} · 決議 {m.decisions.length} 項
                    </p>
                  </button>
                  {open === m.id && (
                    <div className="mt-2 space-y-2 text-xs">
                      {m.decisions.length > 0 && (
                        <ol className="list-decimal space-y-1 pl-4 text-slate-300">
                          {m.decisions.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ol>
                      )}
                      {m.followUps.length > 0 && (
                        <div>
                          <p className="mb-1 text-cyan-300">後續處理情形</p>
                          <ul className="space-y-0.5">
                            {m.followUps.map((f, i) => (
                              <li key={i} className="flex gap-2">
                                <span className={`shrink-0 ${f.status === "已完成" ? "text-emerald-300" : "text-amber-300"}`}>{f.status}</span>
                                <span className="text-slate-400">{f.title}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ))}

        {tab === "regulations" &&
          (!regs ? loading : regs.length === 0 ? empty("尚無公告的規範") : (
            <ul className="divide-y divide-cyan-500/10">
              {regs.map((r) => (
                <li key={r.id} className="px-4 py-2.5">
                  <button onClick={() => toggle(r.id)} className="w-full text-left">
                    <p className="text-sm text-cyan-50">{r.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {r.category} · {r.version}
                      {r.effectiveDate && ` · ${fmt(r.effectiveDate)} 起施行`}
                    </p>
                  </button>
                  {open === r.id && <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{r.content || r.summary}</p>}
                </li>
              ))}
            </ul>
          ))}

        {tab === "mine" &&
          (!mine ? loading : mine.length === 0 ? empty("你還沒有報修紀錄") : (
            <ul className="divide-y divide-cyan-500/10">
              {mine.map((r) => (
                <li key={r.id} className="px-4 py-2.5">
                  <p className="flex items-center gap-2 text-sm text-cyan-50">
                    <span className="flex-1">{r.title}</span>
                    <span className={`text-xs ${STATUS_TONE[r.status] ?? ""}`}>{r.status}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {r.category} · 📍 {r.zone || r.floor} · {fmt(r.createdAt)}
                  </p>
                  {r.description && <p className="mt-1 text-xs text-slate-400">{r.description}</p>}
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}
