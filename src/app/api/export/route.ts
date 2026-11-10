import path from "path";
import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { FLOOR_ORDER, getBuilding, SHOPS } from "@/lib/buildings";
import type { GateLog, Plant, Shop } from "@/lib/records";
import { CATEGORIES, SEVERITIES, STATUSES, TOWER_LABEL, type Issue } from "@/lib/issues";
import { readCollection, readFileBuffer, readIssues } from "@/lib/store";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2545" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFB0BEC5" } },
  left: { style: "thin", color: { argb: "FFB0BEC5" } },
  bottom: { style: "thin", color: { argb: "FFB0BEC5" } },
  right: { style: "thin", color: { argb: "FFB0BEC5" } },
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = BORDER;
  });
}

function table(ws: ExcelJS.Worksheet, title: string, head: string[], rows: (string | number)[][]) {
  ws.addRow([title]).font = { bold: true, size: 13 };
  styleHeader(ws.addRow(head));
  for (const r of rows) ws.addRow(r).eachCell((c) => (c.border = BORDER));
  ws.addRow([]);
}

function simpleSheet(wb: ExcelJS.Workbook, name: string, cols: [string, number][], rows: (string | number)[][]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map(([header, width]) => ({ header, width }));
  styleHeader(ws.getRow(1));
  for (const r of rows) {
    const row = ws.addRow(r);
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell({ includeEmpty: true }, (c) => (c.border = BORDER));
  }
  if (!rows.length) ws.addRow(["（尚無資料）"]);
}

const count = <K extends string>(issues: Issue[], key: (i: Issue) => K, keys: readonly K[]) =>
  keys.map((k) => [k, issues.filter((i) => key(i) === k).length] as [K, number]);

