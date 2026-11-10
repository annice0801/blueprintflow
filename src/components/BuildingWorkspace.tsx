"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FLOOR_ORDER, floorElevation, getArea, inZone, SHOPS, type Building, type Rect, type TowerId } from "@/lib/buildings";
import { ALERT, ALERT_LEVELS, alertOf, CATEGORIES, STATUSES, TOWER_LABEL, type AlertLevel, type Issue } from "@/lib/issues";
import { roleOf, STATUS_COLOR, type Meeting, type Todo, type Vendor } from "@/lib/mgmt";
import { gateState, type GateLog, type Plant, type Shop } from "@/lib/records";
import type { FloorKey } from "./BuildingScene";
import { useMe } from "./auth/AuthProvider";
import UserMenu from "./auth/UserMenu";
import RepairDialog, { type RepairDraft } from "./portal/RepairDialog";
import ResidentPanel from "./portal/ResidentPanel";
import { can, canManage, type PortalRepair } from "@/lib/perms";
import DrivewayView from "./DrivewayView";
import FloorPlan, { pinColor, type PlanNote } from "./FloorPlan";
import GardenView from "./GardenView";
import IssueDialog, { type IssueDraft } from "./IssueDialog";
import Overlay from "./Overlay";
import ShopDialog from "./ShopDialog";
import { BTN_OUTLINE, BTN_PRIMARY, Modal } from "./ui";

const BuildingScene = dynamic(() => import("./BuildingScene"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm tracking-widest text-cyan-400/70">載入 3D 模型中…</div>,
});

const fmtElev = (m: number) => `${m >= 0 ? "+" : "−"}${Math.abs(m).toFixed(2)} m`;
const floorLabel = (id: string) => (id === "RF" ? "R 樓" : id);
const keyOf = (k: FloorKey) => `${k.tower}:${k.floor}`;

type Panel = { kind: "garden"; areaId: string } | { kind: "driveway" } | { kind: "unit"; zone: Rect };

function upsert<T extends { id: string }>(list: T[], item: T) {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url);
  return r.json();
}

