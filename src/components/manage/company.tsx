"use client";

import { useState } from "react";
import { COMPANY_KIND_LABEL, COMPANY_KINDS, RECORD_TYPES, VENDOR_CATEGORIES, type CompanyKind, type Contact, type PlanRef, type ServiceRecord, type Vendor } from "@/lib/mgmt";
import { api, BTN_DANGER, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, Select } from "../ui";
import { fmtDate, planLink, PlanRefPicker, StatusBadge, TODAY, upsert, useMgmt } from "./common";

const tel = (n: string) => (n ? <a href={`tel:${n.replace(/[^\d+]/g, "")}`} className="text-cyan-300 hover:underline">{n}</a> : null);

export const KIND_COLOR: Record<CompanyKind, string> = { builder: "#fb923c", "builder-vendor": "#fdba74", vendor: "#34d399", property: "#4cc9ff" };

export function KindBadge({ kind }: { kind: CompanyKind }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-200">
      <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[kind] }} />
      {COMPANY_KIND_LABEL[kind]}
    </span>
  );
}

/** 合約狀態提示 */
export function contractState(v: Vendor, today = TODAY()) {
  if (!v.contractEnd) return null;
  const left = (Date.parse(v.contractEnd) - Date.parse(today)) / 86400000;
  if (left < 0) return { text: "合約已到期", cls: "border-rose-400/60 text-rose-200" };
  if (left <= 30) return { text: `${Math.ceil(left)} 天後到期`, cls: "border-amber-400/60 text-amber-200" };
  return null;
}

/** 建商的營造廠（依承攬期間排序；迄日已過＝已更換） */
export function contractorsOf(vendors: Vendor[], builderId: string) {
  return vendors
    .filter((v) => v.kind === "builder-vendor" && v.builderId === builderId && v.category === "建設 / 營造")
    .sort((a, b) => (a.contractStart || "9999").localeCompare(b.contractStart || "9999"));
}
export const isReplaced = (v: Vendor, today = TODAY()) => !!v.contractEnd && v.contractEnd < today;

/* ── 公司資料對話框 ── */

