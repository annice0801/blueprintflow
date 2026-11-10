// 公共區域、車道、店鋪、住戶名冊的資料型別（前後端共用）

export const PLANT_TYPES = ["喬木", "灌木", "花卉", "地被 / 草皮", "其他"] as const;
export const PLANT_HEALTH = ["良好", "需注意", "不良", "已移除"] as const;
export const PLANT_EVENT_TYPES = ["颱風倒伏", "颱風損傷", "修剪", "病蟲害", "施肥 / 養護", "補植 / 更換", "其他"] as const;

export type Plant = {
  id: string;
  buildingId: string;
  areaId: string;
  bed: string; // 所在花圃 / 樹穴
  x: number;
  y: number;
  name: string; // 例：樟樹 #3
  species: string;
  type: (typeof PLANT_TYPES)[number];
  health: (typeof PLANT_HEALTH)[number];
  plantedAt: string; // YYYY-MM-DD
  height: string; // 例：4.5 m
  description: string;
  photos: string[];
  events: PlantEvent[];
  createdAt: string;
  updatedAt: string;
};

export type PlantEvent = {
  id: string;
  date: string;
  type: (typeof PLANT_EVENT_TYPES)[number];
  typhoon: string; // 颱風名稱（非颱風事件可空白）
  description: string; // 當時狀況
  handling: string; // 處理方式
  handler: string; // 處理人 / 廠商
  photos: string[];
  createdAt: string;
};

export const GATES = ["汽車", "機車"] as const;
export const GATE_ACTIONS = ["開啟", "關閉", "常開", "恢復正常", "故障", "維修"] as const;
export type Gate = (typeof GATES)[number];
/** 各道閘的感應器 / 設備（汽車：第 3 次例會所述第一、第二感應點與柵欄機） */
export const GATE_PARTS: Record<Gate, string[]> = {
  汽車: ["第一感應點", "第二感應點", "柵欄機", "路口紅綠燈"],
  機車: ["感應器", "柵欄機"],
};
export const REPAIR_ACTIONS: GateAction[] = ["故障", "維修", "恢復正常"];
export type GateAction = (typeof GATE_ACTIONS)[number];

export type GateLog = {
  part?: string; // 感應器 / 設備（故障、維修紀錄用）
  id: string;
  buildingId: string;
  gate: Gate;
  action: GateAction;
  at: string; // YYYY-MM-DDTHH:mm（台灣時間）
  operator: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** 某道閘某設備的狀態：最後一筆故障 / 維修 / 恢復正常紀錄 */
export function partState(logs: GateLog[], gate: Gate, part: string) {
  const last = logs.filter((l) => l.gate === gate && l.part === part && REPAIR_ACTIONS.includes(l.action)).sort((a, b) => b.at.localeCompare(a.at))[0];
  return { last, bad: last?.action === "故障", fixing: last?.action === "維修" };
}

/** 依最後一筆紀錄推算道閘狀態 */
export function gateState(logs: GateLog[], gate: Gate) {
  const last = logs.filter((l) => l.gate === gate).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!last) return { label: "無紀錄", tone: "idle" as const, last };
  const tone = last.action === "故障" || last.action === "維修" ? "bad" : last.action === "關閉" ? "closed" : "open";
  return { label: last.action, tone, last } as const;
}

export const SHOP_STATUS = ["營業中", "裝潢中", "空置招租", "歇業"] as const;

export type Shop = {
  id: string; // 1F 分區 id，例 G-shop1
  buildingId: string;
  shopName: string;
  business: string; // 業種
  status: (typeof SHOP_STATUS)[number];
  hours: string;
  phone: string; // 店家電話
  contact: string;
  note: string;
  updatedAt: string;
};
