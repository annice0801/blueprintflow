"use client";

import { useState } from "react";
import { GROUP_COLOR, isOverdue, ROLE_DUTIES, roleOf, termAt, type Contact, type RoleId, type Term, type TermKind, type TermMember, type Vendor } from "@/lib/mgmt";
import type { FlowEdge } from "@/lib/sops";
import FlowGraph, { type GraphNode } from "../FlowGraph";
import { api, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, Field, INPUT, Modal } from "../ui";
import { fmtDate, StatusBadge, TODAY, upsert, useMgmt } from "./common";
import { CompanyDialog, CompanyPanel, contractorsOf, isReplaced, KIND_COLOR } from "./company";
import { AttendanceMatrix, attendanceSummary, meetingsInTerm, STATUS_MARK, statusOf, TermDialog } from "./terms";

const COMMITTEE_ROLES: RoleId[] = ["chair", "vice", "finance", "audit", "member1", "member2", "member3"];
const tel = (n: string) => (n ? <a href={`tel:${n.replace(/[^\d+]/g, "")}`} className="text-cyan-300 hover:underline">{n}</a> : null);

type Tree = { nodes: GraphNode[]; edges: FlowEdge[]; children: Map<string, string[]> };

export default function OrgTab() {
  const { building, terms, setTerms, vendors, todos, meetings, regulations, shifts, goTab } = useMgmt();
  const today = TODAY();
  const [termIds, setTermIds] = useState<Record<TermKind, string>>({ committee: "", property: "" });
  const pickTerm = (kind: TermKind) => terms.find((t) => t.id === termIds[kind] && t.kind === kind) ?? termAt(terms, kind, today);
  const committee = pickTerm("committee");
  const property = pickTerm("property");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["assembly"]));
  const [active, setActive] = useState<string>("assembly");
  const [dialog, setDialog] = useState<{ type: "term"; kind: TermKind; term?: Term } | { type: "company"; preset: Partial<Vendor> } | { type: "member"; roleId: RoleId } | null>(null);

  /* ── 建立整棵樹（只顯示已展開節點的子節點） ── */
  const tree: Tree = { nodes: [], edges: [], children: new Map() };
  const add = (n: GraphNode, parent?: string, label?: string) => {
    tree.nodes.push(n);
    if (parent) {
      tree.edges.push({ from: parent, to: n.id, label });
      tree.children.set(parent, [...(tree.children.get(parent) ?? []), n.id]);
    }
  };
  const openTodos = (r: RoleId) => todos.filter((t) => t.assignees.includes(r) && t.status !== "已完成" && t.status !== "暫緩").length;

  add({ id: "assembly", label: "區分所有權人會議", kind: "start", sub: "社區最高意思機關" });
  add({ id: "committee", label: "管理委員會", kind: "step", accent: GROUP_COLOR.管委會, sub: committee ? `${committee.name} · ${committee.members.length} 人` : "尚未建立屆次" }, "assembly", "選任");
  add({ id: "property", label: "物業管理公司", kind: "step", accent: GROUP_COLOR.物業, sub: (property && (vendors.find((v) => v.id === property.companyId)?.name ?? property.name)) || "尚未建立" }, "assembly", "委任");
  const builders = vendors.filter((v) => v.kind === "builder");
  add({ id: "builders", label: "建商", kind: "step", accent: GROUP_COLOR.建商, sub: builders.length ? builders.map((b) => b.name).join("、") : "尚未建立" }, "assembly", "點交 / 保固");
  const own = vendors.filter((v) => v.kind === "vendor");
  add({ id: "vendors", label: "外包廠商", kind: "step", accent: GROUP_COLOR.外包廠商, sub: `自行發包 · ${own.length} 家` }, "assembly", "發包");

  // 管委會成員
  const cMeetings = committee ? meetingsInTerm(meetings, committee) : [];
  const seated = COMMITTEE_ROLES.map((r) => committee?.members.find((m) => m.roleId === r)).filter(Boolean) as TermMember[];
  const extra = committee?.members.filter((m) => !seated.includes(m)) ?? [];
  for (const r of COMMITTEE_ROLES) {
    const m = committee?.members.find((x) => x.roleId === r);
    const s = m ? attendanceSummary(cMeetings, m.name) : null;
    const flags = [m?.name || "（未填）", s && s.缺席 ? `缺席 ${s.缺席}` : "", openTodos(r) ? `待辦 ${openTodos(r)}` : ""].filter(Boolean).join(" · ");
    add({ id: m ? `m:${m.id}` : `r:${r}`, label: roleOf(r).label, kind: "step", accent: GROUP_COLOR.管委會, sub: flags }, "committee");
  }
  for (const m of extra) add({ id: `m:${m.id}`, label: roleOf(m.roleId).label, kind: "step", accent: GROUP_COLOR.管委會, sub: `${m.name}${m.end ? "（已卸任）" : ""}` }, "committee");

  // 物業：區經理、財務顧問、法律顧問 → 區經理底下總幹事 → 秘書、保全組、清潔組
  const staff = property?.members ?? [];
  const todayShifts = shifts.filter((x) => x.date === today);
  const person = (m: TermMember, parent: string) => {
    const duty = todayShifts.find((x) => x.name === m.name);
    add({ id: `p:${m.id}`, label: m.name || roleOf(m.roleId).label, kind: "step", accent: GROUP_COLOR.物業, sub: [roleOf(m.roleId).short, duty ? `今日 ${duty.code} ${duty.start}–${duty.end}` : m.note].filter(Boolean).join(" · ") }, parent);
  };
  const single = (r: RoleId, parent: string) => {
    const list = staff.filter((m) => m.roleId === r);
    if (!list.length) add({ id: `r:${r}`, label: roleOf(r).label, kind: "step", accent: GROUP_COLOR.物業, sub: "（未填）" }, parent);
    for (const m of list) add({ id: `p:${m.id}`, label: roleOf(r).label, kind: "step", accent: GROUP_COLOR.物業, sub: [m.name, m.note].filter(Boolean).join(" · ") }, parent);
    return list.length ? `p:${list[0].id}` : `r:${r}`;
  };
  const amId = single("area_manager", "property");
  single("finance_advisor", "property");
  single("legal_advisor", "property");
  const gmId = single("gm", amId);
  single("secretary", gmId);
  for (const r of ["guard", "cleaner"] as RoleId[]) {
    const list = staff.filter((m) => m.roleId === r);
    const onToday = todayShifts.filter((x) => x.roleId === r).map((x) => x.name);
    add({ id: `grp:${r}`, label: roleOf(r).label, kind: "step", accent: GROUP_COLOR.物業, sub: `${list.length} 人${onToday.length ? ` · 今日 ${onToday.join("、")}` : ""}` }, gmId);
    for (const m of list) person(m, `grp:${r}`);
    add({ id: `addm:${r}`, label: `＋ 新增${roleOf(r).label}`, kind: "end" }, `grp:${r}`);
  }

  // 公司底下：負責人、起造人、人員結構、配合廠商
  const addContacts = (c: Vendor, parent: string) => {
    const list = c.contacts ?? [];
    const walk = (p: string, node: string) => {
      for (const x of list.filter((y) => (y.reportsTo || "") === p || (!p && y.reportsTo && !list.some((z) => z.id === y.reportsTo)))) {
        const id = `ct:${c.id}:${x.id}`;
        add({ id, label: x.name, kind: "step", accent: KIND_COLOR[c.kind], sub: [x.dept, x.title].filter(Boolean).join(" · ") || x.phone }, node);
        walk(x.id, id);
      }
    };
    walk("", parent);
  };
  const addCompany = (c: Vendor, parent: string) => {
    const id = `c:${c.id}`;
    add({ id, label: c.name, kind: "step", accent: KIND_COLOR[c.kind], sub: c.kind === "builder" ? c.representative && `負責人 ${c.representative}` : c.category }, parent);
    if (c.representative) add({ id: `rep:${c.id}`, label: `負責人 ${c.representative}`, kind: "step", accent: KIND_COLOR[c.kind], sub: c.representativePhone }, id);
    if (c.developer) add({ id: `dev:${c.id}`, label: `起造人 ${c.developer}`, kind: "step", accent: KIND_COLOR[c.kind], sub: c.developerPhone }, id);
    addContacts(c, id);
    if (c.kind === "builder") {
      const contractors = contractorsOf(vendors, c.id);
      add({ id: `contractors:${c.id}`, label: "營造廠", kind: "step", accent: KIND_COLOR.builder, sub: contractors.length ? `${contractors.filter((x) => isReplaced(x)).length ? `換過 ${contractors.filter((x) => isReplaced(x)).length} 次 · ` : ""}現任 ${contractors.filter((x) => !isReplaced(x)).map((x) => x.name).join("、") || "—"}` : "尚未登錄" }, id);
      for (const k of contractors) {
        add({ id: `c:${k.id}`, label: k.name, kind: isReplaced(k) ? "end" : "step", accent: KIND_COLOR.builder, sub: `${isReplaced(k) ? "已更換" : "現任"} · ${k.contractStart ? k.contractStart.slice(0, 7) : "?"} → ${k.contractEnd ? k.contractEnd.slice(0, 7) : "迄今"}` }, `contractors:${c.id}`);
        addContacts(k, `c:${k.id}`);
      }
      add({ id: `add:builder-vendor:${c.id}:contractor`, label: "＋ 新增營造廠", kind: "end" }, `contractors:${c.id}`);
      const partners = vendors.filter((v) => v.kind === "builder-vendor" && v.builderId === c.id && !contractors.includes(v));
      add({ id: `partners:${c.id}`, label: "當時配合廠商", kind: "step", accent: KIND_COLOR["builder-vendor"], sub: `${partners.length} 家` }, id);
      for (const p of partners) addCompany(p, `partners:${c.id}`);
      add({ id: `add:builder-vendor:${c.id}`, label: "＋ 新增配合廠商", kind: "end" }, `partners:${c.id}`);
    }
  };
  for (const b of builders) addCompany(b, "builders");
  const orphans = vendors.filter((v) => v.kind === "builder-vendor" && !builders.some((b) => b.id === v.builderId));
  for (const o of orphans) addCompany(o, "builders");
  // 社區只會有一家建商：已建立後不再顯示新增
  if (!builders.length) add({ id: "add:builder", label: "＋ 新增建商", kind: "end" }, "builders");
  for (const v of own) addCompany(v, "vendors");
  add({ id: "add:vendor", label: "＋ 新增廠商", kind: "end" }, "vendors");

  // 只保留已展開路徑上的節點
  const visible = new Set<string>(["assembly"]);
  const stack = ["assembly"];
  while (stack.length) {
    const n = stack.pop()!;
    if (!expanded.has(n)) continue;
    for (const c of tree.children.get(n) ?? []) {
      visible.add(c);
      stack.push(c);
    }
  }
  const nodes = tree.nodes.filter((n) => visible.has(n.id));
  const edges = tree.edges.filter((e) => visible.has(e.from) && visible.has(e.to));

  function select(id: string) {
    if (id.startsWith("addm:")) return setDialog({ type: "member", roleId: id.slice(5) as RoleId });
    if (id.startsWith("add:")) {
      const [, kind, builderId, sub] = id.split(":");
      return setDialog({ type: "company", preset: { kind: kind as Vendor["kind"], ...(builderId && { builderId }), ...((kind === "builder" || sub === "contractor") && { category: "建設 / 營造" }) } });
    }
    const hasKids = (tree.children.get(id) ?? []).length > 0;
    setExpanded((s) => {
      const next = new Set(s);
      const drop = (n: string) => {
        next.delete(n);
        (tree.children.get(n) ?? []).forEach(drop);
      };
      if (!next.has(id)) {
        // 手風琴：展開時收合同層其他單位，畫面保持聚焦
        const parent = tree.edges.find((e) => e.to === id)?.from;
        for (const sib of parent ? tree.children.get(parent) ?? [] : []) if (sib !== id) drop(sib);
        next.add(id);
      } else if (active === id && id !== "assembly") drop(id); // 再點一次收合（含子孫）
      return hasKids ? next : s;
    });
    setActive(id);
  }

  const termBar = (kind: TermKind, current?: Term) => (
    <div className="flex flex-wrap items-center gap-2">
      <select className="rounded-md border border-cyan-500/40 bg-slate-950/60 px-2 py-1 text-xs text-cyan-50" value={current?.id ?? ""} onChange={(e) => setTermIds((x) => ({ ...x, [kind]: e.target.value }))} aria-label="屆次">
        {terms.filter((t) => t.kind === kind).length === 0 && <option value="">尚無屆次</option>}
        {terms
          .filter((t) => t.kind === kind)
          .sort((a, b) => b.start.localeCompare(a.start))
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}（{fmtDate(t.start)} → {t.end ? fmtDate(t.end) : "迄今"}）
            </option>
          ))}
      </select>
      {current && (
        <button onClick={() => setDialog({ type: "term", kind, term: current })} className="text-xs text-cyan-300 hover:underline">
          編輯
        </button>
      )}
      <button onClick={() => setDialog({ type: "term", kind })} className="text-xs text-cyan-300 hover:underline">
        ＋ 新增{kind === "committee" ? "屆次" : "合約期"}
      </button>
    </div>
  );

  /* ── 右側面板 ── */
  const panel = (() => {
    if (active === "assembly")
      return (
        <>
          <Head group="組織" title="區分所有權人會議" desc="社區最高意思機關：選任管理委員會、議決規約與重大事項。點下方單位往下展開。" />
          <RegList filter={(r) => r.category === "社區規約"} title="社區規約" />
          <MeetingList list={meetings.filter((m) => m.type === "區分所有權人會議")} title="區權會會議紀錄" />
        </>
      );
    if (active === "committee")
      return (
        <>
          <Head group="管委會" title="管理委員會" desc="執行區大決議、監督物業與廠商。可切換不同屆次查看當屆成員與紀錄。" />
          {termBar("committee", committee)}
          {committee ? (
            <>
              <section>
                <h4 className="mb-1.5 text-sm font-semibold text-cyan-100">出缺席（{cMeetings.length} 次會議）</h4>
                <AttendanceMatrix term={committee} />
              </section>
              <MeetingList list={cMeetings} title="本屆會議紀錄" />
              <RegList filter={(r) => r.termId === committee.id || (!!r.meetingId && cMeetings.some((m) => m.id === r.meetingId))} title="本屆通過的規範" />
            </>
          ) : (
            <EmptyTerm onAdd={() => setDialog({ type: "term", kind: "committee" })} kind="committee" />
          )}
        </>
      );
    if (active === "property") {
      const company = property?.companyId ? vendors.find((v) => v.id === property.companyId) : undefined;
      return (
        <>
          <Head group="物業" title="物業管理公司" desc="受管委會委任，派駐總幹事與現場人員。合約到期換約時新增一期，舊人員紀錄會保留。" />
          {termBar("property", property)}
          {property ? (
            <>
              {company ? <CompanyPanel company={company} onOpenCompany={(id) => select(`c:${id}`)} /> : <p className="text-xs text-slate-500">本期尚未連結物業公司資料，請按「編輯」選擇。</p>}
              <MeetingList list={meetingsInTerm(meetings, property).filter((m) => m.attendance?.some((a) => staff.some((s) => s.name === a.name)))} title="人員列席的會議" />
            </>
          ) : (
            <EmptyTerm onAdd={() => setDialog({ type: "term", kind: "property" })} kind="property" />
          )}
        </>
      );
    }
    if (active === "builders" || active === "vendors") {
      const list = active === "builders" ? [...builders, ...orphans] : own;
      return (
        <>
          <Head group={active === "builders" ? "建商" : "外包廠商"} title={active === "builders" ? "建商" : "外包廠商（自行發包）"} desc={active === "builders" ? "建設公司、營造廠與當時配合的承攬廠商；點公司方塊展開人員結構與配合廠商。" : "管委會自行發包的廠商，可記錄聯絡人與維修保養紀錄。"} />
          <ul className="space-y-1.5">
            {list.map((c) => (
              <li key={c.id}>
                <button onClick={() => select(`c:${c.id}`)} className="flex w-full items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 text-left text-sm hover:bg-cyan-400/5">
                  <span className="flex-1 text-slate-100">{c.name}</span>
                  <span className="text-xs text-slate-400">{c.category}</span>
                </button>
              </li>
            ))}
          </ul>
          {!(active === "builders" && builders.length) && (
            <button onClick={() => select(active === "builders" ? "add:builder" : "add:vendor")} className={`${BTN_OUTLINE} w-full`}>
              ＋ 新增{active === "builders" ? "建商" : "廠商"}
            </button>
          )}
        </>
      );
    }
    const [kind, a, b] = active.split(":");
    if (kind === "contractors") {
      const c = vendors.find((v) => v.id === a);
      if (!c) return null;
      return (
        <>
          <Head group="建商" title={`${c.name} · 營造廠異動紀錄`} desc="依承攬期間排序；承攬迄日已過的標示為「已更換」。" />
          <ul className="space-y-1.5">
            {contractorsOf(vendors, c.id).map((k) => (
              <li key={k.id}>
                <button onClick={() => select(`c:${k.id}`)} className="w-full rounded-md bg-white/[0.03] px-2 py-1.5 text-left text-xs hover:bg-cyan-400/5">
                  <span className={isReplaced(k) ? "text-slate-400" : "text-orange-200"}>{isReplaced(k) ? "已更換" : "現任"}</span>
                  <span className="ml-2 text-slate-100">{k.name}</span>
                  <span className="block text-slate-500">
                    {fmtDate(k.contractStart)} → {k.contractEnd ? fmtDate(k.contractEnd) : "迄今"} {k.note}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => select(`add:builder-vendor:${c.id}:contractor`)} className={`${BTN_OUTLINE} w-full`}>
            ＋ 新增營造廠
          </button>
        </>
      );
    }
    if (kind === "c" || kind === "rep" || kind === "dev" || kind === "partners") {
      const c = vendors.find((v) => v.id === a);
      if (!c) return null;
      if (kind === "partners")
        return (
          <>
            <Head group="建商" title={`${c.name} · 當時配合廠商`} />
            <button onClick={() => select(`add:builder-vendor:${c.id}`)} className={`${BTN_OUTLINE} w-full`}>
              ＋ 新增配合廠商
            </button>
          </>
        );
      if (kind === "rep" || kind === "dev")
        return (
          <>
            <Head group={c.name} title={kind === "rep" ? `負責人 ${c.representative}` : `起造人 ${c.developer}`} />
            <p className="text-sm">{tel(kind === "rep" ? c.representativePhone : c.developerPhone) ?? <span className="text-slate-500">未填電話</span>}</p>
            <button onClick={() => select(`c:${c.id}`)} className="text-xs text-cyan-300 hover:underline">
              查看公司資料 →
            </button>
          </>
        );
      return <CompanyPanel key={c.id} company={c} onOpenCompany={(id) => select(`c:${id}`)} />;
    }
    if (kind === "ct") {
      const c = vendors.find((v) => v.id === a);
      const x = c?.contacts.find((y) => y.id === b);
      if (!c || !x) return null;
      return <ContactCard company={c} contact={x} onCompany={() => select(`c:${c.id}`)} />;
    }
    if (kind === "grp") {
      const r = a as RoleId;
      const list = staff.filter((m) => m.roleId === r);
      return (
        <>
          <Head group="物業" title={`${roleOf(r).label}（${list.length} 人）`} desc="點人名查看職責與聯絡方式；班表可在「現場 → 班表」匯入 PDF / Excel。" />
          <Duties role={r} />
          <ul className="space-y-1">
            {list.map((m) => {
              const duty = todayShifts.find((x) => x.name === m.name);
              return (
                <li key={m.id}>
                  <button onClick={() => select(`p:${m.id}`)} className="flex w-full items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 text-left text-xs hover:bg-cyan-400/5">
                    <span className="text-slate-100">{m.name}</span>
                    <span className="text-slate-500">{m.note}</span>
                    <div className="flex-1" />
                    {duty ? <span className="text-emerald-300">今日 {duty.code} {duty.start}–{duty.end}</span> : <span className="text-slate-600">今日未排班</span>}
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="text-xs text-slate-500">尚無人員</li>}
          </ul>
          <div className="flex gap-2">
            <button onClick={() => setDialog({ type: "member", roleId: r })} className={`${BTN_OUTLINE} flex-1`}>
              ＋ 新增{roleOf(r).label}
            </button>
            <button onClick={() => goTab("field")} className={`${BTN_OUTLINE} flex-1`}>
              班表 / 匯入
            </button>
          </div>
        </>
      );
    }
    if (kind === "m" || kind === "p") {
      const term = kind === "m" ? committee : property;
      const m = term?.members.find((x) => x.id === a);
      if (!term || !m) return null;
      return <MemberPanel term={term} member={m} onEdit={() => setDialog({ type: "term", kind: term.kind, term })} />;
    }
    if (kind === "r") {
      const r = a as RoleId;
      const k: TermKind = roleOf(r).group === "管委會" ? "committee" : "property";
      const term = k === "committee" ? committee : property;
      return (
        <>
          <Head group={roleOf(r).group} title={roleOf(r).label} desc="這個職務尚未填寫擔任者。" />
          <Duties role={r} />
          <button onClick={() => setDialog({ type: "term", kind: k, term })} className={`${BTN_OUTLINE} w-full`}>
            {term ? "編輯成員名單" : `新增${k === "committee" ? "屆次" : "合約期"}`}
          </button>
        </>
      );
    }
    return null;
  })();

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-h-0 flex-col rounded-lg border border-cyan-500/20 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>點方塊往下展開結構，再點一次收合；右側顯示職責、出缺席與追蹤事項。</span>
          <div className="flex-1" />
          <button onClick={() => setExpanded(new Set(tree.nodes.map((n) => n.id)))} className="text-cyan-300 hover:underline">
            全部展開
          </button>
          <button
            onClick={() => {
              setExpanded(new Set(["assembly"]));
              setActive("assembly");
            }}
            className="text-cyan-300 hover:underline"
          >
            收合
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto">
          <FlowGraph nodes={nodes} edges={edges} active={active} onSelect={select} nodeWidth={150} />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-300">
          {Object.entries(GROUP_COLOR).map(([g, c]) => (
            <span key={g} className="flex items-center gap-1">
              <span className="h-2.5 w-1 rounded" style={{ background: c }} />
              {g}
            </span>
          ))}
        </div>
      </div>

      <aside className="min-h-0 space-y-4 overflow-y-auto rounded-lg border border-cyan-500/20 p-4">{panel}</aside>

      {dialog?.type === "member" && (
        <AddMemberDialog
          roleId={dialog.roleId}
          onClose={() => setDialog(null)}
          onSave={async (m) => {
            const next = property ? { ...property, members: [...property.members, m] } : null;
            const saved = next
              ? await api<Term>(`/api/terms/${property!.id}`, { method: "PATCH", json: { members: next.members } })
              : await api<Term>("/api/terms", { method: "POST", json: { buildingId: building.id, kind: "property", name: "現任物業團隊", start: today, note: "請連結物業公司", members: [m] } });
            setTerms((all) => upsert(all, saved));
            setTermIds((x) => ({ ...x, property: saved.id }));
            setExpanded((x) => new Set([...x, "property", amId, gmId, ...(["guard", "cleaner"].includes(m.roleId) ? [`grp:${m.roleId}`] : [])]));
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "term" && <TermDialog kind={dialog.kind} term={dialog.term} onClose={() => setDialog(null)} onSaved={(t) => setTermIds((x) => ({ ...x, [t.kind]: t.id }))} />}
      {dialog?.type === "company" && (
        <CompanyDialog
          preset={dialog.preset}
          onClose={() => setDialog(null)}
          onSaved={(v) => {
            setExpanded((s) => new Set([...s, v.kind === "vendor" ? "vendors" : "builders", ...(v.builderId ? [`c:${v.builderId}`, v.category === "建設 / 營造" ? `contractors:${v.builderId}` : `partners:${v.builderId}`] : [])]));
            setActive(`c:${v.id}`);
          }}
        />
      )}
    </div>
  );

  function MeetingList({ list, title }: { list: typeof meetings; title: string }) {
    return (
      <section>
        <h4 className="mb-1.5 text-sm font-semibold text-cyan-100">
          {title}（{list.length}）
        </h4>
        <ul className="space-y-1">
          {list.slice(-8).reverse().map((m) => (
            <li key={m.id}>
              <button onClick={() => goTab("meetings", { meeting: m.id })} className="w-full truncate text-left text-xs text-slate-300 hover:text-cyan-200">
                <span className="font-mono text-cyan-300">{fmtDate(m.date)}</span> {m.title}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="text-xs text-slate-500">無</li>}
        </ul>
      </section>
    );
  }

  function RegList({ filter, title }: { filter: (r: (typeof regulations)[number]) => boolean; title: string }) {
    const list = regulations.filter(filter);
    return (
      <section>
        <h4 className="mb-1.5 text-sm font-semibold text-cyan-100">
          {title}（{list.length}）
        </h4>
        <ul className="space-y-1">
          {list.map((r) => (
            <li key={r.id}>
              <button onClick={() => goTab("regulations", { reg: r.id })} className="w-full truncate text-left text-xs text-slate-300 hover:text-cyan-200">
                📜 {r.title} <span className="text-slate-500">{r.version} · {r.status}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="text-xs text-slate-500">無</li>}
        </ul>
      </section>
    );
  }
}

function Head({ group, title, desc }: { group: string; title: string; desc?: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: GROUP_COLOR[group as keyof typeof GROUP_COLOR] ?? "#8fb3cc" }}>
        {group}
      </p>
      <h3 className="text-lg font-semibold text-cyan-50">{title}</h3>
      {desc && <p className="mt-1 text-xs text-slate-400">{desc}</p>}
    </div>
  );
}

function EmptyTerm({ kind, onAdd }: { kind: TermKind; onAdd: () => void }) {
  return (
    <div className="rounded-md border border-dashed border-cyan-500/40 p-4 text-center text-xs text-slate-400">
      {kind === "committee" ? "尚未建立管委會屆次。匯入會議紀錄時勾選「套用職務名單」會自動建立，或手動新增。" : "尚未建立物業合約期。"}
      <button onClick={onAdd} className={`${BTN_OUTLINE} mt-2 w-full`}>
        ＋ 新增{kind === "committee" ? "屆次" : "合約期"}
      </button>
    </div>
  );
}

function Duties({ role, note }: { role: RoleId; note?: string }) {
  const list = ROLE_DUTIES[role] ?? [];
  return (
    <section>
      <h4 className="mb-1.5 text-sm font-semibold text-cyan-100">職責</h4>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-300">
        {list.map((d) => (
          <li key={d}>{d}</li>
        ))}
        {note && <li className="text-cyan-100">{note}</li>}
      </ul>
    </section>
  );
}

function MemberPanel({ term, member, onEdit }: { term: Term; member: TermMember; onEdit: () => void }) {
  const { meetings, todos, openTodo } = useMgmt();
  const list = meetingsInTerm(meetings, term);
  const s = attendanceSummary(list, member.name);
  const mine = todos.filter((t) => t.assignees.includes(member.roleId));
  const open = mine.filter((t) => t.status !== "已完成");
  const isCommittee = term.kind === "committee";
  const rows = list.map((m) => ({ m, st: statusOf(m, member.name) })).filter((x) => isCommittee || (x.st && x.st !== "未列"));

  return (
    <>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs" style={{ color: GROUP_COLOR[roleOf(member.roleId).group] }}>
            {term.name} · {roleOf(member.roleId).group}
          </p>
          <div className="flex-1" />
          <button onClick={onEdit} className="text-xs text-cyan-300 hover:underline">
            編輯名單
          </button>
        </div>
        <h3 className="text-lg font-semibold text-cyan-50">
          {roleOf(member.roleId).label} {member.name}
        </h3>
        <p className="mt-0.5 space-x-2 text-xs text-slate-400">
          {tel(member.phone)}
          {member.email && <span>{member.email}</span>}
          {(member.start || member.end) && (
            <span>
              任期 {fmtDate(member.start)} → {fmtDate(member.end)}
            </span>
          )}
        </p>
      </div>
      <Duties role={member.roleId} note={member.note} />
      {isCommittee && (
        <section>
          <h4 className="mb-1.5 text-sm font-semibold text-cyan-100">出缺席</h4>
          <div className="mb-2 grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["出席", s.出席, "text-emerald-300"],
                ["請假", s.請假, "text-amber-200"],
                ["缺席", s.缺席, "text-rose-300"],
              ] as const
            ).map(([l, n, c]) => (
              <div key={l} className="rounded-md bg-white/5 py-1.5">
                <p className={`font-mono text-xl ${c}`}>{n}</p>
                <p className="text-[11px] text-slate-400">{l}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {rows.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {rows.map(({ m, st }) => (
            <li key={m.id} className="flex items-center gap-2">
              <span className="font-mono text-slate-400">{fmtDate(m.date)}</span>
              <span className={`w-14 ${st ? STATUS_MARK[st].cls : "text-slate-600"}`}>{st ? STATUS_MARK[st].label.replace("（視為缺席）", "") : "無資料"}</span>
              <span className="truncate text-slate-400">{m.title}</span>
            </li>
          ))}
        </ul>
      )}
      <section>
        <h4 className="mb-1.5 text-sm font-semibold text-cyan-100">
          需追蹤的事項（未完成 {open.length} / 共 {mine.length}）
        </h4>
        <ul className="space-y-1">
          {open.map((t) => (
            <li key={t.id}>
              <button onClick={() => openTodo(t)} className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left hover:bg-cyan-400/5">
                <StatusBadge status={t.status} />
                <span className="min-w-0 flex-1 text-xs text-slate-200">
                  {t.title}
                  {t.due && <span className={`ml-1 ${isOverdue(t) ? "text-rose-300" : "text-slate-500"}`}>（{fmtDate(t.due)}{isOverdue(t) ? " 逾期" : ""}）</span>}
                </span>
              </button>
            </li>
          ))}
          {open.length === 0 && <li className="text-xs text-slate-500">目前沒有未完成的事項</li>}
        </ul>
        <button onClick={() => openTodo("new", { assignees: [member.roleId] })} className={`${BTN_OUTLINE} mt-2 w-full`}>
          ＋ 指派新待辦
        </button>
      </section>
    </>
  );
}

function ContactCard({ company, contact, onCompany }: { company: Vendor; contact: Contact; onCompany: () => void }) {
  const boss = company.contacts.find((c) => c.id === contact.reportsTo);
  const team = company.contacts.filter((c) => c.reportsTo === contact.id);
  return (
    <>
      <Head group={company.name} title={contact.name} desc={[contact.dept, contact.title].filter(Boolean).join(" · ")} />
      <dl className="grid grid-cols-[4.5em_1fr] gap-x-2 gap-y-1 text-xs">
        {contact.phone && (
          <>
            <dt className="text-slate-500">電話</dt>
            <dd>{tel(contact.phone)}</dd>
          </>
        )}
        {contact.email && (
          <>
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-200">{contact.email}</dd>
          </>
        )}
        {boss && (
          <>
            <dt className="text-slate-500">上級</dt>
            <dd className="text-slate-200">
              {boss.name} {boss.title}
            </dd>
          </>
        )}
        {team.length > 0 && (
          <>
            <dt className="text-slate-500">下屬</dt>
            <dd className="text-slate-200">{team.map((t) => t.name).join("、")}</dd>
          </>
        )}
      </dl>
      {contact.note && <p className="text-xs text-slate-400">{contact.note}</p>}
      <button onClick={onCompany} className="text-xs text-cyan-300 hover:underline">
        查看 {company.name} 公司資料與紀錄 →
      </button>
    </>
  );
}

function AddMemberDialog({ roleId, onClose, onSave }: { roleId: RoleId; onClose: () => void; onSave: (m: TermMember) => Promise<void> }) {
  const [f, setF] = useState({ name: "", phone: "", note: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={`新增${roleOf(roleId).label}`}
      subtitle="加入當期物業名單（組織架構、班表共用）"
      onClose={onClose}
      onSubmit={async () => {
        if (!f.name.trim()) return setError("請填寫姓名");
        setBusy(true);
        try {
          await onSave({ id: crypto.randomUUID(), roleId, name: f.name.trim(), phone: f.phone, email: "", note: f.note, start: "", end: "" });
        } catch (e) {
          setError((e as Error).message);
          setBusy(false);
        }
      }}
      footer={
        <>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            新增
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="姓名 *">
          <input className={INPUT} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} autoFocus />
        </Field>
        <Field label="電話">
          <input type="tel" className={INPUT} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={40} />
        </Field>
      </div>
      <Field label="班別 / 崗位 / 備註">
        <input className={INPUT} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} placeholder="例：夜班、車道崗" />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
