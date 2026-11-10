"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Building } from "@/lib/buildings";
import type { Announcement, FieldLog, FieldSettings, Reservation, Shift, Visitor } from "@/lib/field";
import { dueState, type InspectionPlan } from "@/lib/inspections";
import type { CommunityEvent } from "@/lib/playbooks";
import { can, TAB_MODULE } from "@/lib/perms";
import { isOverdue, type Regulation, type Term, type Todo, type Vendor } from "@/lib/mgmt";
import AnnouncementsTab from "../field/AnnouncementsTab";
import FieldTab from "../field/FieldTab";
import ReportTab from "../field/ReportTab";
import { api, BTN_OUTLINE, INPUT, Modal } from "../ui";
import { deriveRoles, MgmtContext, TODAY, type MeetingSummary, type Mgmt, type TabId } from "./common";
import { useMe } from "../auth/AuthProvider";
import UserMenu from "../auth/UserMenu";
import Dashboard from "./Dashboard";
import EventDialog, { type EventPreset } from "./EventDialog";
import InspectionsTab from "./InspectionsTab";
import MeetingsTab from "./MeetingsTab";
import OrgTab from "./OrgTab";
import RegulationsTab from "./RegulationsTab";
import SopTab from "./SopTab";
import TimelineTab from "./TimelineTab";
import TodoDialog from "./TodoDialog";
import TodosTab from "./TodosTab";
import VendorsTab from "./VendorsTab";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "總覽", icon: "📊" },
  { id: "field", label: "現場", icon: "📍" },
  { id: "announcements", label: "公告", icon: "📢" },
  { id: "meetings", label: "會議紀錄", icon: "📄" },
  { id: "todos", label: "待辦追蹤", icon: "✅" },
  { id: "timeline", label: "時程規劃", icon: "🗓" },
  { id: "inspections", label: "年度檢測", icon: "🧯" },
  { id: "org", label: "組織架構", icon: "🏛" },
  { id: "sop", label: "SOP 流程", icon: "🔀" },
  { id: "vendors", label: "廠商資訊", icon: "🏢" },
  { id: "regulations", label: "規範條例", icon: "📜" },
  { id: "report", label: "月報 / 年報", icon: "🗂" },
];

