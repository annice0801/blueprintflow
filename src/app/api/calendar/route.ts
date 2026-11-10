import type { NextRequest } from "next/server";
import { unitLabel } from "@/lib/buildings";
import type { Announcement, Reservation } from "@/lib/field";
import { buildIcs, type CalEvent } from "@/lib/ics";
import { plansOf } from "@/lib/inspection-forms";
import { nextDue } from "@/lib/inspections";
import { roleOf, type Meeting, type Todo, type Vendor } from "@/lib/mgmt";
import { readCollection } from "@/lib/store";

/**
 * 社區行事曆訂閱來源（Google 日曆「從網址新增」）：
 * 待辦期限、會議、預約、合約到期、公告期間、年度檢測期限。上線後外部才連得到。
 */
export async function GET(request: NextRequest) {
  const buildingId = request.nextUrl.searchParams.get("buildingId") ?? "blueprint";
  const events: CalEvent[] = [];
  for (const t of await readCollection<Todo>("todos"))
    if (t.buildingId === buildingId && t.due && t.status !== "已完成" && t.status !== "暫緩")
      events.push({ uid: `todo-${t.id}`, title: `⏰ 待辦期限：${t.title}`, start: t.due, description: `追蹤者：${t.assignees.map((r) => roleOf(r).short).join("、")}\n${t.description}`, location: t.location?.label });
  for (const m of await readCollection<Meeting>("meetings"))
    if (m.buildingId === buildingId && m.date) events.push({ uid: `meeting-${m.id}`, title: `📄 ${m.title}`, start: m.date, location: m.place });
  for (const r of await readCollection<Reservation>("reservations"))
    if (r.buildingId === buildingId && ["待審核", "已確認", "使用中"].includes(r.status))
      events.push({ uid: `res-${r.id}`, title: `${r.type}｜${unitLabel(r.unitId)}${r.status === "待審核" ? "（待審核）" : ""}`, start: r.start, end: r.end, alarmMinutes: 30 });
  for (const v of await readCollection<Vendor>("vendors"))
    if (v.buildingId === buildingId && v.contractEnd) events.push({ uid: `contract-${v.id}`, title: `📑 合約到期：${v.name}`, start: v.contractEnd, alarmMinutes: 60 * 24 * 30 });
  for (const a of await readCollection<Announcement>("announcements"))
    if (a.buildingId === buildingId && a.fields.start && a.status !== "已撤下") events.push({ uid: `ann-${a.id}`, title: `📢 ${a.zh.title}`, start: a.fields.start, end: a.fields.end || undefined, location: a.fields.area });
  for (const p of await plansOf(buildingId)) {
    const due = p.enabled && nextDue(p);
    if (due) events.push({ uid: `insp-${p.id.replace(":", "-")}-${due}`, title: `🧯 ${p.level}檢測期限：${p.name}`, start: due, description: [p.how, p.basis, p.authority].filter(Boolean).join("\n"), alarmMinutes: 60 * 24 * 30 });
  }
  return new Response(buildIcs(events), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
}
