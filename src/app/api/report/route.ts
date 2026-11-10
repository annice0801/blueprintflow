import { dataScope } from "@/lib/auth";
import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { unitLabel } from "@/lib/buildings";
import type { Announcement, FieldLog, Reservation, Visitor } from "@/lib/field";
import { roleOf, type Meeting, type Todo, type Vendor } from "@/lib/mgmt";
import { buildReport, doneDate } from "@/lib/report";
import { readCollection } from "@/lib/store";

const HEAD: Partial<ExcelJS.Style> = { font: { bold: true, color: { argb: "FFFFFFFF" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E7490" } } };

function sheet(wb: ExcelJS.Workbook, name: string, cols: [string, number][], rows: (string | number)[][]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map(([header, width]) => ({ header, width }));
  ws.getRow(1).eachCell((c) => Object.assign(c, { style: HEAD }));
  for (const r of rows) ws.addRow(r).alignment = { vertical: "top", wrapText: true };
  if (!rows.length) ws.addRow(["（本期無資料）"]);
}

/** 月報 / 年報 Excel：?period=2026-10 或 2026 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const buildingId = dataScope(request);
  const period = /^\d{4}(-\d{2})?$/.test(q.get("period") ?? "") ? q.get("period")! : new Date().toISOString().slice(0, 7);
  const mine = <T extends { buildingId: string }>(l: T[]) => l.filter((x) => x.buildingId === buildingId);
  const r = buildReport(
    {
      todos: mine(await readCollection<Todo>("todos")),
      meetings: mine(await readCollection<Meeting>("meetings")),
      reservations: mine(await readCollection<Reservation>("reservations")),
      visitors: mine(await readCollection<Visitor>("visitors")),
      fieldlogs: mine(await readCollection<FieldLog>("fieldlogs")),
      vendors: mine(await readCollection<Vendor>("vendors")),
      announcements: mine(await readCollection<Announcement>("announcements")),
    },
    period,
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Blueprintflow";
  sheet(wb, "摘要", [["項目", 28], ["數值", 18]], [
    ["期間", `${r.label}（${r.from} ～ ${r.to}）`],
    ["新增待辦", r.todos.created],
    ["完成待辦", r.todos.completed],
    ["逾期未完成（期末）", r.todos.overdue],
    ["會議場次（管委會）", r.meetings.committee],
    ["預約總數（不含取消）", r.reservations.total],
    ["公設扣點", r.reservations.points],
    ["管理費加收（點數不足）", r.reservations.fee],
    ["訪客人次", r.visitors],
    ["值班紀錄", r.logs.total],
    ["維修 / 保養紀錄", r.records.list.length],
    ["維修費用合計", r.records.cost],
    ["公告（新增 / 已張貼）", `${r.announcements.created} / ${r.announcements.posted}`],
  ]);
  if (r.yearly)
    sheet(wb, "逐月", [["月份", 8], ["新增待辦", 10], ["完成待辦", 10], ["會議", 8], ["預約", 8], ["值班紀錄", 10], ["維修費用", 12]], r.months.map((m) => [`${m.month} 月`, m.todosNew, m.todosDone, m.meetings, m.reservations, m.logs, m.repairCost]));
  sheet(wb, "各單位待辦", [["單位", 12], ["本期新增", 10], ["本期完成", 10], ["目前未完成", 12]], r.todos.byGroup.map((g) => [g.group, g.created, g.completed, g.open]));
  sheet(wb, "完成待辦", [["完成日", 12], ["待辦事項", 50], ["追蹤者", 20]], r.todos.completedList.map((t) => [doneDate(t), t.title, t.assignees.map((x) => roleOf(x).short).join("、")]));
  sheet(wb, "逾期待辦", [["期限", 12], ["待辦事項", 50], ["追蹤者", 20], ["狀態", 10]], r.todos.overdueList.map((t) => [t.due, t.title, t.assignees.map((x) => roleOf(x).short).join("、"), t.status]));
  sheet(wb, "會議出席", [["姓名", 12], ["職稱", 14], ["出席", 8], ["請假", 8], ["場次", 8], ["出席率", 10]], r.meetings.attendance.map((a) => [a.name, a.title, a.present, a.leave, a.total, `${Math.round((a.present / a.total) * 100)}%`]));
  sheet(wb, "預約統計", [["類型", 12], ["預約", 8], ["完成", 8], ["未到", 8], ["取消/退回", 10], ["扣點", 8], ["加收(元)", 10]], r.reservations.byType.map((x) => [x.type, x.total, x.done, x.noShow, x.cancelled, x.points, x.fee]));
  sheet(wb, "管理費加收明細", [["戶別", 18], ["不足點數", 10], ["加收金額(元)", 14]], r.reservations.feeByUnit.map((x) => [unitLabel(x.unitId), x.overflow, x.fee]));
  sheet(wb, "維修紀錄", [["日期", 12], ["廠商", 20], ["類別", 12], ["類型", 8], ["項目", 36], ["費用", 12], ["處理結果", 30]], r.records.list.map((x) => [x.date, x.vendor, x.category, x.type, x.title, x.cost, x.result]));
  sheet(wb, "值班日誌", [["時間", 16], ["類型", 10], ["內容", 50], ["位置", 18], ["填寫人", 14]], r.logs.list.map((l) => [l.at.replace("T", " "), l.type, l.text, l.location?.label ?? "", l.by]));
  sheet(wb, "公告", [["建立日", 12], ["公告", 30], ["狀態", 10], ["期間", 30], ["張貼", 10]], r.announcements.list.map((a) => [a.createdAt.slice(0, 10), a.zh.title, a.status, `${a.fields.start} ～ ${a.fields.end}`, `${a.postings.filter((p) => p.postedAt).length}/${a.postings.length}`]));

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`藍圖社區${r.label}報表.xlsx`)}`,
    },
  });
}
