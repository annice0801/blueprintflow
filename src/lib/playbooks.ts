// 情境範本：新增「颱風」「第三方檢測」「召開例會」等事件時，自動帶出各職責的待辦（前後端共用）
import type { RoleId } from "./mgmt";

export type PlaybookStep = {
  key: string;
  title: string;
  assignees: RoleId[];
  /** 相對基準日的天數（負數 = 之前）；有 after 時改為「前一步完成後幾天」 */
  offset: number;
  after?: string; // 前一步 key：前一步完成才開始
  description?: string;
  link?: "driveway" | "inspections" | "plants" | "announcements";
  optional?: boolean; // 預設不勾選
};

export type Playbook = {
  id: string;
  name: string;
  icon: string;
  dateLabel: string; // 基準日欄位名稱
  namePlaceholder: string;
  keywords: RegExp; // 會議紀錄出現時建議套用
  steps: PlaybookStep[];
};

export const PLAYBOOKS: Playbook[] = [
  {
    id: "third-party",
    name: "第三方檢測 / 公設點交勘驗",
    icon: "🔍",
    dateLabel: "檢測日",
    namePlaceholder: "例：公設點交第三方勘驗",
    keywords: /第三方|勘驗|會勘|點交檢測|檢測報告/,
    steps: [
      { key: "contact", title: "聯繫檢測單位，確認範圍、日期與報價", assignees: ["chair", "gm"], offset: -14 },
      { key: "notify", title: "通知建商與住戶檢測時間（公告）", assignees: ["gm", "secretary"], offset: -7, link: "announcements" },
      { key: "onsite", title: "現場檢測（物業與建商陪同）", assignees: ["gm", "vendor", "builder"], offset: 0 },
      { key: "report", title: "等待檢測報告", assignees: ["vendor"], offset: 14, after: "onsite", description: "檢測單位出具報告；收到後將本項標為已完成，下一步會自動排程" },
      { key: "review", title: "管委會審閱報告，彙整缺失清單", assignees: ["chair", "audit", "member1"], offset: 7, after: "report" },
      { key: "send", title: "依報告缺失函送建商", assignees: ["chair", "gm"], offset: 3, after: "review", description: "附檢測報告與缺失清單，請建商限期回覆改善期程" },
      { key: "reply", title: "建商回覆改善期程", assignees: ["builder"], offset: 14, after: "send" },
      { key: "recheck", title: "缺失改善完成複驗", assignees: ["vendor", "builder", "gm"], offset: 30, after: "reply" },
    ],
  },
  {
    id: "typhoon",
    name: "颱風",
    icon: "🌀",
    dateLabel: "預計影響日",
    namePlaceholder: "例：康芮颱風",
    keywords: /颱風/,
    steps: [
      { key: "ann", title: "發布防颱公告（車輛移置、陽台物品收納）", assignees: ["secretary", "gm"], offset: -2, link: "announcements" },
      { key: "flood", title: "車道擋水閘板就位、抽水機試運轉", assignees: ["gm", "guard"], offset: -2 },
      { key: "drain", title: "屋頂、陽台排水孔與截水溝清理", assignees: ["cleaner"], offset: -2 },
      { key: "tree", title: "植栽綁固、修剪，移除易倒盆栽", assignees: ["vendor"], offset: -1, link: "plants" },
      { key: "close", title: "公設門窗關閉，戶外桌椅、帆布收納", assignees: ["guard", "cleaner"], offset: -1 },
      { key: "elev", title: "評估地下室淹水風險，必要時電梯停靠高樓層", assignees: ["gm"], offset: -1 },
      { key: "patrol", title: "颱風期間加強巡邏，記錄災情與照片", assignees: ["guard"], offset: 0 },
      { key: "gate", title: "災後檢查車道：汽車第一／第二感應點、柵欄機、紅綠燈、機車感應器", assignees: ["gm", "guard"], offset: 1, link: "driveway", description: "有異常請到「車道」頁對應設備登記故障，系統會自動建立維修待辦" },
      { key: "door", title: "災後檢查大廳大門感應門、門禁讀卡機", assignees: ["guard"], offset: 1 },
      { key: "basement", title: "地下室、機房、電梯坑積水檢查與排水", assignees: ["gm", "cleaner"], offset: 1 },
      { key: "treeafter", title: "植栽倒伏、損傷紀錄與清運", assignees: ["vendor", "cleaner"], offset: 1, link: "plants" },
      { key: "loss", title: "災損彙整報告管委會，聯繫保險理賠", assignees: ["gm", "finance"], offset: 3 },
    ],
  },
  {
    id: "rain",
    name: "豪雨 / 大雨特報",
    icon: "🌧",
    dateLabel: "預計降雨日",
    namePlaceholder: "例：豪雨特報",
    keywords: /豪雨|大雨|淹水/,
    steps: [
      { key: "flood", title: "車道擋水閘板就位、抽水機試運轉", assignees: ["gm", "guard"], offset: -1 },
      { key: "drain", title: "截水溝、排水孔清理", assignees: ["cleaner"], offset: -1 },
      { key: "patrol", title: "降雨期間巡查地下室與車道積水", assignees: ["guard"], offset: 0 },
      { key: "check", title: "雨後檢查車道感應器、雨水回收池馬達", assignees: ["gm"], offset: 1, link: "driveway" },
    ],
  },
  {
    id: "quake",
    name: "地震",
    icon: "🫨",
    dateLabel: "發生日",
    namePlaceholder: "例：花蓮外海規模 6 地震",
    keywords: /地震/,
    steps: [
      { key: "elev", title: "電梯停用檢查，由永大電梯確認後恢復", assignees: ["gm", "vendor"], offset: 0 },
      { key: "gas", title: "巡查公設瓦斯、水管、消防管線有無洩漏", assignees: ["guard", "gm"], offset: 0 },
      { key: "wall", title: "外牆、磁磚、制震壁與公設裂縫拍照紀錄", assignees: ["gm"], offset: 1 },
      { key: "report", title: "異常彙整通報管委會與建商（保固範圍）", assignees: ["gm", "chair"], offset: 2 },
    ],
  },
  {
    id: "water",
    name: "停水",
    icon: "🚱",
    dateLabel: "停水日",
    namePlaceholder: "例：台水管線施工停水",
    keywords: /停水/,
    steps: [
      { key: "ann", title: "張貼停水公告（中英文）", assignees: ["secretary"], offset: -3, link: "announcements" },
      { key: "tank", title: "確認水塔、蓄水池水位，必要時預先補滿", assignees: ["gm"], offset: -1 },
      { key: "pump", title: "復水後檢查加壓馬達、排除管線空氣", assignees: ["gm", "vendor"], offset: 0 },
    ],
  },
  {
    id: "power",
    name: "停電",
    icon: "🔌",
    dateLabel: "停電日",
    namePlaceholder: "例：台電年度停電保養",
    keywords: /停電/,
    steps: [
      { key: "ann", title: "張貼停電公告（電梯、門禁、停車場影響）", assignees: ["secretary"], offset: -3, link: "announcements" },
      { key: "gen", title: "緊急發電機油量與試運轉確認", assignees: ["gm", "vendor"], offset: -1 },
      { key: "gate", title: "停電期間車道柵欄改常開、人員管制", assignees: ["guard"], offset: 0, link: "driveway" },
      { key: "restore", title: "復電後檢查電梯、門禁、BA 系統、車道設備", assignees: ["gm", "guard"], offset: 0 },
    ],
  },
  {
    id: "meeting",
    name: "召開管委會例會",
    icon: "📋",
    dateLabel: "開會日",
    namePlaceholder: "例：第八次例會",
    keywords: /下次(會議|例會)|第[一二三四五六七八九十\d]+次例會/,
    steps: [
      { key: "collect", title: "彙整待討論事項與提案", assignees: ["gm", "chair"], offset: -14, description: "系統已自動帶入待討論事項（見下方清單），請增刪後排入議程" },
      { key: "agenda", title: "確認議程與列席廠商", assignees: ["chair", "gm"], offset: -10 },
      { key: "notice", title: "發送開會通知與議程", assignees: ["secretary"], offset: -7, link: "announcements" },
      { key: "docs", title: "準備財報、工作報告與簽到表", assignees: ["secretary", "finance"], offset: -2 },
      { key: "hold", title: "召開例會", assignees: ["chair", "vice", "finance", "audit", "member1", "member2", "member3", "gm"], offset: 0 },
      { key: "minutes", title: "會議紀錄（附簽到表）公告", assignees: ["gm", "secretary"], offset: 7, after: "hold" },
    ],
  },
];