export default function ManagementCenter({ building }: { building: Building }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  // 依權限顯示分頁（真正的檢查在伺服器 proxy）
  const tabs = TABS.filter((t) => !me || TAB_MODULE[t.id] === null || can(me.perms, TAB_MODULE[t.id]!));
  const tab = (tabs.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview") as TabId;

  const [todos, setTodos] = useState<Todo[]>([]);
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [fieldlogs, setFieldlogs] = useState<FieldLog[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [settings, setSettings] = useState<FieldSettings | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [inspections, setInspections] = useState<InspectionPlan[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [eventDialog, setEventDialog] = useState<EventPreset | null>(null);
  const [loadError, setLoadError] = useState("");
  const [dialog, setDialog] = useState<{ todo?: Todo; preset?: Partial<Todo> } | null>(null);
  const [calOpen, setCalOpen] = useState(false);

  const perms = me?.perms;
  useEffect(() => {
    if (!perms) return;
    const q = `?buildingId=${building.id}`;
    // 只載入有檢視權限的資料
    const jobs: [boolean, () => Promise<unknown>][] = [
      [can(perms, "todos"), () => api<Todo[]>(`/api/todos${q}`).then(setTodos)],
      [can(perms, "meetings"), () => api<MeetingSummary[]>(`/api/meetings${q}`).then(setMeetings)],
      [can(perms, "vendors"), () => api<Vendor[]>(`/api/vendors${q}`).then(setVendors)],
      [can(perms, "org"), () => api<Term[]>(`/api/terms${q}`).then(setTerms)],
      [can(perms, "regulations"), () => api<Regulation[]>(`/api/regulations${q}`).then(setRegulations)],
      [can(perms, "field"), () => api<Reservation[]>(`/api/reservations${q}`).then(setReservations)],
      [can(perms, "field"), () => api<Visitor[]>(`/api/visitors${q}`).then(setVisitors)],
      [can(perms, "field"), () => api<FieldLog[]>(`/api/fieldlogs${q}`).then(setFieldlogs)],
      [can(perms, "announcements"), () => api<Announcement[]>(`/api/announcements${q}`).then(setAnnouncements)],
      [can(perms, "field"), () => api<FieldSettings>(`/api/field/settings${q}`).then(setSettings)],
      [can(perms, "field"), () => api<Shift[]>(`/api/shifts${q}`).then(setShifts)],
      [can(perms, "inspections"), () => api<InspectionPlan[]>(`/api/inspections${q}`).then(setInspections)],
      [can(perms, "todos"), () => api<CommunityEvent[]>(`/api/events${q}`).then(setEvents)],
    ];
    Promise.all(jobs.filter(([ok]) => ok).map(([, run]) => run())).catch(() => setLoadError("部分資料載入失敗，請重新整理"));
  }, [building.id, perms]);

  const goTab = useCallback(
    (t: TabId, query?: Record<string, string>) => router.replace(`${pathname}?${new URLSearchParams({ tab: t, ...query })}`, { scroll: false }),
    [router, pathname],
  );

  // 從平面圖點待辦標記進來：?todo=<id> 直接開啟
  const todoParam = params.get("todo");
  const deepTodo = todoParam ? todos.find((t) => t.id === todoParam) : undefined;

  const ctx: Mgmt = useMemo(
    () => ({
      building,
      todos,
      setTodos,
      meetings,
      setMeetings,
      vendors,
      setVendors,
      terms,
      setTerms,
      regulations,
      setRegulations,
      roles: deriveRoles(terms, vendors, TODAY()),
      reservations,
      setReservations,
      visitors,
      setVisitors,
      fieldlogs,
      setFieldlogs,
      announcements,
      setAnnouncements,
      settings,
      setSettings,
      shifts,
      setShifts,
      inspections,
      setInspections,
      events,
      setEvents,
      openEvent: (preset) => setEventDialog(preset ?? {}),
      goTab,
      openTodo: (todo, preset) => setDialog(todo === "new" ? { preset } : { todo }),
    }),
    [building, todos, meetings, vendors, terms, regulations, reservations, visitors, fieldlogs, announcements, settings, shifts, inspections, events, goTab, setDialog, setEventDialog],
  );

  const overdue = todos.filter((t) => isOverdue(t)).length;
  const dueSoon = inspections.filter((p) => ["逾期", "30 天內"].includes(dueState(p, TODAY()))).length;
  const dialogTodo = dialog?.todo ? todos.find((t) => t.id === dialog.todo!.id) ?? dialog.todo : deepTodo;

  return (
    <MgmtContext.Provider value={ctx}>
      <div className="flex h-dvh flex-col bg-[#020814] text-slate-200">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-cyan-500/20 bg-[#030c1d]/90 px-3 sm:gap-3 sm:px-4">
          {/* 手機：只留品牌縮寫與頁面名稱，社區名稱與麵包屑在寬螢幕才顯示 */}
          <Link href="/" className="shrink-0 font-mono text-sm font-bold tracking-[0.15em] text-cyan-300 hover:text-cyan-200 sm:tracking-[0.3em]">
            <span className="sm:hidden">BPF</span>
            <span className="hidden sm:inline">BLUEPRINTFLOW</span>
          </Link>
          <span className="hidden text-cyan-500/40 sm:inline">/</span>
          <Link href={`/buildings/${building.id}`} className="hidden whitespace-nowrap text-sm text-cyan-50 hover:text-cyan-200 sm:inline">
            {building.name}
          </Link>
          <span className="text-cyan-500/40">/</span>
          <h1 className="whitespace-nowrap text-sm font-semibold text-cyan-50">管理中心</h1>
          <div className="flex-1" />
          {/* 示範模式不開放行事曆訂閱 */}
          {!me?.demo && (
            <button onClick={() => setCalOpen(true)} aria-label="訂閱行事曆" className="whitespace-nowrap rounded-md border border-cyan-500/40 px-2.5 py-1.5 text-sm text-cyan-200 hover:bg-cyan-400/10 sm:px-3">
              📅<span className="hidden sm:inline"> 訂閱行事曆</span>
            </button>
          )}
          <Link href={`/buildings/${building.id}`} className="whitespace-nowrap rounded-md border border-cyan-400/60 bg-cyan-400/10 px-2.5 py-1.5 text-sm text-cyan-200 hover:bg-cyan-400/20 sm:px-3">
            ← <span className="sm:hidden">3D</span>
            <span className="hidden sm:inline">回 3D / 平面圖</span>
          </Link>
          <UserMenu />
        </header>

        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-cyan-500/20 px-3" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => goTab(t.id)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm ${tab === t.id ? "border-cyan-400 text-cyan-50" : "border-transparent text-slate-400 hover:text-cyan-200"}`}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.id === "inspections" && dueSoon > 0 && <span className="rounded-full bg-amber-500/80 px-1.5 text-[10px] font-semibold text-slate-950">{dueSoon}</span>}
              {t.id === "todos" && overdue > 0 && <span className="rounded-full bg-rose-500/80 px-1.5 text-[10px] font-semibold text-white">{overdue}</span>}
            </button>
          ))}
        </nav>

        {loadError && <p className="mx-4 mt-3 rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-200">{loadError}</p>}

        <main className="min-h-0 flex-1 p-4">
          {tab === "overview" && <Dashboard />}
          {tab === "meetings" && <MeetingsTab key={params.get("meeting") ?? ""} focusId={params.get("meeting") ?? undefined} />}
          {tab === "todos" && <TodosTab key={`${params.get("who")}${params.get("event")}`} initialWho={params.get("who") ?? undefined} initialEvent={params.get("event") ?? undefined} />}
          {tab === "timeline" && <TimelineTab key={`${params.get("cal")}${params.get("date")}`} initialView={params.get("cal") ?? undefined} initialDate={params.get("date") ?? undefined} />}
          {tab === "inspections" && <InspectionsTab />}
          {tab === "org" && <OrgTab />}
          {tab === "sop" && <SopTab initial={params.get("sop") ?? undefined} />}
          {tab === "vendors" && <VendorsTab focusId={params.get("company") ?? undefined} />}
          {tab === "regulations" && <RegulationsTab />}
          {tab === "field" && <FieldTab />}
          {tab === "announcements" && <AnnouncementsTab key={params.get("ann") ?? ""} focusId={params.get("ann") ?? undefined} />}
          {tab === "report" && <ReportTab />}
        </main>
      </div>

      {eventDialog && <EventDialog preset={eventDialog} onClose={() => setEventDialog(null)} />}
      {calOpen && <CalendarDialog buildingId={building.id} onClose={() => setCalOpen(false)} />}

      {(dialog || deepTodo) && (
        <TodoDialog
          key={dialogTodo?.id ?? "new"}
          todo={dialogTodo}
          preset={dialog?.preset}
          onClose={() => {
            setDialog(null);
            if (todoParam) goTab(tab);
          }}
        />
      )}
    </MgmtContext.Provider>
  );
}

function CalendarDialog({ buildingId, onClose }: { buildingId: string; onClose: () => void }) {
  // 訂閱網址帶 token（Google 日曆不會帶登入 cookie）；token 外流時換 SESSION_SECRET 即失效
  const [token, setToken] = useState("");
  useEffect(() => {
    api<{ token: string }>(`/api/auth/calendar-token?buildingId=${buildingId}`).then((r) => setToken(r.token), () => {});
  }, [buildingId]);
  const url = typeof window === "undefined" || !token ? "" : `${window.location.origin}/api/calendar?buildingId=${buildingId}&token=${token}`;
  const local = /localhost|127\.0\.0\.1/.test(url);
  return (
    <Modal title="訂閱社區行事曆" subtitle="待辦期限、會議、預約、合約到期、公告期間、年度檢測" onClose={onClose}>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
        <li>複製下方網址</li>
        <li>
          在電腦版 Google 日曆左側「其他日曆」按 ＋ →「<b>透過網址新增</b>」，貼上網址
        </li>
        <li>之後新增的待辦、預約會自動同步（Google 約數小時更新一次）</li>
      </ol>
      <input readOnly className={INPUT} value={url || "產生中…"} onFocus={(e) => e.target.select()} />
      <p className="text-[11px] text-slate-500">這個網址等同通行證，請勿公開分享。</p>
      {local && <p className="rounded-md bg-amber-500/15 px-3 py-2 text-xs text-amber-100">目前系統在本機執行，Google 無法連到 localhost。上線後此網址即可訂閱；現在可先下載 .ics 匯入一次。</p>}
      <a href={`/api/calendar?buildingId=${buildingId}`} download="藍圖社區.ics" className={`${BTN_OUTLINE} inline-block`}>
        ⬇ 下載 .ics（手動匯入）
      </a>
    </Modal>
  );
}
