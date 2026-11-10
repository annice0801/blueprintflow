"use client";

import { createContext, useContext } from "react";
import { getDetail, getZones, type Building } from "@/lib/buildings";
import { GROUND_LABEL } from "./labels";
import { GROUP_COLOR, ROLES, roleOf, STATUS_COLOR, termAt, type Meeting, type PlanRef, type Regulation, type RoleGroup, type RoleId, type Term, type Todo, type TodoStatus, type Vendor } from "@/lib/mgmt";
import { INPUT } from "../ui";
import type { Announcement, FieldLog, FieldSettings, Reservation, Shift, Visitor } from "@/lib/field";
import type { InspectionPlan } from "@/lib/inspections";
import type { CommunityEvent } from "@/lib/playbooks";

export type MeetingSummary = Omit<Meeting, "text"> & { textLength: number };

export type Mgmt = {
  building: Building;
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  meetings: MeetingSummary[];
  setMeetings: React.Dispatch<React.SetStateAction<MeetingSummary[]>>;
  vendors: Vendor[];
  setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>;
  terms: Term[];
  setTerms: React.Dispatch<React.SetStateAction<Term[]>>;
  regulations: Regulation[];
  setRegulations: React.Dispatch<React.SetStateAction<Regulation[]>>;
  /** 當屆各職務擔任者（由屆次推算） */
  roles: RoleNames;
  reservations: Reservation[];
  setReservations: React.Dispatch<React.SetStateAction<Reservation[]>>;
  visitors: Visitor[];
  setVisitors: React.Dispatch<React.SetStateAction<Visitor[]>>;
  fieldlogs: FieldLog[];
  setFieldlogs: React.Dispatch<React.SetStateAction<FieldLog[]>>;
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  events: CommunityEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CommunityEvent[]>>;
  /** 開啟「套用情境」對話框 */
  openEvent: (preset?: { playbookId?: string; date?: string; name?: string; meetingId?: string }) => void;
  inspections: InspectionPlan[];
  setInspections: React.Dispatch<React.SetStateAction<InspectionPlan[]>>;
  settings: FieldSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<FieldSettings | null>>;
  openTodo: (todo: Todo | "new", preset?: Partial<Todo>) => void;
  goTab: (tab: TabId, query?: Record<string, string>) => void;
};

export type TabId = "overview" | "field" | "announcements" | "meetings" | "todos" | "timeline" | "inspections" | "org" | "sop" | "vendors" | "regulations" | "report" | "admin";

export type RoleNames = Map<RoleId, { name: string }>;

/** 由當屆管委會、當期物業與建商資料推算各職務擔任者 */
export function deriveRoles(terms: Term[], vendors: Vendor[], date: string): RoleNames {
  const m: RoleNames = new Map();
  for (const kind of ["committee", "property"] as const)
    for (const x of termAt(terms, kind, date)?.members ?? []) if (x.name && !m.has(x.roleId) && (!x.end || x.end >= date)) m.set(x.roleId, { name: x.name });
  const builder = vendors.find((v) => v.kind === "builder");
  if (builder) m.set("builder", { name: builder.name });
  return m;
}

export const MgmtContext = createContext<Mgmt | null>(null);
export const useMgmt = () => useContext(MgmtContext)!;

export function upsert<T extends { id: string }>(list: T[], item: T) {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

/** 待辦 PATCH 回應：本身 + 因完成而自動開始的下一步 */
export function mergeTodo(list: Todo[], saved: Todo & { released?: Todo[] }) {
  const { released = [], ...todo } = saved;
  return [todo as Todo, ...released].reduce(upsert, list);
}

/** 待辦相關頁面 */
export const TODO_LINKS: Record<string, { label: string; href: (buildingId: string) => string }> = {
  driveway: { label: "🚗 車道設備", href: (b) => `/buildings/${b}?panel=driveway` },
  plants: { label: "🌳 植栽紀錄", href: (b) => `/buildings/${b}?panel=garden` },
  announcements: { label: "📢 公告", href: (b) => `/buildings/${b}/manage?tab=announcements` },
  inspections: { label: "🧯 年度檢測", href: (b) => `/buildings/${b}/manage?tab=inspections` },
};

export function StatusBadge({ status }: { status: TodoStatus }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-100">
      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />
      {status}
    </span>
  );
}

/** 角色顯示名：「主委 高逸青」 */
export function roleName(id: RoleId, roles: RoleNames, short = true) {
  const r = roleOf(id);
  const who = roles.get(id)?.name;
  return `${short ? r.short : r.label}${who ? ` ${who}` : ""}`;
}

