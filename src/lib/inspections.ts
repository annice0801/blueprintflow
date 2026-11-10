// 年度檢測 / 申報：集合住宅每年需辦理的法定檢查與建議保養（前後端共用）
// 本社區：地上 22 層、高度約 75 m（高層建築物）、地下 4 層、1F 店鋪 → 依此預設頻率，可於系統內調整

export const INSPECTION_LEVELS = ["法定", "建議"] as const;
export type InspectionLevel = (typeof INSPECTION_LEVELS)[number];
export const INSPECTION_RESULTS = ["合格", "缺失待改善", "已改善複查合格", "不合格"] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export type InspectionDef = {
  id: string;
  name: string;
  category: "消防" | "建築" | "設備" | "衛生" | "組織";
  level: InspectionLevel;
  everyMonths: number;
  basis: string; // 法源
  authority: string; // 申報 / 主管機關
  how: string; // 辦理方式
  note?: string;
};

export const INSPECTION_DEFS: InspectionDef[] = [
  {
    id: "fire-check",
    name: "消防安全設備檢修申報",
    category: "消防",
    level: "法定",
    everyMonths: 12,
    basis: "消防法第 9 條、施行細則第 6 條（甲類以外場所每年 1 次）",
    authority: "地方政府消防局",
    how: "委託消防設備師（士）或檢修機構檢修，檢修報告書送消防局備查",
    note: "1F 店鋪如屬甲類場所（餐飲、商店等），該部分每半年 1 次",
  },
  {
    id: "fire-drill",
    name: "消防防護計畫 / 自衛消防編組演練",
    category: "消防",
    level: "法定",
    everyMonths: 6,
    basis: "消防法第 13 條、施行細則第 15 條（高層建築物應設防火管理人，每半年至少 1 次滅火、通報、避難訓練，每次 4 小時以上）",
    authority: "地方政府消防局（轄區消防隊）",
    how: "防火管理人製作消防防護計畫報備，演練前 3 日通報消防單位",
    note: "防火管理人每 3 年需複訓",
  },
  {
    id: "public-safety",
    name: "建築物公共安全檢查簽證及申報",
    category: "建築",
    level: "法定",
    everyMonths: 24,
    basis: "建築法第 77 條、建築物公共安全檢查簽證及申報辦法（H-2 集合住宅 16 層以上每 2 年 1 次）",
    authority: "地方政府工務局",
    how: "委託專業檢查人（建築師 / 專業機構）簽證後申報",
    note: "1F 店鋪若為其他使用類組，頻率依類組另計",
  },
  {
    id: "elevator",
    name: "昇降設備安全檢查（使用許可證換發）",
    category: "設備",
    level: "法定",
    everyMonths: 12,
    basis: "建築法第 77-4 條、建築物昇降設備設置及檢查管理辦法（使用許可證有效期 1 年）",
    authority: "地方政府工務局（委託檢查機構）",
    how: "由維護保養廠商（永大電梯）會同檢查機構檢查，合格後換發使用許可證並張貼於車廂",
    note: "每月另需定期保養（永大電梯維養）",
  },
  {
    id: "playground",
    name: "兒童遊戲場設施安全檢驗",
    category: "設備",
    level: "法定",
    everyMonths: 12,
    basis: "兒童遊戲場設施安全管理規範（每年委託檢驗機構檢驗 1 次，並每月自主檢查）",
    authority: "地方政府社會局",
    how: "委託檢驗機構出具檢驗合格證明，張貼於遊戲場明顯處",
    note: "適用中庭遊戲區與兒童遊戲室；如經主管機關認定不適用可停用此項",
  },
  {
    id: "owners-meeting",
    name: "區分所有權人會議",
    category: "組織",
    level: "法定",
    everyMonths: 12,
    basis: "公寓大廈管理條例第 25 條（每年至少召開定期會議 1 次）",
    authority: "—",
    how: "開會前 10 日書面通知；會議紀錄於會後 15 日內送達並公告",
  },
  {
    id: "org-report",
    name: "管理組織報備（改選 / 異動）",
    category: "組織",
    level: "法定",
    everyMonths: 12,
    basis: "公寓大廈管理條例第 28 條、公寓大廈管理組織申請報備處理原則",
    authority: "區公所",
    how: "管委會改選或主委、管理負責人異動後，檢附會議紀錄向區公所報備",
    note: "實際依規約任期；未改選年度可跳過",
  },
  {
    id: "electric",
    name: "高壓電氣設備年度停電保養",
    category: "設備",
    level: "建議",
    everyMonths: 12,
    basis: "電業法、用電場所及專任電氣技術人員管理規則（定期檢驗由電氣技術人員辦理）",
    authority: "台灣電力公司（停電需事先申請）",
    how: "委託電氣技術人員 / 機電廠商停電保養受變電設備，同時測試緊急發電機帶載",
  },
  {
    id: "water-tank",
    name: "蓄水池 / 水塔清洗與水質檢驗",
    category: "衛生",
    level: "建議",
    everyMonths: 6,
    basis: "飲用水管理條例、建築物給水設備維護（建議每半年清洗 1 次）",
    authority: "—",
    how: "清洗後送驗大腸桿菌群、濁度、餘氯，報告公告於公佈欄",
  },
  {
    id: "pest",
    name: "環境消毒 / 病媒防治",
    category: "衛生",
    level: "建議",
    everyMonths: 3,
    basis: "環境用藥管理法（委託合格病媒防治業）",
    authority: "—",
    how: "地下室、垃圾間、化糞池周邊、管道間消毒，事前公告住戶",
  },
  {
    id: "septic",
    name: "污水處理設施 / 化糞池清理",
    category: "衛生",
    level: "建議",
    everyMonths: 12,
    basis: "建築物污水處理設施清理機構管理辦法",
    authority: "地方政府環境保護局",
    how: "委託合格清理機構清理並保留清理紀錄",
    note: "如已接用公共污水下水道可停用此項",
  },
];

