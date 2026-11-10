import "server-only";
import { getZones, type TowerId } from "./buildings";
import type { Attendance, MeetingDraft, PlanRef, RoleId, TodoStatus } from "./mgmt";

/*
 * 會議紀錄規則式解析：依社區會議紀錄常見格式
 *  「代辦事項(n)…」前次會議追蹤、「待辦事項(n)…」本次新增、「【議題X】」「決議：」「請○○…」，
 *  民國日期（115/06/25、115 年 07 月 07 日），以及內文提到的公設 / 樓層 / 戶別。
 * 結果僅為草稿，由使用者在畫面上確認後才存檔。
 */

const CJK = "\\u4e00-\\u9fff";
const stripCjkSpaces = (s: string) => s.replace(new RegExp(`(?<=[${CJK}，。、：；（）【】])[ \\t\\u3000]+(?=[${CJK}，。、：；（）【】])`, "g"), "");

/* ── 日期 ── */

const pad = (n: number) => String(n).padStart(2, "0");
function ymd(y: number, m: number, d: number) {
  if (y < 1911) y += 1911;
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 找出文字中的第一個日期；沒有年份時用 baseYear */
export function findDate(text: string, baseYear?: number) {
  let m = text.match(/(\d{3,4})\s*[/年.-]\s*(\d{1,2})\s*[/月.-]\s*(\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = text.match(/(?<![\d.])(\d{1,2})\s*(?:\/|月)\s*(\d{1,2})(?![\d.])/);
  if (m && baseYear) return ymd(baseYear, +m[1], +m[2]);
  return "";
}

/* ── 角色 ── */

const ROLE_WORDS: [RegExp, RoleId][] = [
  [/副主任委員|副主委/, "vice"],
  [/主任委員|主委/, "chair"],
  [/財務委員/, "finance"],
  [/監察委員/, "audit"],
  [/(?<!社)區經理/, "area_manager"],
  [/社區經理|總幹事|管理中心|服務中心|管理總中心|管理室|物業/, "gm"],
  [/秘書/, "secretary"],
  [/保全/, "guard"],
  [/清潔/, "cleaner"],
  [/建商/, "builder"],
  [/廠商|保險公司|中華電信|電信|機電|工程/, "vendor"],
];

function rolesIn(text: string): RoleId[] {
  const out: RoleId[] = [];
  let rest = text;
  for (const [re, id] of ROLE_WORDS) {
    if (re.test(rest)) {
      out.push(id);
      rest = rest.replace(new RegExp(re.source, "g"), "");
    }
  }
  return out;
}

/* ── 地點 ── */

type Alias = { re: RegExp; floor: string; tower: TowerId; zone?: string; label?: string };
const ALIASES: Alias[] = [
  { re: /B\s*棟\s*(?:區域)?\s*(?:垃圾|資源回收)/, floor: "B1", tower: "S", zone: "B1-trashB" },
  { re: /垃圾|資源回收|冷凍室|冷藏室/, floor: "B1", tower: "S", zone: "B1-trashA" },
  { re: /防災中心|中控室/, floor: "B1", tower: "S", zone: "B1-fcc" },
  { re: /發電機/, floor: "B1", tower: "S", zone: "B1-gen" },
  { re: /電信機房/, floor: "B1", tower: "S", zone: "B1-tel" },
  { re: /台電配電|配電場所/, floor: "B1", tower: "S", zone: "B1-tpc" },
  { re: /無障礙車位/, floor: "B1", tower: "S", zone: "B1-carAcc" },
  { re: /機車(?:位|格|車位|停車)|腳踏車位?/, floor: "B1", tower: "S", zone: "B1-mC", label: "機車 / 腳踏車停車區" },
  { re: /車道|柵欄|跟車|尾隨|停車場入口/, floor: "1F", tower: "S", zone: "G-ramp" },
  { re: /地下室|地下停車場|停車場|汽車(?:車)?位/, floor: "B1", tower: "S", zone: "B1-aisle", label: "地下停車場" },
  { re: /頂樓|屋頂|屋突/, floor: "RF", tower: "A", zone: "A-roof-n", label: "頂樓" },
  { re: /健身房/, floor: "1F", tower: "S", zone: "G-lobby", label: "健身房" },
  { re: /兒童遊戲室/, floor: "1F", tower: "S", zone: "G-lobby", label: "兒童遊戲室" },
  { re: /大廳|門廳/, floor: "1F", tower: "S", zone: "G-lobby" },
  { re: /中庭|兒童遊戲區|草坪/, floor: "1F", tower: "S", zone: "G-court" },
  { re: /前庭|綠帶/, floor: "1F", tower: "S", zone: "G-garden" },
  { re: /人行道|行道樹/, floor: "1F", tower: "S", zone: "G-walk" },
  { re: /騎樓/, floor: "1F", tower: "S", zone: "G-arcade" },
  { re: /7-11|7-ELEVEN|超商|店面|店鋪|招牌/i, floor: "1F", tower: "S", zone: "G-arcade", label: "1F 店面" },
  { re: /B\s*棟\s*電梯/, floor: "1F", tower: "S", zone: "G-coreB", label: "B 棟電梯" },
  { re: /電梯/, floor: "1F", tower: "S", zone: "G-coreA", label: "電梯" },
  { re: /主入口|社區大門/, floor: "1F", tower: "S", zone: "G-entry" },
];

const r1 = (n: number) => Math.round(n * 10) / 10;

function refFor(floor: string, tower: TowerId, zoneId: string | undefined, label?: string): PlanRef | null {
  const zones = getZones(floor, tower);
  const z = zoneId ? zones.find((x) => x.id === zoneId) : undefined;
  if (zoneId && !z) return null;
  const at = z ?? zones[0];
  if (!at) return null;
  return { floor, tower, zoneId: z?.id, label: label ?? z?.label ?? floor, x: r1(at.x + at.w / 2), y: r1(at.y + at.h / 2) };
}

/** 戶別 / 樓層：A 棟 12 樓之 3、A3-12F、12F-A3、B 棟 8F */
function unitRefs(text: string): { ref: PlanRef; index: number }[] {
  const out: { ref: PlanRef; index: number }[] = [];
  const push = (t: string, f: number, u: string | undefined, index: number) => {
    if (f < 2 || f > 22) return;
    const tower = t.toUpperCase() as "A" | "B";
    const floor = `${f}F`;
    const ref = u ? refFor(floor, tower, `${tower}${u}`, `${tower} 棟 ${floor} ${tower}${u}`) : refFor(floor, tower, `${tower}-C1`, `${tower} 棟 ${floor} 梯廳`);
    if (ref) out.push({ ref, index });
  };
  for (const m of text.matchAll(/([AB])\s*棟\s*(\d{1,2})\s*(?:F|樓)(?:\s*之?\s*([1235-7])(?:號|戶)?)?/gi)) push(m[1], +m[2], m[3], m.index!);
  for (const m of text.matchAll(/(?<![A-Z0-9])([AB])([1235-7])\s*[-－]\s*(\d{1,2})\s*F/gi)) push(m[1], +m[3], m[2], m.index!);
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})\s*F\s*[-－]\s*([AB])([1235-7])(?!\d)/gi)) push(m[2], +m[1], m[3], m.index!);
  return out;
}

