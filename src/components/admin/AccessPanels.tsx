"use client";

import { useEffect, useState } from "react";
import { ROLES, roleOf, type RoleId } from "@/lib/mgmt";
import { LEVEL_LABEL, LEVELS, MODULES, roleLabel, STATUS_LABEL, SYS_ROLES, type AuditEntry, type Level, type Perms, type SysRole, type MemberRow, type UserStatus } from "@/lib/perms";
import { useMe } from "../auth/AuthProvider";
import { api, BTN_GHOST, BTN_PRIMARY, ErrorText, Field, INPUT, Modal } from "../ui";
import { upsert } from "../manage/common";

const STATUS_TONE: Record<UserStatus, string> = { active: "text-emerald-300", pending: "text-amber-300", disabled: "text-slate-500" };

export function Users({ users, setUsers }: { users: MemberRow[]; setUsers: React.Dispatch<React.SetStateAction<MemberRow[]>> }) {
  const me = useMe();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<MemberRow | "new" | null>(null);
  const [error, setError] = useState("");
  const order: UserStatus[] = ["pending", "active", "disabled"];
  const rows = users
    .filter((u) => !q || `${u.name}${u.email}${u.membership.unitId ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => order.indexOf(a.membership.status) - order.indexOf(b.membership.status) || (b.lastLoginAt || "").localeCompare(a.lastLoginAt || ""));

  async function quick(u: MemberRow, patch: Partial<MemberRow["membership"]>) {
    setError("");
    try {
      const saved = await api<MemberRow>(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: "PATCH", json: patch });
      setUsers((all) => upsert(all, saved));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${INPUT} max-w-64 py-1.5`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋姓名、信箱、戶別" />
        <span className="text-xs text-slate-400">本社區共 {users.length} 位成員</span>
        <div className="flex-1" />
        <button onClick={() => setEdit("new")} className={BTN_PRIMARY}>
          ＋ 預先加入成員
        </button>
      </div>
      <p className="text-[11px] text-slate-400">申請加入本社區的帳號會出現在「待核准」，核准時指定身分；也可以先「預先加入」信箱，對方用該 Google 帳號登入即可直接使用。同一帳號在不同社區可以有不同身分。</p>
      <ErrorText>{error}</ErrorText>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-cyan-500/20">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 bg-[#06142a] text-left text-xs text-cyan-300">
            <tr className="border-b border-cyan-500/30">
              <th className="px-3 py-2">使用者</th>
              <th className="px-3 py-2">狀態</th>
              <th className="px-3 py-2">身分</th>
              <th className="px-3 py-2">組織職務 / 戶別</th>
              <th className="px-3 py-2">最後登入</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const self = u.id === me?.user.id;
              const locked = self;
              return (
                <tr key={u.id} className={`border-b border-cyan-500/10 ${u.membership.status === "pending" ? "bg-amber-500/5" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {u.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.picture} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs">{(u.name || u.email)[0]}</span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-cyan-50">
                          {u.name || "（未填姓名）"}
                          {self && <span className="ml-1 text-[10px] text-cyan-300">你</span>}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-xs ${STATUS_TONE[u.membership.status]}`}>{STATUS_LABEL[u.membership.status]}</td>
                  <td className="px-3 py-2">
                    {locked ? (
                      <span className="text-xs text-slate-300">{roleLabel(u.membership.role)}</span>
                    ) : (
                      <select className={`${INPUT} w-32 py-1 text-xs`} value={u.membership.role} onChange={(e) => quick(u, { role: e.target.value as SysRole })} aria-label="身分">
                        {SYS_ROLES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{[u.membership.orgRole && roleOf(u.membership.orgRole).short, u.membership.unitId].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{u.lastLoginAt ? u.lastLoginAt.slice(0, 16).replace("T", " ") : "尚未登入"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {u.membership.status === "pending" && (
                      <button onClick={() => quick(u, { status: "active" })} className="mr-1 rounded-md bg-emerald-500/80 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400">
                        核准
                      </button>
                    )}
                    {!locked && u.membership.status === "active" && (
                      <button onClick={() => quick(u, { status: "disabled" })} className="mr-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/5">
                        停用
                      </button>
                    )}
                    {!locked && u.membership.status === "disabled" && (
                      <button onClick={() => quick(u, { status: "active" })} className="mr-1 rounded px-2 py-1 text-xs text-emerald-300 hover:bg-white/5">
                        啟用
                      </button>
                    )}
                    <button onClick={() => setEdit(u)} className="rounded px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-400/10">
                      編輯
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {edit && (
        <UserDialog
          user={edit === "new" ? null : edit}
          self={edit !== "new" && edit.id === me?.user.id}
          onClose={() => setEdit(null)}
          onSaved={(u) => setUsers((all) => upsert(all, u))}
          onRemoved={(id) => setUsers((all) => all.filter((x) => x.id !== id))}
        />
      )}
    </div>
  );
}

function UserDialog({ user, self, onClose, onSaved, onRemoved }: { user: MemberRow | null; self: boolean; onClose: () => void; onSaved: (u: MemberRow) => void; onRemoved: (id: string) => void }) {
  const locked = self;
  const [f, setF] = useState({ email: user?.email ?? "", name: user?.name ?? "", role: user?.membership.role ?? ("resident" as SysRole), orgRole: user?.membership.orgRole ?? "", unitId: user?.membership.unitId ?? "", note: user?.membership.note ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const body = locked ? { name: f.name, orgRole: f.orgRole, unitId: f.unitId, note: f.note } : f;
      const saved = user ? await api<MemberRow>(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "PATCH", json: body }) : await api<MemberRow>("/api/admin/users", { method: "POST", json: f });
      onSaved(saved);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function remove() {
    if (!user || !confirm(`將 ${user.email} 移出本社區？帳號在其他社區的身分不受影響。`)) return;
    try {
      await api(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
      onRemoved(user.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={user ? "編輯成員" : "預先加入成員"}
      subtitle={user?.email}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {user && !locked && (
            <button type="button" onClick={remove} className="rounded-md px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10">
              移出社區
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
      <div className="grid grid-cols-2 gap-3">
        {!user && (
          <Field label="Google 信箱 *" className="col-span-2">
            <input type="email" required className={INPUT} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@gmail.com" />
          </Field>
        )}
        <Field label="姓名">
          <input className={INPUT} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="身分（決定權限）">
          <select className={INPUT} value={f.role} disabled={locked} onChange={(e) => setF({ ...f, role: e.target.value as SysRole })}>
            {SYS_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="組織職務（待辦指派對應）">
          <select className={INPUT} value={f.orgRole} onChange={(e) => setF({ ...f, orgRole: e.target.value as RoleId | "" })}>
            <option value="">（無）</option>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.group} · {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="戶別（住戶）">
          <input className={INPUT} value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value })} placeholder="例：A-12F-A3" />
        </Field>
        <Field label="備註" className="col-span-2">
          <input className={INPUT} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
      </div>
      <p className="text-[11px] text-slate-400">{SYS_ROLES.find((r) => r.id === f.role)?.note}</p>
      {locked && <p className="text-[11px] text-amber-300">不能修改自己的身分與狀態。</p>}
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}

export function Roles() {
  const [perms, setPerms] = useState<Record<SysRole, Perms> | null>(null);
  const [dirty, setDirty] = useState<Set<SysRole>>(new Set());
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    api<Record<SysRole, Perms>>("/api/admin/roles").then(setPerms, (e) => setError((e as Error).message));
  }, []);
  if (!perms) return <ErrorText>{error}</ErrorText>;

  const set = (r: SysRole, m: (typeof MODULES)[number]["id"], l: Level) => {
    setPerms({ ...perms, [r]: { ...perms[r], [m]: l } });
    setDirty((d) => new Set(d).add(r));
    setMsg("");
  };
  async function save() {
    setError("");
    try {
      let latest = perms!;
      for (const r of dirty) latest = await api<Record<SysRole, Perms>>("/api/admin/roles", { method: "PUT", json: { role: r, perms: perms![r] } });
      setPerms(latest);
      setDirty(new Set());
      setMsg("已儲存，15 秒內對所有使用者生效");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const tone: Record<Level, string> = { none: "text-slate-500", view: "text-cyan-200", edit: "text-emerald-300" };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="text-[11px] text-slate-400">本社區每個身分對各功能的權限：檢視 = 只能看；編輯 = 可新增、修改、刪除。各社區可以設定不同的權限表；系統擁有者固定擁有全部社區的全部權限。</p>
        <div className="flex-1" />
        {msg && <span className="text-xs text-emerald-300">{msg}</span>}
        <button onClick={save} disabled={!dirty.size} className={BTN_PRIMARY}>
          儲存變更{dirty.size > 0 && `（${dirty.size}）`}
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-cyan-500/20">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 bg-[#06142a] text-xs text-cyan-300">
            <tr className="border-b border-cyan-500/30">
              <th className="px-3 py-2 text-left">功能</th>
              {SYS_ROLES.map((r) => (
                <th key={r.id} className="px-2 py-2 text-center" title={r.note}>
                  {r.label}
                  {dirty.has(r.id) && <span className="text-amber-300"> •</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.id} className="border-b border-cyan-500/10">
                <td className="px-3 py-1.5 text-slate-200">{m.label}</td>
                {SYS_ROLES.map((r) => (
                  <td key={r.id} className="px-2 py-1.5 text-center">
                    {r.id === "admin" && m.id === "admin" ? (
                      <span className={`text-xs ${tone.edit}`}>{LEVEL_LABEL.edit}</span>
                    ) : (
                      <select
                        value={perms[r.id][m.id]}
                        onChange={(e) => set(r.id, m.id, e.target.value as Level)}
                        className={`rounded border border-cyan-500/20 bg-slate-950/60 px-1.5 py-0.5 text-xs ${tone[perms[r.id][m.id]]}`}
                        aria-label={`${r.label} ${m.label}`}
                      >
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {LEVEL_LABEL[l]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const METHOD_LABEL: Record<string, string> = { POST: "新增", PATCH: "修改", PUT: "修改", DELETE: "刪除", VIEW: "查看個資" };

export function Audit({ users }: { users: MemberRow[] }) {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [email, setEmail] = useState("");
  const [mod, setMod] = useState("");
  useEffect(() => {
    const q = new URLSearchParams({ ...(email && { email }), ...(mod && { module: mod }) });
    api<AuditEntry[]>(`/api/admin/audit?${q}`).then(setRows, () => {});
  }, [email, mod]);
  const nameOf = (e: string) => users.find((u) => u.email === e)?.name || e;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <select className={`${INPUT} max-w-60 py-1.5`} value={email} onChange={(e) => setEmail(e.target.value)} aria-label="使用者">
          <option value="">全部使用者</option>
          {users.map((u) => (
            <option key={u.id} value={u.email}>
              {u.name || u.email}
            </option>
          ))}
        </select>
        <select className={`${INPUT} max-w-60 py-1.5`} value={mod} onChange={(e) => setMod(e.target.value)} aria-label="功能">
          <option value="">全部功能</option>
          {MODULES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="self-center text-xs text-slate-400">最近 {rows.length} 筆新增、修改、刪除與個資查看</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-cyan-500/20">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#06142a] text-left text-xs text-cyan-300">
            <tr className="border-b border-cyan-500/30">
              <th className="px-3 py-2">時間</th>
              <th className="px-3 py-2">使用者</th>
              <th className="px-3 py-2">動作</th>
              <th className="px-3 py-2">功能</th>
              <th className="px-3 py-2">路徑</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-cyan-500/10">
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-slate-400">{new Date(r.at).toLocaleString("zh-TW", { hour12: false })}</td>
                <td className="px-3 py-1.5 text-xs text-slate-200">{nameOf(r.email)}</td>
                <td className="px-3 py-1.5 text-xs text-cyan-200">{METHOD_LABEL[r.method] ?? r.method}</td>
                <td className="px-3 py-1.5 text-xs text-slate-300">{MODULES.find((m) => m.id === r.module)?.label ?? "—"}</td>
                <td className="max-w-md truncate px-3 py-1.5 font-mono text-[11px] text-slate-500">{r.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-10 text-center text-xs text-slate-500">尚無紀錄</p>}
      </div>
    </div>
  );
}
