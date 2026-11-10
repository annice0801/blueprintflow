// 公告文字產生：依模板與欄位同時產生中文、英文版（不需外部翻譯服務；補充說明的英文需手動輸入）
import type { Announcement, AnnTemplate } from "./field";

export const TEMPLATE_INFO: Record<AnnTemplate, { zh: string; en: string; icon: string; accent: string; work?: [string, string]; impact?: [string, string] }> = {
  elevator: {
    zh: "電梯維修保養公告",
    en: "Elevator Maintenance Notice",
    icon: "🛗",
    accent: "#2563eb",
    work: ["電梯維修保養", "Elevator maintenance"],
    impact: ["該部電梯將暫停使用，請改搭其他電梯或樓梯", "The affected elevator will be out of service. Please use the other elevator or the stairs."],
  },
  construction: {
    zh: "施工公告",
    en: "Construction Notice",
    icon: "🚧",
    accent: "#f59e0b",
    work: ["工程施工", "Construction work"],
    impact: ["施工期間可能產生噪音與粉塵", "There may be noise and dust during the work."],
  },
  water: {
    zh: "停水公告",
    en: "Water Supply Interruption",
    icon: "💧",
    accent: "#0ea5e9",
    work: ["停水作業", "Water supply interruption"],
    impact: ["期間將暫停供水，請提前儲水備用", "Water supply will be suspended. Please store water in advance."],
  },
  power: {
    zh: "停電公告",
    en: "Power Outage Notice",
    icon: "⚡",
    accent: "#eab308",
    work: ["停電作業", "Scheduled power outage"],
    impact: ["期間電梯及部分公共設備將暫停運轉，請提前做好準備", "Elevators and some common facilities will be unavailable. Please prepare in advance."],
  },
  typhoon: { zh: "颱風防範公告", en: "Typhoon Preparedness Notice", icon: "🌀", accent: "#14b8a6" },
  general: { zh: "公告", en: "Notice", icon: "📢", accent: "#06b6d4" },
  event: { zh: "活動公告", en: "Community Event", icon: "🎉", accent: "#a855f7" },
};

const WEEK_ZH = "日一二三四五六";
const WEEK_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 2026-10-30T09:00 → 115年10月30日（五）09:00 */
export function rocDate(dt: string) {
  if (!dt) return "";
  const d = new Date(dt.length > 10 ? dt : `${dt}T00:00`);
  const time = dt.length > 10 ? ` ${dt.slice(11, 16)}` : "";
  return `${d.getFullYear() - 1911}年${d.getMonth() + 1}月${d.getDate()}日（${WEEK_ZH[d.getDay()]}）${time}`;
}

export function enDate(dt: string) {
  if (!dt) return "";
  const d = new Date(dt.length > 10 ? dt : `${dt}T00:00`);
  const time = dt.length > 10 ? ` ${dt.slice(11, 16)}` : "";
  return `${WEEK_EN[d.getDay()]}, ${MON_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}${time}`;
}

const AREA_EN: [RegExp, string][] = [
  [/全社區|全區/g, "the entire community"],
  [/([AB])\s*棟/g, "Building $1 "],
  [/(\d+)\s*號電梯/g, "Elevator No.$1"],
  [/電梯/g, "Elevator"],
  [/大廳/g, "Lobby"],
  [/梯廳/g, "Elevator Hall"],
  [/車道/g, "Driveway"],
  [/地下室|地下停車場/g, "Basement Parking"],
  [/B(\d)/g, "B$1"],
  [/(\d+)\s*[F樓]/g, "$1F"],
  [/中庭/g, "Courtyard"],
  [/頂樓|屋頂/g, "Rooftop"],
  [/健身房/g, "Gym"],
  [/兒童遊戲室/g, "Kids' Playroom"],
  [/[、，]/g, ", "],
  [/及|與/g, " and "],
];

/** 常見地點詞彙轉英文；其餘保留原文供手動修改 */
export function areaToEn(zh: string) {
  let s = zh;
  for (const [re, en] of AREA_EN) s = s.replace(re, en);
  return s.replace(/\s+/g, " ").trim();
}

type GenInput = Pick<Announcement, "template" | "fields"> & { extraZh: string; extraEn: string };