export async function GET(request: NextRequest) {
  const buildingId = request.nextUrl.searchParams.get("buildingId") ?? "";
  const building = getBuilding(buildingId);
  if (!building) return Response.json({ error: "找不到建築物" }, { status: 404 });

  const issues = (await readIssues())
    .filter((i) => i.buildingId === buildingId)
    .sort((a, b) => a.tower.localeCompare(b.tower) || FLOOR_ORDER(a.floor) - FLOOR_ORDER(b.floor) || a.createdAt.localeCompare(b.createdAt));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Blueprintflow";
  wb.created = new Date();

  // ── 統計總表 ──
  const sum = wb.addWorksheet("統計總表");
  sum.columns = [{ width: 18 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }];
  sum.addRow([`${building.name} 問題統計表`]).font = { bold: true, size: 16 };
  sum.addRow([`匯出時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}　問題總數：${issues.length}`]);
  sum.addRow([]);

  table(sum, "依狀態", ["狀態", "數量"], count(issues, (i) => i.status, STATUSES));
  table(sum, "依嚴重程度", ["嚴重程度", "數量"], count(issues, (i) => i.severity, SEVERITIES));
  table(sum, "依類別", ["類別", "數量"], count(issues, (i) => i.category, CATEGORIES));

  const floorRows = building.floors
    .flatMap((f) => f.towers.map((t) => ({ f, t })))
    .map(({ f, t }) => {
      const list = issues.filter((i) => i.floor === f.id && i.tower === t);
      return [
        `${TOWER_LABEL[t]} ${f.label}`,
        list.length,
        ...STATUSES.map((s) => list.filter((i) => i.status === s).length),
        list.filter((i) => i.severity === "高").length,
      ];
    })
    .filter((r) => (r[1] as number) > 0);
  table(sum, "依棟別樓層", ["棟別 / 樓層", "總數", ...STATUSES, "高嚴重"], floorRows.length ? floorRows : [["（尚無問題）", 0, 0, 0, 0, 0]]);

  // ── 問題明細 ──
  const det = wb.addWorksheet("問題明細", { views: [{ state: "frozen", ySplit: 1 }] });
  det.columns = [
    { header: "編號", key: "no", width: 6 },
    { header: "棟別", key: "tower", width: 8 },
    { header: "樓層", key: "floor", width: 8 },
    { header: "戶別 / 區域", key: "zone", width: 14 },
    { header: "類別", key: "category", width: 12 },
    { header: "嚴重程度", key: "severity", width: 10 },
    { header: "狀態", key: "status", width: 10 },
    { header: "標題", key: "title", width: 24 },
    { header: "說明", key: "description", width: 40 },
    { header: "照片數", key: "photoCount", width: 8 },
    { header: "照片", key: "photo", width: 18 },
    { header: "建立時間", key: "createdAt", width: 18 },
    { header: "更新時間", key: "updatedAt", width: 18 },
  ];
  styleHeader(det.getRow(1));

  const fmt = (iso: string) => new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
  const origin = request.nextUrl.origin;
  const SEV_COLOR: Record<string, string> = { 高: "FFFFCDD2", 中: "FFFFF3C4", 低: "FFE3F2FD" };

  for (const [idx, i] of issues.entries()) {
    const row = det.addRow({
      no: idx + 1,
      tower: TOWER_LABEL[i.tower],
      floor: i.floor === "RF" ? "R 樓" : i.floor,
      zone: i.zone,
      category: i.category,
      severity: i.severity,
      status: i.status,
      title: i.title,
      description: i.description,
      photoCount: i.photos.length,
      createdAt: fmt(i.createdAt),
      updatedAt: fmt(i.updatedAt),
    });
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell({ includeEmpty: true }, (c) => (c.border = BORDER));
    row.getCell("severity").fill = { type: "pattern", pattern: "solid", fgColor: { argb: SEV_COLOR[i.severity] } };

    // 第一張照片做縮圖，其餘以連結列出
    const first = i.photos[0];
    const ext = first && path.extname(first).slice(1).replace("jpg", "jpeg");
    if (first && (ext === "jpeg" || ext === "png" || ext === "gif")) {
      try {
        const buffer = await readFileBuffer("uploads", first);
        if (!buffer) throw new Error("missing");
        const imageId = wb.addImage({ buffer: buffer as unknown as ExcelJS.Buffer, extension: ext });
        row.height = 80;
        det.addImage(imageId, { tl: { col: 10.1, row: row.number - 1 + 0.1 }, ext: { width: 110, height: 100 }, editAs: "oneCell" });
      } catch {
        /* 照片遺失就略過縮圖 */
      }
    }
    if (i.photos.length) {
      row.getCell("photoCount").value = { text: String(i.photos.length), hyperlink: `${origin}/api/uploads/${i.photos[0]}` };
      row.getCell("photoCount").font = { color: { argb: "FF1565C0" }, underline: true };
    }
  }

  // ── 植栽與事件 ──
  const plants = (await readCollection<Plant>("plants")).filter((p) => p.buildingId === buildingId);
  const areaName = (id: string) => building.publicAreas.find((a) => a.id === id)?.name ?? id;
  simpleSheet(
    wb,
    "植栽事件紀錄",
    [["區域", 14], ["花圃", 12], ["植栽", 14], ["樹種", 16], ["狀態", 8], ["事件日期", 12], ["事件類型", 12], ["颱風", 10], ["當時狀況", 36], ["處理方式", 36], ["處理人", 12]],
    plants
      .sort((a, b) => a.areaId.localeCompare(b.areaId) || a.name.localeCompare(b.name, "zh-Hant"))
      .flatMap((p) => {
        const base = [areaName(p.areaId), p.bed, p.name, p.species, p.health];
        if (!p.events.length) return [[...base, "", "", "", "", "", ""]];
        return [...p.events]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((e) => [...base, e.date, e.type, e.typhoon, e.description, e.handling, e.handler]);
      }),
  );

  // ── 車道開關紀錄 ──
  const logs = (await readCollection<GateLog>("gate-logs")).filter((l) => l.buildingId === buildingId).sort((a, b) => b.at.localeCompare(a.at));
  simpleSheet(
    wb,
    "車道開關紀錄",
    [["時間", 18], ["道閘", 8], ["動作", 10], ["操作人", 14], ["備註", 40]],
    logs.map((l) => [l.at.replace("T", " "), l.gate, l.action, l.operator, l.note]),
  );

  // ── 店鋪經營 ──
  const shops = new Map((await readCollection<Shop>("shops")).filter((s) => s.buildingId === buildingId).map((s) => [s.id, s]));
  simpleSheet(
    wb,
    "店鋪經營",
    [["店鋪", 10], ["店名", 18], ["業種", 14], ["經營狀態", 10], ["營業時間", 22], ["店家電話", 14], ["聯絡人", 12], ["備註", 30]],
    SHOPS.map((z) => {
      const s = shops.get(z.id);
      return [z.label, s?.shopName ?? "", s?.business ?? "", s?.status ?? "未登錄", s?.hours ?? "", s?.phone ?? "", s?.contact ?? "", s?.note ?? ""];
    }),
  );

  const buf = await wb.xlsx.writeBuffer();
  const filename = `${building.name}_問題統計_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="blueprintflow.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