export function RoleChips({ ids, max = 3 }: { ids: RoleId[]; max?: number }) {
  const { roles } = useMgmt();
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ids.slice(0, max).map((id) => (
        <span key={id} className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: GROUP_COLOR[roleOf(id).group] }} />
          {roleName(id, roles)}
        </span>
      ))}
      {ids.length > max && <span className="text-[11px] text-slate-400">+{ids.length - max}</span>}
    </span>
  );
}

const GROUPS: RoleGroup[] = ["管委會", "物業", "建商", "外包廠商"];

/** 追蹤者多選（依群組） */
export function RolePicker({ value, onChange }: { value: RoleId[]; onChange: (v: RoleId[]) => void }) {
  const { roles } = useMgmt();
  const toggle = (id: RoleId) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="space-y-1.5">
      {GROUPS.map((g) => (
        <div key={g} className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 shrink-0 text-[11px]" style={{ color: GROUP_COLOR[g] }}>
            {g}
          </span>
          {ROLES.filter((r) => r.group === g).map((r) => {
            const on = value.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                aria-pressed={on}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? "border-cyan-300 bg-cyan-400/20 text-cyan-50" : "border-slate-600 text-slate-300 hover:border-cyan-500/60"}`}
              >
                {r.short}
                {roles.get(r.id)?.name && <span className="ml-1 text-[10px] text-slate-400">{roles.get(r.id)!.name}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** 從平面分區挑選位置（座標取分區中心） */
export function PlanRefPicker({ value, onChange }: { value?: PlanRef; onChange: (v: PlanRef | undefined) => void }) {
  const { building } = useMgmt();
  const floor = value?.floor ?? "";
  const floorDef = building.floors.find((f) => f.id === floor);
  const tower = value?.tower ?? (floorDef?.towers[0] ?? "S");
  const zones = floor ? [...getZones(floor, tower), ...getDetail(floor, tower).rooms].filter((z) => z.kind !== "core" || z.label !== "結構柱") : [];
  const pick = (zoneId: string, f = floor, t = tower) => {
    const all = [...getZones(f, t), ...getDetail(f, t).rooms];
    const z = all.find((x) => x.id === zoneId) ?? all[0];
    if (!z) return onChange(undefined);
    const label = t === "S" ? `${f} ${z.label}` : `${t} 棟 ${f} ${z.label.replace(/^[AB] /, "")}`;
    onChange({ floor: f, tower: t, zoneId: z.id, label, x: Math.round((z.x + z.w / 2) * 10) / 10, y: Math.round((z.y + z.h / 2) * 10) / 10 });
  };
  return (
    <div className="grid grid-cols-[1fr_auto_1.6fr_auto] gap-2">
      <select
        className={INPUT}
        value={floor}
        onChange={(e) => {
          const f = building.floors.find((x) => x.id === e.target.value);
          if (!f) return onChange(undefined);
          pick("", f.id, f.towers[0]);
        }}
      >
        <option value="">（不指定位置）</option>
        {[...building.floors].reverse().map((f) => (
          <option key={f.id} value={f.id}>
            {GROUND_LABEL[f.id] ?? f.label}
          </option>
        ))}
      </select>
      <select className={INPUT} value={tower} disabled={!floorDef || floorDef.towers.length < 2} onChange={(e) => pick("", floor, e.target.value as PlanRef["tower"])}>
        {(floorDef?.towers ?? ["S"]).map((t) => (
          <option key={t} value={t}>
            {t === "S" ? "共用" : `${t} 棟`}
          </option>
        ))}
      </select>
      <select className={INPUT} value={value?.zoneId ?? ""} disabled={!floor} onChange={(e) => pick(e.target.value)}>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.label}
          </option>
        ))}
      </select>
      <a
        href={value ? planLink(building.id, value) : undefined}
        target="_blank"
        rel="noreferrer"
        className={`self-center whitespace-nowrap text-xs ${value ? "text-cyan-300 hover:underline" : "pointer-events-none text-slate-600"}`}
      >
        平面圖 ↗
      </a>
    </div>
  );
}

/** 連到 3D / 平面圖並定位該樓層 */
export function planLink(buildingId: string, ref: Pick<PlanRef, "floor" | "tower" | "zoneId">) {
  const q = new URLSearchParams({ floor: ref.floor, tower: ref.tower });
  if (ref.zoneId) q.set("zone", ref.zoneId);
  return `/buildings/${buildingId}?${q}`;
}

export function fmtDate(d: string) {
  return d ? d.replaceAll("-", "/") : "—";
}

export const TODAY = () => new Date().toISOString().slice(0, 10);