/** 由模板 + 欄位產生中英文標題與內文 */
export function generateText({ template, fields, extraZh, extraEn }: GenInput): Pick<Announcement, "zh" | "en"> {
  const t = TEMPLATE_INFO[template];
  const period = fields.start ? `${rocDate(fields.start)}${fields.end ? ` 至 ${rocDate(fields.end)}` : ""}` : "";
  const periodEn = fields.start ? `from ${enDate(fields.start)}${fields.end ? ` to ${enDate(fields.end)}` : ""}` : "";
  const contact = fields.contact ? `管理中心 ${fields.contact}` : "管理中心";
  const contactEn = fields.contact ? `the Management Office at ${fields.contact}` : "the Management Office";
  let zh = "親愛的住戶您好：\n\n";
  let en = "Dear Residents,\n\n";

  if (template === "typhoon") {
    zh += `${period ? `${period}颱風可能影響本區，` : "颱風即將來襲，"}請住戶收妥陽台盆栽與雜物、關緊門窗，車輛請勿停放於低窪處。管理中心將加強巡查並關閉車道擋水閘門。`;
    en += `${periodEn ? `A typhoon may affect our area ${periodEn}. ` : "A typhoon is approaching. "}Please secure balcony plants and objects, close windows tightly, and avoid parking in low-lying areas. The Management Office will increase patrols and close the driveway flood barrier.`;
  } else if (t.work && t.impact) {
    zh += `訂於 ${period || "（日期）"}進行${t.work[0]}${fields.area ? `，範圍：${fields.area}` : ""}。${t.impact[0]}，造成不便，敬請見諒。`;
    en += `${t.work[1]} will take place ${periodEn || "(date)"}${fields.areaEn ? ` at ${fields.areaEn}` : ""}. ${t.impact[1]} We apologize for any inconvenience.`;
  } else if (template === "event") {
    zh += `${period ? `${period}` : ""}${fields.area ? `於${fields.area}` : ""}舉辦社區活動，歡迎住戶踴躍參加。`;
    en += `A community event will be held${periodEn ? ` ${periodEn}` : ""}${fields.areaEn ? ` at ${fields.areaEn}` : ""}. All residents are welcome to join.`;
  } else {
    zh += period ? `${period}${fields.area ? `，${fields.area}` : ""}：` : "";
    en += periodEn ? `${periodEn.replace(/^from/, "From")}${fields.areaEn ? `, ${fields.areaEn}` : ""}: ` : "";
  }

  if (extraZh.trim()) zh += `\n\n${extraZh.trim()}`;
  if (extraEn.trim()) en += `\n\n${extraEn.trim()}`;
  zh += `\n\n如有疑問，請洽${contact}。`;
  en += `\n\nFor inquiries, please contact ${contactEn}.`;

  return { zh: { title: t.zh, body: zh }, en: { title: t.en, body: en } };
}

/** 從收到的通知文字推測模板、日期與範圍 */
export function guessFromNotice(text: string, year = new Date().getFullYear()): { template: AnnTemplate; start: string; end: string; area: string } {
  const template: AnnTemplate = /電梯|昇降/.test(text)
    ? "elevator"
    : /停水|水塔|水池/.test(text)
      ? "water"
      : /停電|台電|電力/.test(text)
        ? "power"
        : /颱風/.test(text)
          ? "typhoon"
          : /施工|工程|裝修|修繕/.test(text)
            ? "construction"
            : /活動|講座|聚會/.test(text)
              ? "event"
              : "general";
  const dates: string[] = [];
  const re = /(?:(\d{3,4})\s*[/年.-]\s*)?(\d{1,2})\s*[/月]\s*(\d{1,2})\s*日?(?:\s*[（(][一二三四五六日][)）])?(?:\s*(?:上午|下午)?\s*(\d{1,2})[:：](\d{2}))?/g;
  for (const m of text.matchAll(re)) {
    let y = m[1] ? Number(m[1]) : year;
    if (y < 1911) y += 1911;
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    const date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    dates.push(m[4] ? `${date}T${m[4].padStart(2, "0")}:${m[5]}` : date);
  }
  // 「9:00~17:00」只有一個日期時套用到同一天
  const times = [...text.matchAll(/(\d{1,2})[:：](\d{2})\s*[~～\-至到]\s*(\d{1,2})[:：](\d{2})/g)][0];
  let start = dates[0] ?? "";
  let end = dates[1] ?? "";
  if (start && times && start.length === 10) {
    end = end || start;
    start = `${start}T${times[1].padStart(2, "0")}:${times[2]}`;
    end = `${end.slice(0, 10)}T${times[3].padStart(2, "0")}:${times[4]}`;
  }
  const area = text.match(/[AB]\s*棟[^，。,\s]{0,10}|全社區|地下室|B\d\s*[^，。,\s]{0,6}|\d+\s*號電梯/)?.[0]?.trim() ?? "";
  return { template, start, end, area };
}
