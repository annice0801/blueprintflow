// 月報 / 年報彙整（畫面與 Excel 匯出共用）
import type { Announcement, FieldLog, Reservation, Visitor } from "./field";
import { RES_TYPES, LOG_TYPES } from "./field";
import { roleOf, type Meeting, type RoleGroup, type Todo, type Vendor } from "./mgmt";

export type ReportData = { todos: Todo[]; meetings: (Omit<Meeting, "text"> & Partial<Pick<Meeting, "text">>)[]; reservations: Reservation[]; visitors: Visitor[]; fieldlogs: FieldLog[]; vendors: Vendor[]; announcements: Announcement[] };

/** period：2026-10（月）或 2026（年） */
export function periodRange(period: string) {
  if (/^\d{4}$/.test(period)) return { from: `${period}-01-01`, to: `${period}-12-31`, label: `${Number(period) - 1911} 年度`, yearly: true };
  const [y, m] = period.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}`, label: `${y - 1911} 年 ${m} 月`, yearly: false };
}

export function doneDate(t: Todo) {
  if (t.status !== "已完成") return "";
  const hit = [...t.log].reverse().find((l) => l.text.includes("→ 已完成"));
  return hit ? hit.at.slice(0, 10) : t.due || t.start || t.updatedAt.slice(0, 10);
}

const money = (s: string) => {
  const m = s.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
};

export function buildReport(d: ReportData, period: string) {
  const { from, to, label, yearly } = periodRange(period);
  const inP = (date: string) => !!date && date.slice(0, 10) >= from && date.slice(0, 10) <= to;
  const groups: RoleGroup[] = ["管委會", "物業", "建商", "外包廠商"];

  const created = d.todos.filter((t) => inP(t.createdAt));
  const completed = d.todos.filter((t) => inP(doneDate(t)));
  const overdue = d.todos.filter((t) => t.due && t.due <= to && t.status !== "已完成" && t.status !== "暫緩" && t.due >= "2000");
  const byGroup = groups.map((g) => ({
    group: g,
    created: created.filter((t) => t.assignees.some((r) => roleOf(r).group === g)).length,
    completed: completed.filter((t) => t.assignees.some((r) => roleOf(r).group === g)).length,
    open: d.todos.filter((t) => t.status !== "已完成" && t.status !== "暫緩" && t.assignees.some((r) => roleOf(r).group === g)).length,
  }));

  const meetings = d.meetings.filter((m) => inP(m.date)).sort((a, b) => a.date.localeCompare(b.date));
  const committee = meetings.filter((m) => m.type === "管委會例會" || m.type === "管委會臨時會");
  const people = new Map<string, { name: string; title: string; present: number; leave: number; total: number }>();
  for (const m of committee)
    for (const a of m.attendance ?? []) {
      if (a.status === "列席" || a.status === "紀錄") continue;
      const e = people.get(a.name) ?? { name: a.name, title: a.title, present: 0, leave: 0, total: 0 };
      e.total++;
      if (a.status === "出席") e.present++;
      else if (a.status === "請假") e.leave++;
      people.set(a.name, e);
    }

  const res = d.reservations.filter((r) => inP(r.start));
  const resByType = RES_TYPES.map((t) => {
    const list = res.filter((r) => r.type === t);
    return {
      type: t,
      total: list.length,
      done: list.filter((r) => r.status === "已完成" || r.status === "使用中").length,
      noShow: list.filter((r) => r.status === "未到").length,
      cancelled: list.filter((r) => r.status === "已取消" || r.status === "已退回").length,
      points: list.reduce((s, r) => s + r.points.charged, 0),
      fee: list.reduce((s, r) => s + r.points.fee, 0),
    };
  });
  const feeByUnit = [...new Set(res.filter((r) => r.points.fee).map((r) => r.unitId))].map((u) => ({
    unitId: u,
    overflow: res.filter((r) => r.unitId === u).reduce((s, r) => s + r.points.overflow, 0),
    fee: res.filter((r) => r.unitId === u).reduce((s, r) => s + r.points.fee, 0),
  }));

  const records = d.vendors.flatMap((v) => (v.records ?? []).filter((r) => inP(r.date)).map((r) => ({ ...r, vendor: v.name, category: v.category })));
  const logs = d.fieldlogs.filter((l) => inP(l.at));
  const anns = d.announcements.filter((a) => inP(a.createdAt));

  // 年報：逐月
  const months = yearly
    ? Array.from({ length: 12 }, (_, i) => {
        const p = `${from.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`;
        const r = periodRange(p);
        const inM = (date: string) => !!date && date.slice(0, 10) >= r.from && date.slice(0, 10) <= r.to;
        return {
          month: i + 1,
          todosDone: d.todos.filter((t) => inM(doneDate(t))).length,
          todosNew: d.todos.filter((t) => inM(t.createdAt)).length,
          meetings: d.meetings.filter((m) => inM(m.date)).length,
          reservations: d.reservations.filter((x) => inM(x.start) && !["已取消", "已退回"].includes(x.status)).length,
          logs: d.fieldlogs.filter((l) => inM(l.at)).length,
          repairCost: d.vendors.flatMap((v) => v.records ?? []).filter((x) => inM(x.date)).reduce((s, x) => s + money(x.cost), 0),
        };
      })
    : [];

  return {
    period,
    label,
    from,
    to,
    yearly,
    todos: { created: created.length, completed: completed.length, overdue: overdue.length, byGroup, completedList: completed, overdueList: overdue },
    meetings: { list: meetings, committee: committee.length, attendance: [...people.values()].sort((a, b) => b.present / b.total - a.present / a.total) },
    reservations: { total: res.filter((r) => !["已取消", "已退回"].includes(r.status)).length, byType: resByType, feeByUnit, fee: resByType.reduce((s, x) => s + x.fee, 0), points: resByType.reduce((s, x) => s + x.points, 0), list: res },
    visitors: d.visitors.filter((v) => inP(v.inAt)).length,
    logs: { total: logs.length, byType: LOG_TYPES.map((t) => ({ type: t, n: logs.filter((l) => l.type === t).length })), list: logs },
    records: { list: records, cost: records.reduce((s, r) => s + money(r.cost), 0) },
    announcements: { created: anns.length, posted: anns.filter((a) => a.status === "已張貼" || a.status === "已撤下").length, list: anns },
    months,
  };
}

export type Report = ReturnType<typeof buildReport>;