export const playbookOf = (id: string) => PLAYBOOKS.find((p) => p.id === id);

/** 情境事件：一次產生的一組待辦 */
export type CommunityEvent = {
  id: string;
  buildingId: string;
  playbookId: string;
  name: string;
  date: string;
  note: string;
  meetingId?: string;
  todoIds: string[];
  createdAt: string;
};

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 依基準日推算每一步的預計日期（有前置步驟者接在前一步之後） */
export function planDates(pb: Playbook, date: string, keys?: string[]) {
  const out = new Map<string, string>();
  for (const s of pb.steps) {
    if (keys && !keys.includes(s.key)) continue;
    const prev = s.after && out.get(s.after);
    out.set(s.key, prev ? addDays(prev, s.offset) : addDays(date, s.after ? (pb.steps.find((x) => x.key === s.after)?.offset ?? 0) + s.offset : s.offset));
  }
  return out;
}

export type PlaybookSuggestion = { playbookId: string; reason: string; date: string };

/** 會議紀錄內容中出現關鍵字 → 建議套用的情境（附原文片段與文中日期） */
export function suggestPlaybooks(text: string, meetingDate: string): PlaybookSuggestion[] {
  const out: PlaybookSuggestion[] = [];
  const year = Number(meetingDate.slice(0, 4)) || new Date().getFullYear();
  for (const pb of PLAYBOOKS) {
    const m = pb.keywords.exec(text);
    if (!m) continue;
    const line = text.slice(Math.max(0, text.lastIndexOf("\n", m.index) + 1), text.indexOf("\n", m.index) === -1 ? undefined : text.indexOf("\n", m.index)).trim();
    // 片段中的日期：「10/7」「10 月 7 日」
    const d = line.match(/(\d{1,2})\s*[/月]\s*(\d{1,2})/);
    let date = "";
    if (d && Number(d[1]) <= 12 && Number(d[2]) <= 31) date = `${year}-${d[1].padStart(2, "0")}-${d[2].padStart(2, "0")}`;
    out.push({ playbookId: pb.id, reason: line.slice(0, 80), date });
  }
  return out;
}
