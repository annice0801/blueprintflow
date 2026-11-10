import "server-only";
import { extractText } from "./meeting-parse";
import type { Shift } from "./field";

/*
 * 班表解析：常見格式為「一列一人、一欄一天」，格內為班別代號（日、夜、早、中、晚、休、A、B…）。
 * Excel / CSV 依欄位對齊；PDF / Word / 文字依「姓名 + 一串代號」逐行讀取。結果供使用者預覽後才匯入。
 */

export type ParsedRow = { name: string; roleId: Shift["roleId"]; cells: string[] };
export type ParsedShifts = { year: number; month: number; days: number; rows: ParsedRow[]; codes: string[]; source: string };

const ROLE_HINT: [RegExp, Shift["roleId"]][] = [
  [/保全|警衛|門禁|守衛/, "guard"],
  [/清潔|環境|打掃/, "cleaner"],
  [/秘書|行政|櫃台/, "secretary"],
  [/(?<!社)區經理/, "area_manager"],
  [/總幹事|社區經理/, "gm"],
];
const HEADER_WORDS = /^(姓名|名字|人員|日期|星期|班別|崗位|職稱|月份|備註|合計|小計|休假|工時|保全|清潔|秘書|總幹事|區經理|[一二三四五六日])$/;
const fw = (s: string) => s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, " ").trim();
const isCode = (t: string) => /^([A-Za-z]{1,2}\d?|[日夜早中晚常休例特補假公病輪]|[-–—xX／/○●△✕]|OFF|off)$/.test(t);
const isName = (t: string) => /^[一-鿿]{2,4}$|^[A-Za-z][A-Za-z .]{1,15}$/.test(t) && !HEADER_WORDS.test(t) && !isCode(t);

function detectMonth(text: string, filename: string) {
  const src = `${filename} ${text.slice(0, 600)}`;
  const m = src.match(/(\d{3,4})\s*[年/.\-]\s*(\d{1,2})\s*月?/);
  if (m) {
    let y = Number(m[1]);
    if (y < 1911) y += 1911;
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return { year: y, month: mo };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** 從表格（二維字串）解析 */
export function parseGrid(grid: string[][], text: string, filename: string): ParsedShifts {
  const { year, month } = detectMonth(text, filename);
  const maxDays = new Date(year, month, 0).getDate();
  const rows = grid.map((r) => r.map((c) => fw(String(c ?? ""))));

  // 找日期列：一列裡出現 1、2、3…連號的格子
  let dayCols: number[] = [];
  for (const r of rows) {
    const cols: number[] = [];
    let expect = 1;
    r.forEach((c, i) => {
      if (/^\d{1,2}$/.test(c) && Number(c) === expect) {
        cols.push(i);
        expect++;
      }
    });
    if (cols.length >= 20) {
      dayCols = cols.slice(0, maxDays);
      break;
    }
  }

  const out: ParsedRow[] = [];
  let role: Shift["roleId"] = "guard";
  for (const r of rows) {
    const joined = r.join(" ");
    const nameIdx = r.findIndex((c, i) => isName(c) && (!dayCols.length || i < dayCols[0]));
    const hint = ROLE_HINT.find(([re]) => re.test(joined));
    if (nameIdx === -1) {
      if (hint) role = hint[1]; // 區段標題：「保全組」「清潔人員」
      continue;
    }
    let cells: string[];
    if (dayCols.length) cells = dayCols.map((c) => r[c] ?? "");
    else cells = r.slice(nameIdx + 1).filter((c) => isCode(c) || c === "");
    const filled = cells.filter(Boolean).length;
    if (filled < 5) {
      if (hint && filled === 0) role = hint[1];
      continue;
    }
    const rowRole = r.slice(0, nameIdx + 1).map((c) => ROLE_HINT.find(([re]) => re.test(c))?.[1]).find(Boolean);
    out.push({ name: r[nameIdx], roleId: rowRole ?? role, cells: cells.slice(0, maxDays).concat(Array(Math.max(0, maxDays - cells.length)).fill("")) });
  }
  const codes = [...new Set(out.flatMap((x) => x.cells).filter(Boolean))].sort();
  return { year, month, days: maxDays, rows: out, codes, source: filename };
}

export async function parseShiftFile(file: File): Promise<ParsedShifts> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const grid: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const v = cell.value as unknown;
        cells[col - 1] = v && typeof v === "object" && "richText" in (v as object) ? (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("") : v instanceof Date ? String(v.getDate()) : String(v ?? "");
      });
      grid.push(cells);
    });
    return parseGrid(grid, `${ws.name} ${grid.slice(0, 3).flat().join(" ")}`, file.name);
  }
  if (name.endsWith(".csv")) {
    const text = Buffer.from(await file.arrayBuffer()).toString("utf8").replace(/^﻿/, "");
    return parseGrid(text.split(/\r?\n/).map((l) => l.split(/,|\t/)), text, file.name);
  }
  const { text } = await extractText(file);
  return parseGrid(text.split(/\r?\n/).map((l) => fw(l).split(/[\s\t,|]+/).filter(Boolean)), text, file.name);
}