export type InspectionRecord = {
  id: string;
  date: string; // 辦理日 YYYY-MM-DD
  result: InspectionResult;
  vendor: string; // 檢查 / 檢修廠商
  cost: string;
  note: string; // 缺失項目、改善期限
  createdAt: string;
};

/** 各社區對某檢測項目的設定與歷次紀錄（自訂項目沒有 defId） */
export type InspectionPlan = {
  id: string;
  buildingId: string;
  defId?: string;
  name: string;
  category: InspectionDef["category"];
  level: InspectionLevel;
  everyMonths: number;
  basis: string;
  authority: string;
  how: string;
  note: string;
  enabled: boolean;
  dueOverride: string; // 手動指定下次期限（空 = 依上次辦理日推算）
  vendor: string; // 預設委託廠商
  records: InspectionRecord[];
  updatedAt: string;
};

export function planFromDef(d: InspectionDef, buildingId: string): InspectionPlan {
  return {
    id: `${buildingId}:${d.id}`,
    buildingId,
    defId: d.id,
    name: d.name,
    category: d.category,
    level: d.level,
    everyMonths: d.everyMonths,
    basis: d.basis,
    authority: d.authority,
    how: d.how,
    note: d.note ?? "",
    enabled: true,
    dueOverride: "",
    vendor: "",
    records: [],
    updatedAt: "",
  };
}

export function addMonths(date: string, months: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(y, m - 1 + months, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export const lastRecord = (p: InspectionPlan) => [...p.records].sort((a, b) => b.date.localeCompare(a.date))[0];

/** 下次期限：手動指定優先，否則上次辦理日 + 週期 */
export function nextDue(p: InspectionPlan) {
  if (p.dueOverride) return p.dueOverride;
  const last = lastRecord(p);
  return last ? addMonths(last.date, p.everyMonths) : "";
}

export type DueState = "逾期" | "30 天內" | "已排定" | "未設定" | "停用";
export function dueState(p: InspectionPlan, today: string): DueState {
  if (!p.enabled) return "停用";
  const due = nextDue(p);
  if (!due) return "未設定";
  if (due < today) return "逾期";
  return Date.parse(due) - Date.parse(today) <= 30 * 86400000 ? "30 天內" : "已排定";
}

export const DUE_COLOR: Record<DueState, string> = {
  逾期: "#ff4d6d",
  "30 天內": "#f5b83d",
  已排定: "#2dd4bf",
  未設定: "#64748b",
  停用: "#334155",
};

export const INSPECTION_COLOR = "#2dd4bf";

export const everyLabel = (m: number) => (m % 12 === 0 ? (m === 12 ? "每年" : `每 ${m / 12} 年`) : m === 6 ? "每半年" : m === 3 ? "每季" : `每 ${m} 個月`);
