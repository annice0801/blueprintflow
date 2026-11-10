"use client";

import { useEffect, useState } from "react";
import { api } from "../ui";

type Sys = { counts: { id: string; label: string; count: number }[]; env: { key: string; set: boolean }[]; blobAccess: string; runtime: { node: string; vercel: boolean; region: string; commit: string } };

export default function SystemPanel() {
  const [d, setD] = useState<Sys | null>(null);
  useEffect(() => {
    api<Sys>("/api/admin/system").then(setD, () => {});
  }, []);
  if (!d) return <p className="text-sm text-slate-400">讀取中…</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-cyan-500/20 p-4">
        <h3 className="mb-3 text-sm font-semibold text-cyan-50">必要設定</h3>
        <ul className="space-y-1.5 text-sm">
          {d.env.map((e) => (
            <li key={e.key} className="flex items-center gap-2">
              <span className={e.set ? "text-emerald-300" : "text-rose-300"}>{e.set ? "✓" : "✕"}</span>
              <span className="font-mono text-xs text-slate-200">{e.key}</span>
              <span className="ml-auto text-xs text-slate-500">{e.set ? "已設定" : "未設定"}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 border-t border-cyan-500/10 pt-1.5">
            <span className={d.blobAccess === "private" ? "text-emerald-300" : "text-amber-300"}>{d.blobAccess === "private" ? "✓" : "!"}</span>
            <span className="text-xs text-slate-200">檔案儲存（Vercel Blob）</span>
            <span className="ml-auto text-xs text-slate-500">{d.blobAccess === "private" ? "private" : "public store（建議改 private）"}</span>
          </li>
        </ul>
        <p className="mt-4 text-[11px] text-slate-500">
          執行環境：{d.runtime.vercel ? `Vercel · ${d.runtime.region}` : "本機"} · Node {d.runtime.node}
          {d.runtime.commit && ` · 版本 ${d.runtime.commit}`}
        </p>
      </section>
      <section className="rounded-xl border border-cyan-500/20 p-4">
        <h3 className="mb-3 text-sm font-semibold text-cyan-50">資料筆數（MongoDB）</h3>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {d.counts.map((c) => (
            <li key={c.id} className="flex">
              <span className="text-slate-300">{c.label}</span>
              <span className="ml-auto font-mono text-slate-100">{c.count < 0 ? "—" : c.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