function locationsIn(text: string): { ref: PlanRef; index: number }[] {
  const found = unitRefs(text);
  for (const a of ALIASES) {
    const m = text.match(a.re);
    if (!m) continue;
    // 同一個區域只取最先出現（較具體）的別名，例如「B 棟垃圾」優先於「垃圾」
    if (found.some((f) => f.ref.zoneId === a.zone && f.ref.floor === a.floor)) continue;
    const ref = refFor(a.floor, a.tower, a.zone, a.label);
    if (ref) found.push({ ref, index: m.index! });
  }
  return found;
}

const locKey = (r: PlanRef) => `${r.floor}|${r.tower}|${r.zoneId ?? ""}|${r.label}`;

/* ── 主流程 ── */

const ITEM = /^(代辦事項|待辦事項)\s*[(（]\s*(\d+)\s*[)）]\s*(.*)$/;
const MARKER = /^(代辦事項|待辦事項)\s*[(（]|^【|^[一二三四五六七八九十]+、|^[壹貳參肆伍陸柒捌玖拾]+、|^決議|^討論|^說明|^⚫|^待討論事項/;
const DONE = /完成|已(?:於|將|列入|回覆|上傳|公告|維修|處理|繳|簽|寄|送|開立|改善)|上傳至|公告完成/;
const PENDING = /待確認|尚未|再行確認|預計|待(?:廠商|回覆|安裝)/;
const ASK = /請(?:社區經理|總幹事|秘書|保全|清潔|管理中心|服務中心|管理總中心|監察委員|財務委員|副主任委員|主任委員|主委|建商|廠商)/;

export function parseMeeting(raw: string, source: "pdf" | "docx" | "txt", filename = ""): MeetingDraft {
  // 去頁碼、頁首分隔
  const lines = raw
    .split(/\r?\n/)
    .map((l) => stripCjkSpaces(l.trim()))
    .filter((l) => l && !/^-\s*\d+\s*-$/.test(l) && !/^=== p\d+$/.test(l));

  // PDF 的換行多為自動折行：上一行接近滿版（≥ 38 字）且這行不是新段落時合併
  const paras: string[] = [];
  for (const l of lines) {
    const prev = paras[paras.length - 1];
    if (source === "pdf" && prev && prev.length >= 38 && !MARKER.test(l) && !/^\d+[.、]/.test(l)) paras[paras.length - 1] = prev + l;
    else paras.push(l);
  }
  const flat = paras.join("\n");

  /* 會議資訊 */
  const titleLines: string[] = [];
  for (const p of paras.slice(0, 4)) {
    titleLines.push(p);
    if (/紀錄|記錄/.test(p)) break;
  }
  const title = titleLines.join(" ").replace(/\s+/g, " ").slice(0, 80) || filename.replace(/\.[^.]+$/, "");

  const timeLine = flat.match(/會議時間[：:]?\s*\n?([^\n]+)/)?.[1] ?? "";
  const fnDate = filename.match(/(1\d{2})(\d{2})(\d{2})/);
  const date = findDate(timeLine) || (fnDate ? ymd(+fnDate[1], +fnDate[2], +fnDate[3]) : "") || findDate(flat.slice(0, 400));
  const year = date ? Number(date.slice(0, 4)) : new Date().getFullYear();
  const place = (flat.match(/會議地點[：:]?\s*\n?([^\n]+)/)?.[1] ?? "").trim().slice(0, 60);
  const type: MeetingDraft["type"] = /臨時會/.test(title)
    ? "管委會臨時會"
    : /區分所有權人|區權|區大/.test(title)
      ? "區分所有權人會議"
      : /協商/.test(title)
        ? "建商協商會議"
        : /例行|例會|管理委員會/.test(title)
          ? "管委會例會"
          : "其他";

  /* 待辦事項 */
  const todos: MeetingDraft["todos"] = [];
  let prevSection = false; // 「前次會議代辦事項」區段
  let cur: { title: string; notes: string[]; prev: boolean } | null = null;
  const flush = () => {
    if (!cur) return;
    // 折行合併後，標題第一個句號之後多半是辦理情形
    const cut = cur.title.indexOf("。");
    if (cut !== -1 && cut < cur.title.length - 1) {
      cur.notes.unshift(cur.title.slice(cut + 1));
      cur.title = cur.title.slice(0, cut);
    }
    const body = cur.notes.join("\n");
    const titleText = (cur.title || cur.notes[0] || "").replace(/[。.]$/, "");
    if (titleText) {
      const all = `${titleText}\n${body}`;
      const last = cur.notes[cur.notes.length - 1] ?? "";
      const done = cur.prev && DONE.test(last) && !PENDING.test(last);
      const status: TodoStatus = done ? "已完成" : cur.prev && body ? "進行中" : "未開始";
      const loc = locationsIn(all)[0]?.ref;
      todos.push({
        title: titleText.slice(0, 80),
        description: (cur.title ? body : cur.notes.slice(1).join("\n")).slice(0, 2000),
        assignees: rolesIn(titleText).length ? rolesIn(titleText) : rolesIn(all).length ? rolesIn(all).slice(0, 2) : ["gm"],
        due: findDate(done ? body : all, year),
        status,
        ...(loc && { location: loc }),
      });
    }
    cur = null;
  };

  for (const p of paras) {
    if (/前次會議|代辦事項\)|行政事務報告/.test(p) && !ITEM.test(p)) prevSection = true;
    if (/議題討論|^捌、/.test(p)) {
      flush();
      prevSection = false;
    }
    const m = p.match(ITEM);
    if (m) {
      flush();
      cur = { title: m[3].trim(), notes: [], prev: m[1] === "代辦事項" && prevSection };
      continue;
    }
    if (cur) {
      if (/^【|^[壹貳參肆伍陸柒捌玖拾]+、/.test(p)) flush();
      else {
        cur.notes.push(p);
        continue;
      }
    }
  }
  flush();

  // 「請○○…」句子：未被待辦事項涵蓋者列為建議待辦
  const known = todos.map((t) => t.title + t.description).join("\n");
  for (const p of paras) {
    if (ITEM.test(p)) continue;
    for (const s of p.split(/(?<=[。；])/)) {
      const sentence = s.replace(/^[\d.、()（）\s]+|^(決議|討論|說明)[：:]/g, "").trim();
      if (sentence.length < 8 || !ASK.test(sentence)) continue;
      const core = sentence.slice(sentence.search(ASK), sentence.search(ASK) + 18);
      if (known.includes(core)) continue;
      const loc = locationsIn(sentence)[0]?.ref;
      todos.push({
        title: sentence.replace(/[。；]$/, "").slice(0, 80),
        description: "（由會議紀錄「請○○」語句建議）",
        assignees: rolesIn(sentence.slice(sentence.search(ASK))).slice(0, 2),
        due: findDate(sentence, year),
        status: "未開始",
        ...(loc && { location: loc }),
      });
    }
  }

  /* 提到的地點（彙整原文片段） */
  const byLoc = new Map<string, { ref: PlanRef; snippets: string[] }>();
  for (const p of paras) {
    for (const { ref, index } of locationsIn(p)) {
      const k = locKey(ref);
      const entry = byLoc.get(k) ?? { ref, snippets: [] };
      const snip = p.slice(Math.max(0, index - 24), index + 56).replace(/\s+/g, " ");
      if (entry.snippets.length < 3 && !entry.snippets.some((x) => x === snip)) entry.snippets.push(snip);
      byLoc.set(k, entry);
    }
  }
  const mentions = [...byLoc.values()].map(({ ref, snippets }) => ({ ...ref, snippet: snippets.join(" ⋯ ") }));

  /* 職務名單（例：主任委員 高逸青、社區經理 郭芷嫻） */
  const roleText = stripCjkSpaces(paras.join("、"));
  const roleNames: MeetingDraft["roleNames"] = [];
  const seen = new Set<string>();
  const members: string[] = [];
  const NAME = `([${CJK}]{2,3}?)(?=[、，,。\\s)）]|$|(?:副主任|主任|財務|監察|一般)委員|社區經理|總幹事|秘書)`;
  const pairs: [RegExp, RoleId | "member"][] = [
    [new RegExp(`副主任委員[：:、]?${NAME}`, "g"), "vice"],
    [new RegExp(`(?<!副)主任委員[：:、]?${NAME}`, "g"), "chair"],
    [new RegExp(`財務委員[：:、]?${NAME}`, "g"), "finance"],
    [new RegExp(`監察委員[：:、]?${NAME}`, "g"), "audit"],
    [new RegExp(`一般委員[：:、]?${NAME}`, "g"), "member"],
    [new RegExp(`(?:社區經理|總幹事)[：:、]?${NAME}`, "g"), "gm"],
    [new RegExp(`秘書[：:、]?${NAME}`, "g"), "secretary"],
  ];
  const STOP = /^(共|名|代為|審閱|出席|請假|列席|如下|負責|職務)/;
  for (const [re, id] of pairs) {
    for (const m of roleText.matchAll(re)) {
      const name = m[1];
      if (STOP.test(name)) continue;
      if (id === "member") {
        if (!members.includes(name)) members.push(name);
      } else if (!seen.has(id)) {
        seen.add(id);
        roleNames.push({ id, name });
      }
    }
  }
  const taken = new Set(roleNames.map((r) => r.name));
  members
    .filter((n) => !taken.has(n))
    .slice(0, 3)
    .forEach((name, i) => roleNames.push({ id: `member${i + 1}` as RoleId, name }));

  const termName = (title + flat.slice(0, 200)).match(/第\s*([一二三四五六七八九十\d]+)\s*屆/)?.[0].replace(/\s/g, "") ?? "";

  return { title, type, date, place, mentions, todos, roleNames, termName, attendance: parseAttendance(paras) };
}

