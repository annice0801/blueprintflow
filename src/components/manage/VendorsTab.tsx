"use client";

import { useState } from "react";
import { COMPANY_KIND_LABEL, COMPANY_KINDS, type CompanyKind } from "@/lib/mgmt";
import { BTN_PRIMARY, INPUT } from "../ui";
import { useMgmt } from "./common";
import { CompanyDialog, CompanyPanel, contractState, KIND_COLOR } from "./company";

export default function VendorsTab({ focusId }: { focusId?: string }) {
  const { vendors } = useMgmt();
  const [kind, setKind] = useState<CompanyKind | "">("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(focusId ?? null);
  const [adding, setAdding] = useState(false);

  const shown = vendors
    .filter((v) => (!kind || v.kind === kind) && (!q || `${v.name}${v.contact}${v.scope}${v.category}${v.taxId}${v.contacts?.map((c) => c.name).join("")}`.includes(q)))
    .sort((a, b) => COMPANY_KINDS.indexOf(a.kind) - COMPANY_KINDS.indexOf(b.kind) || a.category.localeCompare(b.category, "zh-Hant"));
  const open = vendors.find((v) => v.id === openId);
  const expiring = vendors.filter((v) => contractState(v)?.text.includes("天後")).length;

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${INPUT} max-w-56 py-1.5`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋公司、統編、聯絡人" />
          <div className="flex-1" />
          <button onClick={() => setAdding(true)} className={BTN_PRIMARY}>
            ＋ 新增公司 / 廠商
          </button>
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          {(["", ...COMPANY_KINDS] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`rounded-full border px-2.5 py-1 ${kind === k ? "border-cyan-300 bg-cyan-400/20 text-cyan-50" : "border-slate-600 text-slate-300"}`}>
              {k ? COMPANY_KIND_LABEL[k] : "全部"} <span className="text-slate-400">{k ? vendors.filter((v) => v.kind === k).length : vendors.length}</span>
            </button>
          ))}
          {expiring > 0 && <span className="self-center text-amber-200">⚠ {expiring} 家合約 30 天內到期</span>}
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-cyan-500/10 overflow-y-auto rounded-lg border border-cyan-500/20">
          {shown.length === 0 && <li className="px-3 py-10 text-center text-xs text-slate-500">尚無資料。可新增建商（含負責人、起造人、統編）、建商當時配合的廠商、自行發包廠商與物業公司。</li>}
          {shown.map((v) => {
            const st = contractState(v);
            const builder = v.builderId ? vendors.find((b) => b.id === v.builderId) : undefined;
            return (
              <li key={v.id}>
                <button onClick={() => setOpenId(v.id)} className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-cyan-400/5 ${openId === v.id ? "bg-cyan-400/10" : ""}`}>
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[v.kind] }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm text-cyan-50">{v.name}</span>
                      {st && <span className={`shrink-0 rounded border px-1 text-[10px] ${st.cls}`}>{st.text}</span>}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {COMPANY_KIND_LABEL[v.kind]} · {v.category}
                      {builder && ` · ${builder.name}`}
                      {v.phone && ` · ${v.phone}`}
                      {` · 聯絡人 ${v.contacts?.length ?? 0} · 紀錄 ${v.records?.length ?? 0}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="min-h-0 overflow-y-auto rounded-lg border border-cyan-500/20 p-4">
        {open ? <CompanyPanel key={open.id} company={open} onOpenCompany={setOpenId} /> : <p className="py-10 text-center text-sm text-slate-500">選擇左側公司查看資料、聯絡人與維修紀錄</p>}
      </div>
      {adding && <CompanyDialog preset={kind ? { kind } : undefined} onClose={() => setAdding(false)} onSaved={(v) => setOpenId(v.id)} />}
    </div>
  );
}
