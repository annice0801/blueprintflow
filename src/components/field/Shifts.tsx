"use client";

import { useState } from "react";
import { onDuty, SHIFT_ROLES, type FieldSettings, type Shift, type ShiftCode } from "@/lib/field";
import { roleOf, termAt, type Term } from "@/lib/mgmt";
import { api, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, INPUT, Modal, nowLocal } from "../ui";
import { TODAY, upsert, useMgmt } from "../manage/common";

type Parsed = { year: number; month: number; days: number; rows: { name: string; roleId: Shift["roleId"]; cells: string[] }[]; codes: string[]; source: string };
const WEEK = "日一二三四五六";
const ROLE_ORDER: Shift["roleId"][] = ["area_manager", "gm", "secretary", "guard", "cleaner"];

/** 今日值班（現場 → 今日） */
export function TodayDuty() {
  const { shifts } = useMgmt();
  const today = TODAY();
  const now = nowLocal();
  // 含前一天的跨夜班
  const y = new Date(`${today}T00:00:00`);
  y.setDate(y.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  const list = shifts
    .filter((s) => s.date === today || (s.date === yesterday && s.end <= s.start && onDuty(s, now)))
    .sort((a, b) => ROLE_ORDER.indexOf(a.roleId) - ROLE_ORDER.indexOf(b.roleId) || a.start.localeCompare(b.start));
  return (
    <ul className="divide-y divide-cyan-500/10">
      {list.map((s) => {
        const on = onDuty(s, now);
        return (
          <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${on ? "bg-emerald-400" : "bg-slate-600"}`} />
            <span className="w-16 text-xs text-slate-400">{roleOf(s.roleId).short}</span>
            <span className="text-slate-100">{s.name}</span>
            <span className="font-mono text-xs text-cyan-200">
              {s.code} {s.start}–{s.end}
              {s.end <= s.start && "（隔日）"}
            </span>
            {s.post && <span className="text-xs text-slate-400">{s.post}</span>}
            <div className="flex-1" />
            {on && <span className="rounded border border-emerald-400/50 px-1.5 text-[11px] text-emerald-200">在班中</span>}
          </li>
        );
      })}
      {list.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">今天沒有班表資料，可到「班表」匯入</li>}
    </ul>
  );
}

/** 班表：整月矩陣、點格子改班、匯入 */
export default function Shifts() {
  const { building, shifts, setShifts, terms, settings, setSettings } = useMgmt();
  const [month, setMonth] = useState(TODAY().slice(0, 7));
  const [importing, setImporting] = useState(false);
  const [editCodes, setEditCodes] = useState(false);
  const [extra, setExtra] = useState<{ name: string; roleId: Shift["roleId"] }[]>([]);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Shift["roleId"]>("guard");
  if (!settings) return <p className="text-sm text-slate-500">載入中…</p>;

  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const monthShifts = shifts.filter((s) => s.date.startsWith(month));
  const term = termAt(terms, "property", `${month}-15`);
  // 人員：當期物業名單（排班職務）＋ 本月已有班的人 ＋ 手動新增列
  const people = new Map<string, Shift["roleId"]>();
  for (const x of term?.members ?? []) if ((SHIFT_ROLES as readonly string[]).includes(x.roleId) && x.name) people.set(x.name, x.roleId as Shift["roleId"]);
  for (const s of monthShifts) if (!people.has(s.name)) people.set(s.name, s.roleId);
  for (const e of extra) if (!people.has(e.name)) people.set(e.name, e.roleId);
  const rows = [...people.entries()].sort((a, b) => ROLE_ORDER.indexOf(a[1]) - ROLE_ORDER.indexOf(b[1]) || a[0].localeCompare(b[0], "zh-Hant"));
  const today = TODAY();

  async function setCell(name: string, roleId: Shift["roleId"], date: string, code: string) {
    try {
      const { shift } = await api<{ shift: Shift | null }>("/api/shifts", { method: "POST", json: { buildingId: building.id, name, roleId, date, code } });
      setShifts((all) => {
        const rest = all.filter((s) => !(s.name === name && s.date === date));
        return shift ? [...rest, shift] : rest;
      });
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" className={`${INPUT} max-w-44 py-1.5`} value={month} onChange={(e) => setMonth(e.target.value)} />
        <span className="text-xs text-slate-400">點格子切換班別；休假會清空</span>
        <div className="flex-1" />
        <button onClick={() => setEditCodes(true)} className={BTN_OUTLINE}>
          班別設定
        </button>
        <button onClick={() => setImporting(true)} className={BTN_PRIMARY}>
          ⬆ 匯入班表（PDF / Excel / CSV）
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
        {settings.shiftCodes.map((c) => (
          <span key={c.code} className="rounded bg-white/5 px-1.5 py-0.5">
            <b className="text-cyan-100">{c.code}</b> {c.label}
            {!c.off && ` ${c.start}–${c.end}`}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-cyan-500/20">
        <table className="text-xs">
          <thead>
            <tr className="text-slate-400">
              <th className="sticky left-0 z-10 min-w-36 bg-[#030d1c] px-2 py-1.5 text-left font-normal">人員</th>
              {Array.from({ length: days }, (_, i) => {
                const d = `${month}-${String(i + 1).padStart(2, "0")}`;
                const dow = new Date(`${d}T00:00`).getDay();
                return (
                  <th key={i} className={`min-w-8 px-0.5 py-1 text-center font-normal ${d === today ? "bg-cyan-400/20 text-cyan-50" : dow === 0 || dow === 6 ? "text-rose-300/80" : ""}`}>
                    <div>{i + 1}</div>
                    <div className="text-[10px]">{WEEK[dow]}</div>
                  </th>
                );
              })}
              <th className="px-2 font-normal">班數</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, roleId]) => {
              const mine = monthShifts.filter((s) => s.name === name);
              return (
                <tr key={name} className="border-t border-cyan-500/10">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-[#030d1c] px-2 py-1">
                    <span className="mr-1.5 text-slate-500">{roleOf(roleId).short}</span>
                    <span className="text-slate-100">{name}</span>
                  </td>
                  {Array.from({ length: days }, (_, i) => {
                    const d = `${month}-${String(i + 1).padStart(2, "0")}`;
                    const s = mine.find((x) => x.date === d);
                    return (
                      <td key={i} className={`p-0 text-center ${d === today ? "bg-cyan-400/10" : ""}`}>
                        <select
                          value={s?.code ?? ""}
                          onChange={(e) => setCell(name, roleId, d, e.target.value)}
                          className={`h-7 w-8 cursor-pointer appearance-none bg-transparent text-center font-semibold outline-none ${s ? "text-cyan-100" : "text-slate-700"}`}
                          title={s ? `${s.code} ${s.start}–${s.end}` : "未排班"}
                          aria-label={`${name} ${d}`}
                        >
                          <option value="" className="bg-[#06142a]">
                            ·
                          </option>
                          {settings.shiftCodes.map((c) => (
                            <option key={c.code} value={c.code} className="bg-[#06142a]">
                              {c.code}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                  <td className="px-2 text-center font-mono text-slate-300">{mine.length}</td>
                </tr>
              );
            })}
            <tr className="border-t border-cyan-500/20">
              <td colSpan={days + 2} className="px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <select className={`${INPUT} max-w-24 py-1 text-xs`} value={newRole} onChange={(e) => setNewRole(e.target.value as Shift["roleId"])} aria-label="職務">
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {roleOf(r).short}
                      </option>
                    ))}
                  </select>
                  <input className={`${INPUT} max-w-44 py-1 text-xs`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新增排班人員姓名" />
                  <button
                    disabled={!newName.trim()}
                    onClick={() => {
                      setExtra((x) => [...x, { name: newName.trim(), roleId: newRole }]);
                      setNewName("");
                    }}
                    className={`${BTN_OUTLINE} shrink-0 whitespace-nowrap py-1 text-xs`}
                  >
                    ＋ 加入列
                  </button>
                  <span className="text-[11px] text-slate-500">要同時加入組織架構，請到「組織架構 → 物業」新增成員，或匯入時勾選「加入物業名單」</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {importing && <ImportDialog settings={settings} onClose={() => setImporting(false)} onMonth={setMonth} />}
      {editCodes && <CodesDialog settings={settings} onClose={() => setEditCodes(false)} onSaved={setSettings} />}
    </div>
  );
}

function ImportDialog({ settings, onClose, onMonth }: { settings: FieldSettings; onClose: () => void; onMonth: (m: string) => void }) {
  const { building, setShifts, setTerms } = useMgmt();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [opts, setOpts] = useState({ replace: true, addMembers: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const known = new Set(settings.shiftCodes.map((c) => c.code));

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("file", file);
    try {
      const p = await api<Parsed>("/api/shifts/parse", { method: "POST", body: fd });
      setParsed(p);
      setCodeMap(Object.fromEntries(p.codes.filter((c) => !known.has(c)).map((c) => [c, /^[-–—xX／/○OFFoff休例假]+$/.test(c) ? "休" : ""])));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!parsed) return;
    setBusy(true);
    try {
      const res = await api<{ created: number; skipped: string[]; added: number; term?: Term }>("/api/shifts/import", {
        method: "POST",
        json: { buildingId: building.id, year: parsed.year, month: parsed.month, rows: parsed.rows, codeMap, source: parsed.source, ...opts },
      });
      const ym = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
      setShifts(await api<Shift[]>(`/api/shifts?buildingId=${building.id}`));
      if (res.term) setTerms((all) => upsert(all, res.term!));
      onMonth(ym);
      alert(`已匯入 ${res.created} 個班${res.added ? `，新增 ${res.added} 位物業成員` : ""}${res.skipped.length ? `\n未對應的代號已略過：${res.skipped.join("、")}` : ""}`);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const unknown = Object.keys(codeMap);
  return (
    <Modal
      wide
      title="匯入班表"
      subtitle="支援 PDF、Word、Excel、CSV。格式：一列一人、一欄一天（表頭 1、2、3…），格內為班別代號"
      onClose={onClose}
      onSubmit={doImport}
      footer={
        <>
          {parsed && (
            <span className="text-xs text-slate-400">
              {parsed.rows.length} 人 · {parsed.year - 1911} 年 {parsed.month} 月
            </span>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={!parsed || busy || unknown.some((c) => !codeMap[c])} className={BTN_PRIMARY}>
            {busy ? "處理中…" : "確認匯入"}
          </button>
        </>
      }
    >
      <input
        type="file"
        accept=".pdf,.docx,.xlsx,.csv,.txt"
        onChange={(e) => upload(e.target.files?.[0])}
        className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-cyan-100"
      />
      <ErrorText>{error}</ErrorText>
      {parsed && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-1">
              年
              <input type="number" className={`${INPUT} w-20 py-1 text-xs`} value={parsed.year} onChange={(e) => setParsed({ ...parsed, year: Number(e.target.value) })} />
            </label>
            <label className="flex items-center gap-1">
              月
              <input type="number" min={1} max={12} className={`${INPUT} w-16 py-1 text-xs`} value={parsed.month} onChange={(e) => setParsed({ ...parsed, month: Number(e.target.value) })} />
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={opts.replace} onChange={(e) => setOpts({ ...opts, replace: e.target.checked })} className="accent-cyan-400" />
              取代這些人當月原有班表
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={opts.addMembers} onChange={(e) => setOpts({ ...opts, addMembers: e.target.checked })} className="accent-cyan-400" />
              新人員加入物業名單（組織架構）
            </label>
          </div>
          {unknown.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-400/40 bg-amber-500/10 p-2 text-xs text-amber-100">
              <p>以下代號尚未設定，請對應到既有班別：</p>
              <div className="flex flex-wrap gap-2">
                {unknown.map((c) => (
                  <label key={c} className="flex items-center gap-1">
                    <b>{c}</b> →
                    <select className="rounded border border-amber-400/40 bg-slate-950 px-1 py-0.5" value={codeMap[c]} onChange={(e) => setCodeMap({ ...codeMap, [c]: e.target.value })}>
                      <option value="">選擇</option>
                      {settings.shiftCodes.map((k) => (
                        <option key={k.code} value={k.code}>
                          {k.code} {k.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="max-h-72 overflow-auto rounded border border-cyan-500/20">
            <table className="text-[11px]">
              <thead className="sticky top-0 bg-[#06142a] text-slate-400">
                <tr>
                  <th className="px-2 py-1 text-left font-normal">姓名</th>
                  <th className="px-1 font-normal">職務</th>
                  {Array.from({ length: parsed.days }, (_, i) => (
                    <th key={i} className="px-1 font-normal">
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((r, ri) => (
                  <tr key={ri} className="border-t border-cyan-500/10">
                    <td className="px-1">
                      <input className="w-16 bg-transparent text-slate-100 outline-none" value={r.name} onChange={(e) => setParsed({ ...parsed, rows: parsed.rows.map((x, j) => (j === ri ? { ...x, name: e.target.value } : x)) })} aria-label="姓名" />
                    </td>
                    <td className="px-1">
                      <select className="bg-transparent text-cyan-200 outline-none" value={r.roleId} onChange={(e) => setParsed({ ...parsed, rows: parsed.rows.map((x, j) => (j === ri ? { ...x, roleId: e.target.value as Shift["roleId"] } : x)) })} aria-label="職務">
                        {ROLE_ORDER.map((k) => (
                          <option key={k} value={k} className="bg-[#06142a]">
                            {roleOf(k).short}
                          </option>
                        ))}
                      </select>
                    </td>
                    {r.cells.map((c, i) => (
                      <td key={i} className={`px-1 text-center ${known.has(codeMap[c] ?? c) ? "text-cyan-100" : c ? "text-amber-200" : "text-slate-700"}`}>
                        {c || "·"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

function CodesDialog({ settings, onClose, onSaved }: { settings: FieldSettings; onClose: () => void; onSaved: (s: FieldSettings) => void }) {
  const { building } = useMgmt();
  const [codes, setCodes] = useState<ShiftCode[]>(settings.shiftCodes);
  const [error, setError] = useState("");
  const set = (i: number, p: Partial<ShiftCode>) => setCodes((x) => x.map((c, j) => (j === i ? { ...c, ...p } : c)));
  async function save() {
    try {
      onSaved(await api<FieldSettings>("/api/field/settings", { method: "PUT", json: { buildingId: building.id, shiftCodes: codes } }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const inp = `${INPUT} py-1 text-xs`;
  return (
    <Modal
      title="班別設定"
      subtitle="代號需與班表上的寫法一致；結束早於開始表示跨夜"
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" className={BTN_PRIMARY}>
            儲存
          </button>
        </>
      }
    >
      <div className="grid grid-cols-[4em_1fr_6em_6em_auto_auto] items-center gap-1.5 text-[11px] text-slate-400">
        <span>代號</span>
        <span>名稱</span>
        <span>開始</span>
        <span>結束</span>
        <span>休假</span>
        <span />
        {codes.map((c, i) => (
          <div key={i} className="contents">
            <input className={inp} value={c.code} onChange={(e) => set(i, { code: e.target.value })} maxLength={4} />
            <input className={inp} value={c.label} onChange={(e) => set(i, { label: e.target.value })} />
            <input type="time" className={inp} value={c.start} disabled={c.off} onChange={(e) => set(i, { start: e.target.value })} />
            <input type="time" className={inp} value={c.end} disabled={c.off} onChange={(e) => set(i, { end: e.target.value })} />
            <input type="checkbox" checked={!!c.off} onChange={(e) => set(i, { off: e.target.checked })} className="accent-cyan-400" />
            <button type="button" onClick={() => setCodes((x) => x.filter((_, j) => j !== i))} className="text-rose-300" aria-label="移除">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setCodes((x) => [...x, { code: "", label: "", start: "08:00", end: "17:00" }])} className={`${BTN_OUTLINE} w-full`}>
        ＋ 新增班別
      </button>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