/* ── 出缺席 ── */

const ATT_LABEL: [RegExp, Attendance["status"]][] = [
  [/^出席(?:人員|委員)?/, "出席"],
  [/^請假(?:人員|委員)?/, "請假"],
  [/^缺席(?:人員|委員)?/, "缺席"],
  [/^列席(?:人員|委員)?/, "列席"],
  [/^(?:會議)?[紀記]錄(?:人員)?/, "紀錄"],
];
const TITLE = /^(副主任委員|主任委員|財務委員|監察委員|一般委員|社區經理|總幹事|秘書)/;

/** 會議開頭的出席 / 請假 / 列席名單（PDF 一行一欄，Word 常為表格逐格） */
function parseAttendance(paras: string[]): Attendance[] {
  const out: Attendance[] = [];
  let mode: Attendance["status"] | null = null;
  let prevMode: Attendance["status"] | null = null;
  const push = (raw: string, status: Attendance["status"]) => {
    const token = raw.replace(/^[(（]?[\d一二三四五六七八九十壹貳參肆伍陸柒捌玖拾]+[、.)）]\s*/, "").trim();
    if (!token) return;
    let title = token.match(TITLE)?.[1] ?? "";
    let name = title ? token.slice(title.length) : token;
    // 「皇家國際物業處長黃士彰」：職稱在前，取最後 2–3 字為姓名
    const tail = name.match(/^(.+?(?:處長|經理|主任|代表|技師|律師|里長|委員))([一-鿿]{2,3})$/);
    if (tail) {
      title = title || tail[1];
      name = tail[2];
    }
    if (!/^[一-鿿]{2,4}$/.test(name) || /^(如下|名單|人員|委員|會議)/.test(name)) return;
    if (!out.some((a) => a.name === name)) out.push({ name, status, title });
  };
  for (const p of paras.slice(0, 40)) {
    if (/議題|報到|主席致詞|^一、/.test(p)) break;
    const body = p.replace(/^[壹貳參肆伍陸柒捌玖拾一二三四五六七八九十]+、\s*/, "");
    const label = ATT_LABEL.find(([re]) => re.test(body));
    if (label) {
      if (label[1] !== "紀錄") prevMode = label[1];
      mode = label[1];
      const rest = body.replace(label[0], "").replace(/^[：:\s]+/, "");
      for (const t of rest.split(/[、，,]/)) push(t, mode);
      if (mode === "紀錄" && rest) mode = prevMode;
      continue;
    }
    if (!mode || /[：:]/.test(body)) {
      if (/[：:]/.test(body)) mode = null;
      continue;
    }
    for (const t of body.split(/[、，,]/)) push(t, mode);
    if (mode === "紀錄") mode = prevMode; // 紀錄人員只佔一格
  }
  return out;
}

/** 從上傳檔案取出純文字 */
export async function extractText(file: File, opts: { ocr?: boolean } = {}): Promise<{ text: string; source: "pdf" | "docx" | "txt"; ocr?: boolean }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return { text: value, source: "docx" };
  }
  if (name.endsWith(".pdf")) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(pdf, { mergePages: false });
    const joined = (text as string[]).join("\n");
    // 掃描檔沒有文字層：改用 OCR 辨識
    if (opts.ocr && !joined.trim()) {
      const { ocrPdf } = await import("./ocr");
      return { text: await ocrPdf(buf), source: "pdf", ocr: true };
    }
    return { text: joined, source: "pdf" };
  }
  if (/\.(txt|md)$/.test(name)) return { text: buf.toString("utf8"), source: "txt" };
  throw new Error("僅支援 .docx、.pdf、.txt 檔");
}
