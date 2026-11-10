"use client";

import { useState } from "react";
import { ROLES, roleOf, type Attendance, type RoleId, type Term, type TermKind, type TermMember } from "@/lib/mgmt";
import { api, BTN_DANGER, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, Field, INPUT, Modal } from "../ui";
import { fmtDate, upsert, useMgmt, type MeetingSummary } from "./common";

const KIND_ROLES: Record<TermKind, RoleId[]> = {
  committee: ["chair", "vice", "finance", "audit", "member1", "member2", "member3"],
  property: ["area_manager", "finance_advisor", "legal_advisor", "gm", "secretary", "guard", "cleaner"],
};
export const COMMITTEE_MEETINGS = new Set<MeetingSummary["type"]>(["管委會例會", "管委會臨時會"]);

/** 屆次期間內的會議（管委會：例會 / 臨時會） */
export function meetingsInTerm(meetings: MeetingSummary[], term: Term) {
  return meetings
    .filter((m) => (term.kind === "committee" ? COMMITTEE_MEETINGS.has(m.type) : true))
    .filter((m) => m.date && (!term.start || m.date >= term.start) && (!term.end || m.date <= term.end))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 某成員在某次會議的出席狀態；會議沒有出席資料時回傳 null */
export function statusOf(m: MeetingSummary, name: string): Attendance["status"] | "未列" | null {
  if (!m.attendance?.length) return null;
  return m.attendance.find((a) => a.name === name)?.status ?? "未列";
}

export const STATUS_MARK: Record<string, { mark: string; cls: string; label: string }> = {
  出席: { mark: "✓", cls: "text-emerald-300", label: "出席" },
  請假: { mark: "假", cls: "text-amber-200", label: "請假" },
  缺席: { mark: "✗", cls: "text-rose-300", label: "缺席" },
  未列: { mark: "✗", cls: "text-rose-300", label: "未列名（視為缺席）" },
  列席: { mark: "列", cls: "text-sky-300", label: "列席" },
  紀錄: { mark: "記", cls: "text-sky-300", label: "紀錄" },
};

export function attendanceSummary(meetings: MeetingSummary[], name: string) {
  const s = { 出席: 0, 請假: 0, 缺席: 0, total: 0 };
  for (const m of meetings) {
    const st = statusOf(m, name);
    if (!st) continue;
    s.total++;
    if (st === "出席" || st === "列席" || st === "紀錄") s.出席++;
    else if (st === "請假") s.請假++;
    else s.缺席++;
  }
  return s;
}

export function AttendanceMatrix({ term }: { term: Term }) {
  const { meetings, goTab } = useMgmt();
  const list = meetingsInTerm(meetings, term);
  if (!list.length) return <p className="text-xs text-slate-500">本屆尚無會議紀錄</p>;
  const people = term.members.filter((m) => m.name);
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr className="text-slate-400">
            <th className="sticky left-0 bg-[#030d1c] px-2 py-1 text-left font-normal">成員</th>
            {list.map((m) => (
              <th key={m.id} className="px-1.5 py-1 font-normal">
                <button onClick={() => goTab("meetings", { meeting: m.id })} className="font-mono hover:text-cyan-200" title={m.title}>
                  {m.date.slice(5).replace("-", "/")}
                </button>
              </th>
            ))}
            <th className="px-2 py-1 font-normal">出席率</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const s = attendanceSummary(list, p.name);
            return (
              <tr key={p.id} className="border-t border-cyan-500/10">
                <td className="sticky left-0 whitespace-nowrap bg-[#030d1c] px-2 py-1 text-slate-200">
                  {roleOf(p.roleId).short} {p.name}
                </td>
                {list.map((m) => {
                  const st = statusOf(m, p.name);
                  const mk = st ? STATUS_MARK[st] : null;
                  return (
                    <td key={m.id} className={`px-1.5 py-1 text-center ${mk?.cls ?? "text-slate-600"}`} title={mk?.label ?? "無出席資料"}>
                      {mk?.mark ?? "–"}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-center font-mono text-slate-300">{s.total ? `${Math.round((s.出席 / s.total) * 100)}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-slate-500">✓ 出席　假 請假　✗ 缺席 / 未列名　– 該次無出席資料</p>
    </div>
  );
}

const emptyMember = (roleId: RoleId): TermMember => ({ id: crypto.randomUUID(), roleId, name: "", phone: "", email: "", note: "", start: "", end: "" });

export function TermDialog({ term, kind, onClose, onSaved }: { term?: Term; kind: TermKind; onClose: () => void; onSaved?: (t: Term) => void }) {
  const { building, vendors, setTerms } = useMgmt();
  const roleIds = KIND_ROLES[kind];
  const [f, setF] = useState({
    name: term?.name ?? "",
    start: term?.start ?? "",
    end: term?.end ?? "",
    note: term?.note ?? "",
    companyId: term?.companyId ?? "",
    members: term?.members.length ? term.members : roleIds.map(emptyMember),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setM = (i: number, p: Partial<TermMember>) => setF((x) => ({ ...x, members: x.members.map((m, j) => (j === i ? { ...m, ...p } : m)) }));

  async function save() {
    if (!f.name.trim()) return setError("請填寫名稱");
    setBusy(true);
    try {
      const body = { ...f, kind, buildingId: building.id, members: f.members.filter((m) => m.name.trim()) };
      const saved = await api<Term>(term ? `/api/terms/${term.id}` : "/api/terms", { method: term ? "PATCH" : "POST", json: body });
      setTerms((all) => upsert(all, saved));
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function remove() {
    if (!term || !confirm(`刪除「${term.name}」？成員名單會一併刪除（會議紀錄保留）。`)) return;
    await api(`/api/terms/${term.id}`, { method: "DELETE" });
    setTerms((all) => all.filter((x) => x.id !== term.id));
    onClose();
  }

  const inp = `${INPUT} py-1 text-xs`;
  return (
    <Modal
      wide
      title={`${term ? "編輯" : "新增"}${kind === "committee" ? "管委會屆次" : "物業合約期"}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {term && (
            <button type="button" onClick={remove} className={BTN_DANGER}>
              刪除
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? "儲存中…" : "儲存"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="名稱 *" className="col-span-2">
          <input className={INPUT} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={kind === "committee" ? "例：第一屆" : "例：皇家國際（115–116）"} maxLength={60} autoFocus={!term} />
        </Field>
        <Field label="起日">
          <input type="date" className={INPUT} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
        </Field>
        <Field label="迄日">
          <input type="date" className={INPUT} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
        </Field>
        {kind === "property" && (
          <Field label="物業公司（廠商資料）" className="col-span-2 sm:col-span-4">
            <select className={INPUT} value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
              <option value="">（未連結，可先到「廠商資訊」新增物業公司）</option>
              {vendors
                .filter((v) => v.kind === "property")
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
      </div>
      <div className="space-y-1.5">
        <span className="text-xs text-cyan-300">成員名單（中途異動可填接任 / 卸任日，並新增一列）</span>
        <div className="grid grid-cols-[7.5em_1fr_1fr_1fr_auto] gap-1.5 text-[11px] text-slate-500">
          <span>職務</span>
          <span>姓名</span>
          <span>電話</span>
          <span>職責補充 / 班別</span>
          <span />
        </div>
        {f.members.map((m, i) => (
          <div key={m.id} className="space-y-1">
            <div className="grid grid-cols-[7.5em_1fr_1fr_1fr_auto] items-center gap-1.5">
              <select className={inp} value={m.roleId} onChange={(e) => setM(i, { roleId: e.target.value as RoleId })}>
                {ROLES.filter((r) => roleIds.includes(r.id)).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.short}
                  </option>
                ))}
              </select>
              <input className={inp} value={m.name} onChange={(e) => setM(i, { name: e.target.value })} maxLength={40} />
              <input type="tel" className={inp} value={m.phone} onChange={(e) => setM(i, { phone: e.target.value })} maxLength={40} />
              <input className={inp} value={m.note} onChange={(e) => setM(i, { note: e.target.value })} maxLength={500} />
              <button type="button" onClick={() => setF((x) => ({ ...x, members: x.members.filter((_, j) => j !== i) }))} className="px-1 text-rose-300" aria-label="移除">
                ✕
              </button>
            </div>
            {(m.start || m.end) && (
              <p className="pl-[8em] text-[10px] text-slate-500">
                任期 {fmtDate(m.start)} → {fmtDate(m.end)}
              </p>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setF((x) => ({ ...x, members: [...x.members, emptyMember(roleIds[roleIds.length - 1])] }))} className={`${BTN_OUTLINE} w-full`}>
          ＋ 新增成員
        </button>
      </div>
      <Field label="備註">
        <textarea className={`${INPUT} min-h-14`} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={2000} />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