export function CompanyDialog({ company, preset, onClose, onSaved }: { company?: Vendor; preset?: Partial<Vendor>; onClose: () => void; onSaved?: (v: Vendor) => void }) {
  const { building, vendors, setVendors, setTodos } = useMgmt();
  const base = { ...preset, ...company };
  const [f, setF] = useState({
    kind: base.kind ?? ("vendor" as CompanyKind),
    name: base.name ?? "",
    category: base.category ?? ("其他" as Vendor["category"]),
    taxId: base.taxId ?? "",
    representative: base.representative ?? "",
    representativePhone: base.representativePhone ?? "",
    developer: base.developer ?? "",
    developerPhone: base.developerPhone ?? "",
    builderId: base.builderId ?? "",
    contact: base.contact ?? "",
    phone: base.phone ?? "",
    email: base.email ?? "",
    address: base.address ?? "",
    website: base.website ?? "",
    scope: base.scope ?? "",
    contractStart: base.contractStart ?? "",
    contractEnd: base.contractEnd ?? "",
    amount: base.amount ?? "",
    note: base.note ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const builders = vendors.filter((v) => v.kind === "builder");

  async function save() {
    if (!f.name.trim()) return setError("請填寫公司名稱");
    setBusy(true);
    try {
      const saved = await api<Vendor>(company ? `/api/vendors/${company.id}` : "/api/vendors", { method: company ? "PATCH" : "POST", json: { ...f, buildingId: building.id } });
      setVendors((all) => upsert(all, saved));
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function remove() {
    if (!company || !confirm(`刪除「${company.name}」？聯絡人與維修紀錄會一併刪除。`)) return;
    await api(`/api/vendors/${company.id}`, { method: "DELETE" });
    setVendors((all) => all.filter((x) => x.id !== company.id).map((x) => (x.builderId === company.id ? { ...x, builderId: "" } : x)));
    setTodos((all) => all.map((t) => (t.vendorId === company.id ? { ...t, vendorId: undefined } : t)));
    onClose();
  }

  return (
    <Modal
      wide
      title={company ? `編輯 ${company.name}` : `新增${COMPANY_KIND_LABEL[f.kind]}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {company && (
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="類型">
          <select className={INPUT} value={f.kind} onChange={(e) => set("kind", e.target.value as CompanyKind)}>
            {COMPANY_KINDS.map((k) => (
              <option key={k} value={k}>
                {COMPANY_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="公司名稱 *" className="sm:col-span-2">
          <input className={INPUT} value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} autoFocus={!company} />
        </Field>
        <Field label="類別">
          <Select value={f.category} options={VENDOR_CATEGORIES} onChange={(v) => set("category", v)} />
        </Field>
        <Field label="統一編號">
          <input className={INPUT} value={f.taxId} onChange={(e) => set("taxId", e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" placeholder="8 位數字" />
        </Field>
        <Field label="公司電話">
          <input type="tel" className={INPUT} value={f.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} />
        </Field>
        <Field label="負責人">
          <input className={INPUT} value={f.representative} onChange={(e) => set("representative", e.target.value)} maxLength={40} />
        </Field>
        <Field label="負責人電話">
          <input type="tel" className={INPUT} value={f.representativePhone} onChange={(e) => set("representativePhone", e.target.value)} maxLength={40} />
        </Field>
        <Field label="Email">
          <input type="email" className={INPUT} value={f.email} onChange={(e) => set("email", e.target.value)} maxLength={80} />
        </Field>
        {f.kind === "builder" && (
          <>
            <Field label="起造人">
              <input className={INPUT} value={f.developer} onChange={(e) => set("developer", e.target.value)} maxLength={80} placeholder="使用執照上的起造人" />
            </Field>
            <Field label="起造人電話">
              <input type="tel" className={INPUT} value={f.developerPhone} onChange={(e) => set("developerPhone", e.target.value)} maxLength={40} />
            </Field>
          </>
        )}
        {f.kind === "builder-vendor" && (
          <Field label="所屬建商">
            <select className={INPUT} value={f.builderId} onChange={(e) => set("builderId", e.target.value)}>
              <option value="">（未指定）</option>
              {builders.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="主要聯絡窗口">
          <input className={INPUT} value={f.contact} onChange={(e) => set("contact", e.target.value)} maxLength={40} />
        </Field>
        <Field label="地址" className="col-span-2">
          <input className={INPUT} value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={120} />
        </Field>
        <Field label="網站">
          <input className={INPUT} value={f.website} onChange={(e) => set("website", e.target.value)} maxLength={200} />
        </Field>
        {f.kind !== "builder" && (
          <>
            <Field label={f.kind === "builder-vendor" ? (f.category === "建設 / 營造" ? "承攬起日" : "保固起日") : "合約起日"}>
              <input type="date" className={INPUT} value={f.contractStart} onChange={(e) => set("contractStart", e.target.value)} />
            </Field>
            <Field label={f.kind === "builder-vendor" ? (f.category === "建設 / 營造" ? "承攬迄日（更換日）" : "保固迄日") : "合約迄日"}>
              <input type="date" className={INPUT} value={f.contractEnd} onChange={(e) => set("contractEnd", e.target.value)} />
            </Field>
            <Field label="合約金額">
              <input className={INPUT} value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="例：月 32,000（含稅）" maxLength={60} />
            </Field>
          </>
        )}
      </div>
      <Field label={f.kind === "builder-vendor" ? "承攬項目（例：中庭景觀、電梯設備）" : "服務 / 承攬內容"}>
        <textarea className={`${INPUT} min-h-16`} value={f.scope} onChange={(e) => set("scope", e.target.value)} maxLength={1000} />
      </Field>
      <Field label={f.kind === "builder-vendor" && f.category === "建設 / 營造" ? "備註（更換原因、交接狀況）" : "備註"}>
        <textarea className={`${INPUT} min-h-14`} value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={2000} />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}

/* ── 聯絡人 / 人員結構 ── */

const emptyContact = (): Contact => ({ id: crypto.randomUUID(), name: "", title: "", dept: "", phone: "", email: "", reportsTo: "", note: "" });

export function ContactsEditor({ company }: { company: Vendor }) {
  const { setVendors } = useMgmt();
  const [editing, setEditing] = useState<Contact | null>(null);
  const [error, setError] = useState("");
  const contacts = company.contacts ?? [];

  async function saveAll(next: Contact[]) {
    try {
      const saved = await api<Vendor>(`/api/vendors/${company.id}`, { method: "PATCH", json: { contacts: next } });
      setVendors((all) => upsert(all, saved));
      setEditing(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // 依「上級」排成樹狀
  const rows: { c: Contact; depth: number }[] = [];
  const walk = (parent: string, depth: number) => {
    for (const c of contacts.filter((x) => (x.reportsTo || "") === parent && (parent || !contacts.some((y) => y.id === x.reportsTo)))) {
      rows.push({ c, depth });
      if (depth < 6) walk(c.id, depth + 1);
    }
  };
  walk("", 0);
  for (const c of contacts) if (!rows.some((r) => r.c.id === c.id)) rows.push({ c, depth: 0 });

  return (
    <div className="space-y-2">
      {rows.length === 0 && !editing && <p className="text-xs text-slate-500">尚無聯絡人</p>}
      <ul className="space-y-1">
        {rows.map(({ c, depth }) =>
          editing?.id === c.id ? null : (
            <li key={c.id} className="flex items-start gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 text-xs" style={{ marginLeft: depth * 16 }}>
              {depth > 0 && <span className="text-slate-600">└</span>}
              <span className="min-w-0 flex-1">
                <span className="text-slate-100">{c.name}</span>
                <span className="ml-1 text-slate-400">{[c.dept, c.title].filter(Boolean).join(" · ")}</span>
                <span className="block space-x-2 text-slate-400">
                  {tel(c.phone)}
                  {c.email && <span>{c.email}</span>}
                  {c.note && <span className="text-slate-500">{c.note}</span>}
                </span>
              </span>
              <button onClick={() => setEditing(c)} className="text-cyan-300 hover:underline">
                編輯
              </button>
            </li>
          ),
        )}
      </ul>
      {editing ? (
        <ContactForm
          contact={editing}
          others={contacts.filter((c) => c.id !== editing.id)}
          onCancel={() => setEditing(null)}
          onDelete={contacts.some((c) => c.id === editing.id) ? () => saveAll(contacts.filter((c) => c.id !== editing.id).map((c) => (c.reportsTo === editing.id ? { ...c, reportsTo: "" } : c))) : undefined}
          onSave={(c) => saveAll(contacts.some((x) => x.id === c.id) ? contacts.map((x) => (x.id === c.id ? c : x)) : [...contacts, c])}
        />
      ) : (
        <button onClick={() => setEditing(emptyContact())} className={`${BTN_OUTLINE} w-full`}>
          ＋ 新增聯絡人 / 人員
        </button>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function ContactForm({ contact, others, onSave, onCancel, onDelete }: { contact: Contact; others: Contact[]; onSave: (c: Contact) => void; onCancel: () => void; onDelete?: () => void }) {
  const [c, setC] = useState(contact);
  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => setC((x) => ({ ...x, [k]: v }));
  const inp = `${INPUT} py-1 text-xs`;
  return (
    <div className="space-y-2 rounded-md border border-cyan-400/40 bg-cyan-400/5 p-2">
      <div className="grid grid-cols-2 gap-2">
        <input className={inp} value={c.name} onChange={(e) => set("name", e.target.value)} placeholder="姓名 *" maxLength={40} autoFocus />
        <input className={inp} value={c.title} onChange={(e) => set("title", e.target.value)} placeholder="職稱（例：工務經理）" maxLength={40} />
        <input className={inp} value={c.dept} onChange={(e) => set("dept", e.target.value)} placeholder="部門（例：售後服務部）" maxLength={40} />
        <select className={inp} value={c.reportsTo} onChange={(e) => set("reportsTo", e.target.value)} aria-label="上級">
          <option value="">（最上層）</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              上級：{o.name} {o.title}
            </option>
          ))}
        </select>
        <input type="tel" className={inp} value={c.phone} onChange={(e) => set("phone", e.target.value)} placeholder="電話" maxLength={40} />
        <input type="email" className={inp} value={c.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" maxLength={80} />
      </div>
      <input className={inp} value={c.note} onChange={(e) => set("note", e.target.value)} placeholder="備註（負責項目、LINE ID…）" maxLength={500} />
      <div className="flex gap-2">
        {onDelete && (
          <button type="button" onClick={onDelete} className={`${BTN_DANGER} py-1 text-xs`}>
            刪除
          </button>
        )}
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className={`${BTN_GHOST} py-1 text-xs`}>
          取消
        </button>
        <button type="button" disabled={!c.name.trim()} onClick={() => onSave(c)} className={`${BTN_PRIMARY} py-1 text-xs`}>
          儲存
        </button>
      </div>
    </div>
  );
}

/* ── 維修 / 保養紀錄 ── */

export function RecordDialog({ company, record, onClose }: { company: Vendor; record?: ServiceRecord; onClose: () => void }) {
  const { setVendors } = useMgmt();
  const [f, setF] = useState({
    date: record?.date ?? TODAY(),
    type: record?.type ?? ("維修" as ServiceRecord["type"]),
    title: record?.title ?? "",
    description: record?.description ?? "",
    cost: record?.cost ?? "",
    handler: record?.handler ?? "",
    result: record?.result ?? "",
    location: record?.location as PlanRef | undefined,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    if (!f.title.trim()) return setError("請填寫項目");
    setBusy(true);
    try {
      const url = record ? `/api/vendors/${company.id}/records/${record.id}` : `/api/vendors/${company.id}/records`;
      const saved = await api<Vendor>(url, { method: record ? "PATCH" : "POST", json: { ...f, location: f.location ?? null } });
      setVendors((all) => upsert(all, saved));
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function remove() {
    if (!record || !confirm("刪除這筆紀錄？")) return;
    const saved = await api<Vendor>(`/api/vendors/${company.id}/records/${record.id}`, { method: "DELETE" });
    setVendors((all) => upsert(all, saved));
    onClose();
  }

  return (
    <Modal
      wide
      title={record ? "編輯紀錄" : "新增維修 / 保養紀錄"}
      subtitle={company.name}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {record && (
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
        <Field label="日期 *">
          <input type="date" className={INPUT} value={f.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="類型">
          <Select value={f.type} options={RECORD_TYPES} onChange={(v) => set("type", v)} />
        </Field>
        <Field label="項目 *" className="col-span-2">
          <input className={INPUT} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="例：A 棟 2 號電梯門機異音" maxLength={120} autoFocus={!record} />
        </Field>
        <Field label="費用">
          <input className={INPUT} value={f.cost} onChange={(e) => set("cost", e.target.value)} placeholder="例：3,500 / 保固內" maxLength={40} />
        </Field>
        <Field label="到場人員">
          <input className={INPUT} value={f.handler} onChange={(e) => set("handler", e.target.value)} maxLength={60} />
        </Field>
      </div>
      <div className="space-y-1">
        <span className="text-xs text-cyan-300">位置（會顯示在平面圖）</span>
        <PlanRefPicker value={f.location} onChange={(v) => set("location", v)} />
      </div>
      <Field label="狀況說明">
        <textarea className={`${INPUT} min-h-16`} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
      </Field>
      <Field label="處理結果">
        <textarea className={`${INPUT} min-h-14`} value={f.result} onChange={(e) => set("result", e.target.value)} maxLength={1000} />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}

/* ── 公司詳細面板 ── */

export function CompanyPanel({ company, onOpenCompany }: { company: Vendor; onOpenCompany?: (id: string) => void }) {
  const { building, vendors, todos, openTodo } = useMgmt();
  const [dialog, setDialog] = useState<"edit" | "vendor" | "contractor" | null>(null);
  const [record, setRecord] = useState<ServiceRecord | "new" | null>(null);
  const st = contractState(company);
  const contractors = contractorsOf(vendors, company.id);
  const partners = vendors.filter((v) => v.kind === "builder-vendor" && v.builderId === company.id && !contractors.includes(v));
  const builder = company.builderId ? vendors.find((v) => v.id === company.builderId) : undefined;
  const linked = todos.filter((t) => t.vendorId === company.id);
  const records = [...(company.records ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <>
        <dt className="text-slate-500">{label}</dt>
        <dd className="text-slate-200">{value}</dd>
      </>
    ) : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={company.kind} />
          <span className="text-[11px] text-slate-400">{company.category}</span>
          {st && <span className={`rounded border px-1.5 text-[11px] ${st.cls}`}>{st.text}</span>}
          <div className="flex-1" />
          <button onClick={() => setDialog("edit")} className="text-xs text-cyan-300 hover:underline">
            編輯資料
          </button>
        </div>
        <h3 className="mt-1 text-lg font-semibold text-cyan-50">{company.name}</h3>
        <dl className="mt-2 grid grid-cols-[5.5em_1fr] gap-x-2 gap-y-1 text-xs">
          {row("統一編號", company.taxId && <span className="font-mono">{company.taxId}</span>)}
          {row("負責人", company.representative && <>{company.representative} {tel(company.representativePhone)}</>)}
          {row("起造人", company.developer && <>{company.developer} {tel(company.developerPhone)}</>)}
          {row("所屬建商", builder && <button onClick={() => onOpenCompany?.(builder.id)} className="text-cyan-300 hover:underline">{builder.name}</button>)}
          {row("聯絡窗口", company.contact)}
          {row("公司電話", tel(company.phone))}
          {row("Email", company.email)}
          {row("地址", company.address)}
          {row("網站", company.website && <a href={/^https?:/.test(company.website) ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">{company.website}</a>)}
          {row(company.kind === "builder-vendor" ? "保固期間" : "合約期間", (company.contractStart || company.contractEnd) && `${fmtDate(company.contractStart)} → ${fmtDate(company.contractEnd)}`)}
          {row("合約金額", company.amount)}
        </dl>
        {company.scope && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-300">{company.scope}</p>}
        {company.note && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{company.note}</p>}
      </div>

      <section>
        <h4 className="mb-2 text-sm font-semibold text-cyan-100">{company.kind === "builder" ? "人員結構" : "聯絡人"}</h4>
        <ContactsEditor company={company} />
      </section>

      {company.kind === "builder" && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-cyan-100">營造廠異動紀錄（{contractors.length}）</h4>
            <button onClick={() => setDialog("contractor")} className="text-xs text-cyan-300 hover:underline">
              ＋ 新增營造廠
            </button>
          </div>
          <ol className="space-y-2 border-l border-orange-400/40 pl-3">
            {contractors.map((c) => (
              <li key={c.id} className="relative">
                <span className={`absolute -left-[17px] top-1.5 h-2 w-2 rounded-full ${isReplaced(c) ? "bg-slate-500" : "bg-orange-400"}`} />
                <button onClick={() => onOpenCompany?.(c.id)} className="w-full text-left">
                  <p className="text-xs">
                    <span className={`mr-1.5 rounded px-1 text-[10px] ${isReplaced(c) ? "bg-white/5 text-slate-400" : "bg-orange-500/20 text-orange-200"}`}>{isReplaced(c) ? "已更換" : "現任"}</span>
                    <span className="text-slate-100">{c.name}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    承攬 {fmtDate(c.contractStart)} → {c.contractEnd ? fmtDate(c.contractEnd) : "迄今"}
                    {c.note && ` · ${c.note}`}
                  </p>
                </button>
              </li>
            ))}
            {contractors.length === 0 && <li className="text-xs text-slate-500">尚未登錄營造廠。換過營造廠時各新增一筆，填承攬起迄日與更換原因。</li>}
          </ol>
        </section>
      )}

      {company.kind === "builder" && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-cyan-100">當時配合廠商（{partners.length}）</h4>
            <button onClick={() => setDialog("vendor")} className="text-xs text-cyan-300 hover:underline">
              ＋ 新增
            </button>
          </div>
          <ul className="space-y-1">
            {partners.map((p) => (
              <li key={p.id}>
                <button onClick={() => onOpenCompany?.(p.id)} className="flex w-full items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 text-left text-xs hover:bg-cyan-400/5">
                  <span className="text-slate-400">{p.category}</span>
                  <span className="flex-1 text-slate-100">{p.name}</span>
                  {p.phone && <span className="text-cyan-300">{p.phone}</span>}
                </button>
              </li>
            ))}
            {partners.length === 0 && <li className="text-xs text-slate-500">例如園藝景觀、機電、電梯、門窗、防水等承攬廠商</li>}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-cyan-100">維修 / 保養紀錄（{records.length}）</h4>
          <button onClick={() => setRecord("new")} className="text-xs text-cyan-300 hover:underline">
            ＋ 新增紀錄
          </button>
        </div>
        <ol className="space-y-2 border-l border-cyan-500/30 pl-3">
          {records.map((r) => (
            <li key={r.id} className="relative">
              <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full border border-cyan-300 bg-[#030d1c]" />
              <button onClick={() => setRecord(r)} className="w-full text-left">
                <p className="text-xs">
                  <span className="font-mono text-cyan-200">{fmtDate(r.date)}</span>
                  <span className="ml-1.5 rounded bg-white/5 px-1 text-[10px] text-slate-300">{r.type}</span>
                  <span className="ml-1.5 text-slate-100">{r.title}</span>
                </p>
                <p className="text-[11px] text-slate-400">
                  {[r.handler && `到場：${r.handler}`, r.cost && `費用：${r.cost}`, r.result].filter(Boolean).join(" · ")}
                </p>
              </button>
              {r.location && (
                <a href={planLink(building.id, r.location)} className="text-[11px] text-cyan-300 hover:underline">
                  📍 {r.location.label}
                </a>
              )}
            </li>
          ))}
          {records.length === 0 && <li className="text-xs text-slate-500">尚無紀錄</li>}
        </ol>
      </section>

      {linked.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-cyan-100">相關待辦</h4>
          <ul className="space-y-1">
            {linked.map((t) => (
              <li key={t.id}>
                <button onClick={() => openTodo(t)} className="flex w-full items-center gap-2 text-left text-xs hover:text-cyan-200">
                  <StatusBadge status={t.status} />
                  <span className="truncate text-slate-200">{t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialog === "edit" && <CompanyDialog company={company} onClose={() => setDialog(null)} />}
      {dialog === "contractor" && <CompanyDialog preset={{ kind: "builder-vendor", builderId: company.id, category: "建設 / 營造" }} onClose={() => setDialog(null)} onSaved={(v) => onOpenCompany?.(v.id)} />}
      {dialog === "vendor" && <CompanyDialog preset={{ kind: "builder-vendor", builderId: company.id }} onClose={() => setDialog(null)} onSaved={(v) => onOpenCompany?.(v.id)} />}
      {record && <RecordDialog company={company} record={record === "new" ? undefined : record} onClose={() => setRecord(null)} />}
    </div>
  );
}