export default function BuildingWorkspace({ building }: { building: Building }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadError, setLoadError] = useState("");
  // 管理中心「在平面圖查看」：?floor=12F&tower=A&zone=A3
  const params = useSearchParams();
  const [selected, setSelected] = useState<FloorKey | null>(() => {
    const floor = params.get("floor");
    const tower = params.get("tower") as TowerId | null;
    const f = building.floors.find((x) => x.id === floor);
    return f && tower && f.towers.includes(tower) ? { floor: f.id, tower } : null;
  });
  const [focusZone, setFocusZone] = useState(params.get("zone") ?? undefined);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [meetings, setMeetings] = useState<(Omit<Meeting, "text"> & { textLength: number })[]>([]);
  const [note, setNote] = useState<(PlanNote & { at?: { x: number; y: number } }) | null>(null);
  const [repairs, setRepairs] = useState<PortalRepair[]>([]);
  const [repairDraft, setRepairDraft] = useState<RepairDraft | null>(null);
  const [repairSent, setRepairSent] = useState(0);
  const [companies, setCompanies] = useState<Vendor[]>([]);
  const [hover, setHover] = useState<FloorKey | null>(null);
  const [draft, setDraft] = useState<IssueDraft | null>(null);
  const [editing, setEditing] = useState<Issue | null>(null);
  const [listScope, setListScope] = useState<"floor" | "all">("all");
  const [explode, setExplode] = useState(0);
  const [levels, setLevels] = useState<AlertLevel[]>(ALERT_LEVELS);
  // 待辦連結：?panel=driveway / ?panel=garden 直接開啟車道或植栽面板
  const [panel, setPanel] = useState<Panel | null>(() => {
    const p = params.get("panel");
    if (p === "driveway") return { kind: "driveway" };
    const garden = building.publicAreas.find((a) => a.kind === "garden");
    return p === "garden" && garden ? { kind: "garden", areaId: garden.id } : null;
  });
  const [plants, setPlants] = useState<Plant[]>([]);
  const [gateLogs, setGateLogs] = useState<GateLog[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopZone, setShopZone] = useState<Rect | null>(null);

  const me = useMe();
  const perms = me?.perms;
  // 住戶模式：沒有完整平面圖權限、只有住戶專區 → 只看去除隱私的維修進度、公告、規範、會議結果
  const resident = !!perms && !can(perms, "plans") && can(perms, "portal");
  useEffect(() => {
    if (!perms) return;
    const q = `?buildingId=${building.id}`;
    // 只載入有檢視權限的資料
    const jobs: [boolean, () => Promise<unknown>][] = [
      [can(perms, "plans"), () => getJson<Issue[]>(`/api/issues${q}`).then(setIssues)],
      [can(perms, "gardens"), () => getJson<Plant[]>(`/api/plants${q}`).then(setPlants)],
      [can(perms, "driveway"), () => getJson<GateLog[]>(`/api/gate-logs${q}`).then(setGateLogs)],
      [can(perms, "shops"), () => getJson<Shop[]>(`/api/shops${q}`).then(setShops)],
      [can(perms, "todos"), () => getJson<Todo[]>(`/api/todos${q}`).then(setTodos)],
      [can(perms, "vendors"), () => getJson<Vendor[]>(`/api/vendors${q}`).then(setCompanies)],
      [can(perms, "meetings"), () => getJson<(Omit<Meeting, "text"> & { textLength: number })[]>(`/api/meetings${q}`).then(setMeetings)],
    ];
    Promise.all(jobs.filter(([ok]) => ok).map(([, run]) => run())).catch(() => setLoadError("部分資料載入失敗，請重新整理"));
  }, [building.id, perms]);

  // 即時同步：其他人新增或修改工單後，光圈自動更新（分頁在背景時暫停）
  useEffect(() => {
    if (!perms || !can(perms, "plans")) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      getJson<Issue[]>(`/api/issues?buildingId=${building.id}`).then(setIssues, () => {});
    }, 20000);
    return () => clearInterval(id);
  }, [building.id, perms]);

  useEffect(() => {
    if (!resident) return;
    getJson<PortalRepair[]>(`/api/portal/repairs?buildingId=${building.id}`).then(
      (list) => {
        setRepairs(list);
        // 3D 樓層上色用（不含任何報修細節）
        setIssues(
          list.map((r) => ({
            id: r.id,
            buildingId: building.id,
            tower: r.tower,
            floor: r.floor,
            zone: r.label,
            x: r.x,
            y: r.y,
            title: r.title,
            description: "",
            // 光圈等級：報修依類別（漏水 / 裂痕為紅），設備故障為橘
            category: CATEGORIES.find((c) => r.title.startsWith(`${c}：`)) ?? (r.kind === "設備" ? "水電 / 機電" : "其他"),
            severity: "中",
            status: "處理中",
            photos: [],
            createdAt: r.since,
            updatedAt: r.since,
          })),
        );
      },
      () => setLoadError("維修進度載入失敗，請重新整理"),
    );
  }, [resident, building.id, repairSent]);

  const shopMap = useMemo(() => new Map(shops.map((s) => [s.id, s])), [shops]);

  // 會議提到的地點與待辦的位置 → 平面圖標記
  const notes = useMemo(() => {
    const out: PlanNote[] = [];
    for (const r of repairs)
      out.push({
        id: r.id,
        kind: "record",
        floor: r.floor,
        tower: r.tower,
        x: r.x,
        y: r.y,
        title: r.title,
        sub: `${r.status}${r.since ? ` · 自 ${r.since.replaceAll("-", "/")}` : ""}${r.expected ? ` · 預計 ${r.expected.replaceAll("-", "/")} 完成` : ""}`,
        color: r.status === "待維修" || r.status === "待處理" ? "#ffb020" : "#4cc9ff",
        href: "",
        label: r.label,
      });
    for (const t of todos)
      if (t.location)
        out.push({
          id: `t-${t.id}`,
          kind: "todo",
          floor: t.location.floor,
          tower: t.location.tower,
          x: t.location.x,
          y: t.location.y,
          title: t.title,
          sub: `${t.status} · ${t.assignees.map((r) => roleOf(r).short).join("、")}${t.due ? ` · 期限 ${t.due.replaceAll("-", "/")}` : ""}`,
          color: STATUS_COLOR[t.status],
          href: `/buildings/${building.id}/manage?tab=todos&todo=${t.id}`,
          label: t.location.label,
        });
    for (const m of meetings)
      for (const x of m.mentions)
        out.push({
          id: `m-${x.id}`,
          kind: "meeting",
          floor: x.floor,
          tower: x.tower,
          x: x.x,
          y: x.y,
          title: m.title,
          sub: `${m.date.replaceAll("-", "/")} · ${m.type}`,
          snippet: x.snippet,
          color: "#a78bfa",
          href: `/buildings/${building.id}/manage?tab=meetings&meeting=${m.id}`,
          label: x.label,
        });
    for (const c of companies)
      for (const r of c.records ?? [])
        if (r.location)
          out.push({
            id: `r-${r.id}`,
            kind: "record",
            floor: r.location.floor,
            tower: r.location.tower,
            x: r.location.x,
            y: r.location.y,
            title: `${r.type}：${r.title}`,
            sub: `${r.date.replaceAll("-", "/")} · ${c.name}${r.cost ? ` · ${r.cost}` : ""}`,
            snippet: [r.description, r.result && `處理結果：${r.result}`].filter(Boolean).join("\n"),
            color: "#fb923c",
            href: `/buildings/${building.id}/manage?tab=vendors&company=${c.id}`,
            label: r.location.label,
          });
    return out;
  }, [repairs, todos, meetings, companies, building.id]);
  const floorNotes = selected ? notes.filter((n) => n.floor === selected.floor && n.tower === selected.tower) : [];

  function openLink(z: Rect) {
    if (z.link === "shop") setShopZone(z);
    else if (z.link === "unit") setPanel({ kind: "unit", zone: z });
    else if (z.link === "driveway") setPanel({ kind: "driveway" });
    else if (z.link?.startsWith("garden:")) setPanel({ kind: "garden", areaId: z.link.slice(7) });
  }

  const byFloor = useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const i of issues) {
      const k = `${i.tower}:${i.floor}`;
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return m;
  }, [issues]);

  // 窄螢幕（< lg）時側欄改為抽屜
  const [sideOpen, setSideOpen] = useState(false);

  const select = useCallback((k: FloorKey) => {
    setSelected(k);
    setListScope("floor");
    setSideOpen(false);
  }, []);

  function step(dir: 1 | -1) {
    if (!selected) return;
    const f = building.floors[building.floors.findIndex((x) => x.id === selected.floor) + dir];
    if (!f) return;
    // 從共用層（1F）往上預設進 A 棟
    const tower: TowerId = f.towers.includes(selected.tower) ? selected.tower : f.towers.includes("S") ? "S" : "A";
    setSelected({ tower, floor: f.id });
  }

  const current = selected ? (byFloor.get(keyOf(selected)) ?? []) : [];
  const listed = (listScope === "floor" && selected ? current : issues).slice().sort((a, b) => a.tower.localeCompare(b.tower) || FLOOR_ORDER(b.floor) - FLOOR_ORDER(a.floor));

  const totals = STATUSES.map((s) => [s, issues.filter((i) => i.status === s).length] as const);

  function saved(i: Issue) {
    setIssues((all) => (all.some((x) => x.id === i.id) ? all.map((x) => (x.id === i.id ? i : x)) : [...all, i]));
    setDraft(null);
    setEditing(null);
  }

  function openIssue(i: Issue) {
    setSideOpen(false);
    setSelected({ tower: i.tower, floor: i.floor });
    setEditing(i);
  }

  // 公共區域 / 車道 / 管理員面板（蓋在樓層平面之上，返回時回到平面或 3D）
  function renderPanel() {
    if (!panel) return null;
    const back = { onBack: () => setPanel(null), backLabel: selected ? "← 返回平面" : "← 返回 3D" };
    if (panel.kind === "garden") {
      const area = getArea(building, panel.areaId);
      if (!area) return null;
      const list = plants.filter((p) => p.areaId === area.id);
      return (
        <Overlay
          {...back}
          title={`公共區域 · ${area.name}`}
          meta={`${list.length} 株植栽 · ${list.reduce((n, p) => n + p.events.length, 0)} 筆事件`}
          actions={building.publicAreas
            .filter((a) => a.kind === "garden")
            .map((a) => (
              <button
                key={a.id}
                onClick={() => setPanel({ kind: "garden", areaId: a.id })}
                className={`rounded px-2.5 py-1 text-xs ${a.id === area.id ? "bg-emerald-400/20 text-emerald-100" : "text-slate-400 hover:text-emerald-200"}`}
              >
                {a.name}
              </button>
            ))}
        >
          <GardenView buildingId={building.id} area={area} plants={list} onChange={(p) => setPlants((all) => upsert(all, p))} onDeleted={(id) => setPlants((all) => all.filter((x) => x.id !== id))} />
        </Overlay>
      );
    }
    if (panel.kind === "unit" && selected) {
      const z = panel.zone;
      const inUnit = current.filter((i) => inZone(z, i.x, i.y));
      const unitNotes = floorNotes.filter((n) => inZone(z, n.x, n.y));
      return (
        <Overlay
          onBack={() => setPanel(null)}
          backLabel="← 返回樓層平面"
          title={`戶型詳細圖 · ${TOWER_LABEL[selected.tower]} ${floorLabel(selected.floor)} ${z.label}`}
          meta={`${z.info ?? ""} · ${inUnit.length} 筆問題`}
          hint="點擊房間任一位置新增問題注記，會自動帶入「戶別 / 房間」。牆、門窗與衛浴廚具依建案簡介平面圖描繪，依實際竣工圖為準。"
        >
          <div className="grid h-full min-h-0 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-h-[300px] rounded-lg border border-cyan-500/20">
              <FloorPlan
                building={building}
                tower={selected.tower}
                floor={selected.floor}
                issues={current}
                focus={z}
                draft={draft && draft.floor === selected.floor && draft.tower === selected.tower ? draft : null}
                onPick={({ x, y, zone }) => setDraft({ buildingId: building.id, tower: selected.tower, floor: selected.floor, x, y, zone: zone?.label ?? z.label })}
                onOpenIssue={setEditing}
                notes={unitNotes}
                onOpenNote={(n, at) => setNote({ ...n, at })}
              />
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-cyan-500/20">
              {unitNotes.length > 0 && (
                <>
                  <div className="border-b border-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100">會議紀錄 / 待辦（{unitNotes.length}）</div>
                  <ul className="max-h-[40%] divide-y divide-cyan-500/10 overflow-y-auto border-b border-cyan-500/20">
                    {unitNotes.map((n) => (
                      <li key={n.id}>
                        <button onClick={() => setNote(n)} className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-cyan-400/5">
                          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: n.color }} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-cyan-50">{n.title}</span>
                            <span className="block text-[11px] text-slate-400">
                              {{ todo: "待辦 · ", meeting: "會議 · ", record: "維修 · " }[n.kind]}
                              {n.sub}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="border-b border-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100">本戶問題</div>
              <ul className="min-h-0 flex-1 divide-y divide-cyan-500/10 overflow-y-auto">
                {inUnit.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">尚無問題</li>}
                {inUnit.map((i) => (
                  <li key={i.id}>
                    <button onClick={() => setEditing(i)} className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-cyan-400/5">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: pinColor(i) }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-cyan-50">{i.title}</span>
                        <span className="block text-[11px] text-slate-400">
                          {i.zone} · {i.category} · {i.status}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Overlay>
      );
    }
    return (
      <Overlay {...back} title="公共區域 · 車道" meta="汽車 / 機車道閘開關控制紀錄">
        <DrivewayView buildingId={building.id} logs={gateLogs} onSaved={(l) => setGateLogs((all) => upsert(all, l))} onDeleted={(id) => setGateLogs((all) => all.filter((x) => x.id !== id))} />
      </Overlay>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#020814] text-slate-200">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-cyan-500/20 bg-[#030c1d]/90 px-4">
        <Link href="/" className="font-mono text-sm font-bold tracking-[0.3em] text-cyan-300 hover:text-cyan-200">
          BLUEPRINTFLOW
        </Link>
        <span className="text-cyan-500/40">/</span>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-cyan-50">{building.name}</h1>
          <p className="truncate text-[11px] text-cyan-300/60">{building.subtitle} · B4 – 22F + R 樓</p>
        </div>
        <div className="flex-1" />
        <div className={`${resident ? "!hidden" : ""} hidden items-center gap-3 whitespace-nowrap text-xs xl:flex`}>
          {totals.map(([s, n]) => (
            <span key={s} className="text-slate-400">
              {s} <b className="font-mono text-cyan-200">{n}</b>
            </span>
          ))}
        </div>
        {canManage(perms) && (
          <Link
            href={`/buildings/${building.id}/manage`}
            className="shrink-0 whitespace-nowrap rounded-md border border-violet-400/60 bg-violet-400/10 px-3 py-1.5 text-sm font-medium text-violet-200 hover:bg-violet-400/20"
          >
            📋 管理中心
          </Link>
        )}
        {!resident && (
          <a
            href={`/api/export?buildingId=${building.id}`}
            className="shrink-0 whitespace-nowrap rounded-md border border-cyan-400/60 bg-cyan-400/10 px-3 py-1.5 text-sm font-medium text-cyan-200 hover:bg-cyan-400/20"
          >
            匯出<span className="hidden sm:inline">統計表</span> (Excel)
          </a>
        )}
        <UserMenu />
        <button
          onClick={() => setSideOpen((v) => !v)}
          className="shrink-0 whitespace-nowrap rounded-md border border-cyan-400/60 bg-cyan-400/20 px-3 py-1.5 text-sm font-medium text-cyan-100 hover:bg-cyan-400/30 lg:hidden"
          aria-expanded={sideOpen}
        >
          ☰ {resident ? "樓層 / 住戶專區" : "樓層 / 清單"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          <BuildingScene
            building={building}
            issues={issues}
            plants={plants}
            selected={selected}
            onSelect={select}
            onHover={setHover}
            onPlant={(p) => setPanel({ kind: "garden", areaId: p.areaId })}
            onIssue={resident ? (i) => select({ tower: i.tower, floor: i.floor }) : openIssue}
            explode={explode}
            levels={levels}
          />

          <div className="pointer-events-none absolute left-4 top-4 space-y-2">
            <div className="rounded-md border border-cyan-500/30 bg-slate-950/70 px-3 py-2 text-xs text-cyan-200/80 backdrop-blur">
              {hover ? (
                <>
                  <b className="text-cyan-100">
                    {TOWER_LABEL[hover.tower]} {floorLabel(hover.floor)}
                  </b>
                  <span className="ml-2">
                    樓高 {building.floors.find((f) => f.id === hover.floor)?.height.toFixed(2)} m · 標高 {fmtElev(floorElevation(building, hover.floor))} · {resident ? "維修中" : "問題"}{" "}
                    {byFloor.get(keyOf(hover))?.length ?? 0} 筆 · 點擊查看平面
                  </span>
                </>
              ) : (
                "拖曳旋轉 · 滾輪縮放 · 點擊樓層查看平面圖"
              )}
            </div>
            <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-md border border-cyan-500/20 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-400 backdrop-blur">
              <span className="px-1 text-slate-500">光圈</span>
              {ALERT_LEVELS.filter((lv) => !resident || lv !== "green").map((lv) => {
                const on = levels.includes(lv);
                const n = issues.filter((i) => alertOf(i) === lv).length;
                return (
                  <button
                    key={lv}
                    onClick={() => setLevels((l) => (on ? l.filter((x) => x !== lv) : [...l, lv]))}
                    aria-pressed={on}
                    title={on ? "點擊隱藏" : "點擊顯示"}
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/5 ${on ? "text-slate-300" : "text-slate-600 line-through"}`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: ALERT[lv].color, boxShadow: on ? `0 0 6px ${ALERT[lv].color}` : undefined, opacity: on ? 1 : 0.35 }} />
                    {ALERT[lv].label}（{ALERT[lv].hint}）<span className="font-mono text-slate-200">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <ExplodeSlider value={explode} onChange={setExplode} />
          {loadError && <p className="absolute bottom-4 left-4 rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-200">{loadError}</p>}

          {selected && (
            <Overlay
              title={`${TOWER_LABEL[selected.tower]} · ${floorLabel(selected.floor)}`}
              meta={resident ? `${current.length} 處維修中` : `${current.length} 筆問題`}
              onBack={() => {
                setSelected(null);
                setFocusZone(undefined);
              }}
              hint={
                resident
                  ? "點擊平面圖上的位置即可報修；「修」標記為目前維修中的地點，點擊查看進度。"
                  : selected.floor === "1F"
                    ? "點擊空白處新增問題注記；點擊有框的標籤進入花圃、車道或店鋪經營。"
                    : selected.floor === "RF" || selected.tower === "S"
                      ? "點擊平面圖任一位置即可新增問題注記；點擊編號圖釘查看或編輯。"
                      : `點擊任一位置新增問題注記（自動帶入房間 / 走廊 / 電梯等區域）；點擊戶號（例如「${selected.tower}1 ›」）開啟戶型詳細圖。`
              }
              actions={
                <>
                  {selected.tower !== "S" && (
                    <div className="flex overflow-hidden rounded-md border border-cyan-500/40 text-sm">
                      {(["A", "B"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setSelected({ ...selected, tower: t })}
                          className={`px-3 py-1 ${selected.tower === t ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400 hover:text-cyan-200"}`}
                        >
                          {t} 棟
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => step(1)} disabled={selected.floor === "RF"} className={BTN_OUTLINE}>
                    ▲ 上一層
                  </button>
                  <button onClick={() => step(-1)} disabled={selected.floor === "B4"} className={BTN_OUTLINE}>
                    ▼ 下一層
                  </button>
                </>
              }
            >
              <div className="h-full p-3">
                <FloorPlan
                  building={building}
                  tower={selected.tower}
                  floor={selected.floor}
                  issues={resident ? [] : current}
                  draft={draft && draft.floor === selected.floor && draft.tower === selected.tower ? draft : null}
                  onPick={({ x, y, zone }) =>
                    resident
                      ? setRepairDraft({
                          tower: selected.tower,
                          floor: selected.floor,
                          x,
                          y,
                          zone: zone?.label ?? "",
                          label: `${TOWER_LABEL[selected.tower]} ${floorLabel(selected.floor)}${zone ? ` ${zone.label}` : ""}`,
                        })
                      : setDraft({ buildingId: building.id, tower: selected.tower, floor: selected.floor, x, y, zone: zone?.label ?? "" })
                  }
                  onOpenIssue={setEditing}
                  onZoneLink={resident ? undefined : openLink}
                  shops={resident ? undefined : shopMap}
                  notes={floorNotes}
                  onOpenNote={(n, at) => setNote({ ...n, at })}
                  highlightZone={focusZone}
                />
              </div>
            </Overlay>
          )}

          {panel && renderPanel()}
        </main>

        {sideOpen && <div className="fixed inset-0 top-14 z-30 bg-black/50 lg:hidden" onClick={() => setSideOpen(false)} />}
        <aside
          className={`${sideOpen ? "fixed bottom-0 right-0 top-14 z-40 flex shadow-[-10px_0_40px_rgba(0,0,0,0.6)]" : "hidden"} w-80 max-w-[90vw] shrink-0 flex-col border-l border-cyan-500/20 bg-[#030c1d] lg:static lg:z-auto lg:flex lg:shadow-none`}
        >
          <FloorStack building={building} byFloor={byFloor} selected={selected} onSelect={select} />
          {resident ? (
            <ResidentPanel
              buildingId={building.id}
              repairs={repairs}
              refreshKey={repairSent}
              onLocate={(r) => {
                select({ tower: r.tower, floor: r.floor });
                setSideOpen(false);
              }}
              onReport={() => {
                if (!selected) select({ tower: "S", floor: "1F" });
                setSideOpen(false);
                alert("請在平面圖上點選要報修的位置（可用上一層 / 下一層切換樓層）");
              }}
            />
          ) : (
            <>
              <PublicAreas
                building={building}
                plants={plants}
                gateLogs={gateLogs}
                shops={shops}
                onOpen={(p) => {
                  setPanel(p);
                  setSideOpen(false);
                }}
                onShops={() => select({ tower: "S", floor: "1F" })}
              />
              <div className="flex items-center gap-2 border-y border-cyan-500/20 px-4 py-2">
                <h3 className="text-sm font-semibold text-cyan-100">問題清單</h3>
                <div className="flex-1" />
                {(["floor", "all"] as const).map((s) => (
                  <button
                    key={s}
                    disabled={s === "floor" && !selected}
                    onClick={() => setListScope(s)}
                    className={`rounded px-2 py-0.5 text-xs disabled:opacity-30 ${listScope === s ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400 hover:text-cyan-200"}`}
                  >
                    {s === "floor" ? "本層" : "全部"}
                  </button>
                ))}
              </div>
              <ul className="min-h-0 flex-1 divide-y divide-cyan-500/10 overflow-y-auto">
                {listed.length === 0 && <li className="px-4 py-6 text-center text-xs text-slate-500">尚無問題，點擊樓層後在平面圖上新增</li>}
                {listed.map((i) => (
                  <li key={i.id}>
                    <button onClick={() => openIssue(i)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-cyan-400/5">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: pinColor(i), boxShadow: `0 0 8px ${pinColor(i)}` }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-cyan-50">{i.title}</span>
                        <span className="block text-[11px] text-slate-400">
                          {TOWER_LABEL[i.tower]} {floorLabel(i.floor)}
                          {i.zone && ` · ${i.zone}`} · {i.category} · {i.status}
                          {i.photos.length > 0 && ` · 📷${i.photos.length}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      {note && note.at && resident && (
        // 住戶：維修標記的小懸浮卡片（不含報修人與內部說明）
        <div
          className="fixed z-50 w-64 rounded-lg border border-cyan-400/50 bg-[#06142a]/95 p-3 text-sm shadow-[0_0_24px_rgba(76,201,255,0.3)] backdrop-blur"
          style={{ left: Math.min(note.at.x + 12, (typeof window === "undefined" ? 1200 : window.innerWidth) - 272), top: Math.max(note.at.y - 20, 64) }}
          role="dialog"
          aria-label={note.title}
        >
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: note.color }} />
            <p className="flex-1 font-medium text-cyan-50">{note.title}</p>
            <button onClick={() => setNote(null)} className="text-slate-400 hover:text-white" aria-label="關閉">
              ✕
            </button>
          </div>
          <p className="mt-1 pl-4.5 text-xs text-slate-300">📍 {note.label}</p>
          <p className="pl-4.5 text-xs text-slate-400">{note.sub}</p>
        </div>
      )}

      {note && !resident && (
        <Modal
          title={note.title}
          subtitle={`${{ todo: "待辦事項", meeting: "會議紀錄", record: "廠商維修紀錄" }[note.kind]} · 📍 ${note.label}`}
          onClose={() => setNote(null)}
          footer={
            <>
              <div className="flex-1" />
              <Link href={note.href} className={BTN_PRIMARY}>
                在管理中心開啟 →
              </Link>
            </>
          }
        >
          <p className="text-sm text-slate-300">{note.sub}</p>
          {note.snippet && <p className="whitespace-pre-wrap rounded-md bg-white/5 p-3 text-sm leading-relaxed text-slate-300">「{note.snippet}」</p>}
        </Modal>
      )}

      {shopZone && (
        <ShopDialog
          buildingId={building.id}
          zone={shopZone}
          shop={shopMap.get(shopZone.id)}
          onClose={() => setShopZone(null)}
          onSaved={(shop) => {
            setShops((all) => upsert(all, shop));
            setShopZone(null);
          }}
        />
      )}

      {repairDraft && (
        <RepairDialog
          draft={repairDraft}
          onClose={() => setRepairDraft(null)}
          onSent={() => {
            setRepairDraft(null);
            setRepairSent((n) => n + 1);
            alert("已送出報修，處理進度可在「我的報修」查看。");
          }}
        />
      )}

      {(draft || editing) && (
        <IssueDialog
          key={editing?.id ?? "new"}
          issue={editing ?? undefined}
          draft={editing ? undefined : (draft ?? undefined)}
          onClose={() => {
            setDraft(null);
            setEditing(null);
          }}
          onSaved={saved}
          onDeleted={(id) => {
            setIssues((all) => all.filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/** 右側公共區域捷徑 */
function PublicAreas({
  building,
  plants,
  gateLogs,
  shops,
  onOpen,
  onShops,
}: {
  building: Building;
  plants: Plant[];
  gateLogs: GateLog[];
  shops: Shop[];
  onOpen: (p: Panel) => void;
  onShops: () => void;
}) {
  const item = "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-cyan-400/10";
  const car = gateState(gateLogs, "汽車");
  const moto = gateState(gateLogs, "機車");
  const open = shops.filter((s) => s.status === "營業中").length;
  return (
    <div className="border-t border-cyan-500/20 px-2 py-2">
      <h3 className="px-2 pb-1 text-[11px] font-semibold tracking-widest text-cyan-400/80">公共區域</h3>
      {building.publicAreas.map((a) =>
        a.kind === "garden" ? (
          <button key={a.id} onClick={() => onOpen({ kind: "garden", areaId: a.id })} className={item}>
            <span className="text-emerald-300">🌳</span>
            <span className="flex-1 text-cyan-50">{a.name}</span>
            <span className="text-slate-400">{plants.filter((p) => p.areaId === a.id).length} 株</span>
          </button>
        ) : (
          <button key={a.id} onClick={() => onOpen({ kind: "driveway" })} className={item}>
            <span>🚗</span>
            <span className="flex-1 text-cyan-50">{a.name}</span>
            <span className="text-slate-400">
              汽 {car.label} · 機 {moto.label}
            </span>
          </button>
        ),
      )}
      <button onClick={onShops} className={item}>
        <span>🏪</span>
        <span className="flex-1 text-cyan-50">1F 店鋪經營</span>
        <span className="text-slate-400">
          營業 {open} / {SHOPS.length}
        </span>
      </button>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {label}
    </span>
  );
}

/** 3D 樓層炸裂圖：垂直滑桿把各樓層拉開，看樓板、核心筒與管道間 */
function ExplodeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = Math.round(value * 100);
  return (
    <div className="absolute left-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 rounded-md border border-cyan-500/30 bg-slate-950/70 px-2 py-3 text-[11px] text-cyan-200/80 backdrop-blur">
      <span className="font-semibold text-cyan-100">樓層展開</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label="樓層展開程度"
        className="h-44 w-5 cursor-pointer accent-cyan-400"
        style={{ writingMode: "vertical-lr", direction: "rtl" }}
      />
      <span className="font-mono text-cyan-50">{pct}%</span>
      <button onClick={() => onChange(value > 0 ? 0 : 1)} className="rounded border border-cyan-500/40 px-2 py-0.5 hover:bg-cyan-400/10">
        {value > 0 ? "收合" : "全展開"}
      </button>
      {value > 0.12 && (
        <div className="mt-1 space-y-1 border-t border-cyan-500/20 pt-2 text-slate-400">
          <Legend color="#b98cff" label="管道間" />
          <Legend color="#4cc9ff" label="梯廳 / 電梯" />
          <Legend color="#c6f0ff" label="結構柱" />
        </div>
      )}
    </div>
  );
}

/** 右側樓層堆疊：上方 A/B 雙欄，1F 與地下室為共用 */
function FloorStack({ building, byFloor, selected, onSelect }: { building: Building; byFloor: Map<string, Issue[]>; selected: FloorKey | null; onSelect: (k: FloorKey) => void }) {
  const floors = [...building.floors].reverse();
  const cell = (k: FloorKey, label: string, wide = false) => {
    const list = byFloor.get(keyOf(k)) ?? [];
    const open = list.filter((i) => alertOf(i) !== "green");
    const high = open.some((i) => alertOf(i) === "red");
    const isSel = selected && keyOf(selected) === keyOf(k);
    return (
      <button
        key={keyOf(k)}
        onClick={() => onSelect(k)}
        className={`relative flex h-6 items-center justify-center rounded-sm border font-mono text-[11px] transition ${wide ? "col-span-2" : ""} ${
          isSel
            ? "border-cyan-300 bg-cyan-400/30 text-white shadow-[0_0_10px_rgba(76,201,255,0.6)]"
            : high
              ? "border-rose-400/70 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
              : open.length
                ? "border-orange-400/70 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20"
                : "border-cyan-500/25 text-cyan-300/80 hover:border-cyan-400/60 hover:bg-cyan-400/10"
        }`}
      >
        {label}
        {list.length > 0 && <span className="absolute right-1 text-[10px] opacity-80">{list.length}</span>}
      </button>
    );
  };

  return (
    <div className="max-h-[48%] overflow-y-auto px-4 py-3">
      <div className="mb-1.5 grid grid-cols-2 gap-1 text-center text-[11px] font-semibold tracking-widest text-cyan-400/80">
        <span>A 棟</span>
        <span>B 棟</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {floors.map((f) =>
          f.towers.includes("S")
            ? cell({ tower: "S", floor: f.id }, f.level < 0 ? `${f.label} 地下室` : `${f.label} 店鋪 / 大廳`, true)
            : f.towers.map((t) => cell({ tower: t, floor: f.id }, `${t} ${floorLabel(f.id)}`)),
        )}
      </div>
    </div>
  );
}
