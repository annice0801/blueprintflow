import { toMeters, type PlanDrawing } from "./plan-drawing";
import { buildSitePlan } from "./site-plan";

// 建築物定義：樓層、棟別與平面配置。
// 平面座標單位為（示意）公尺，原點在基地左上角（北側道路 × 西側地界）。

export type TowerId = "A" | "B" | "S"; // S = 共用（地下室、1F）

export type Rect = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ZoneKind;
  /** 可點進去的區域：garden:<areaId> / driveway / shop / unit */
  link?: string;
  /** 平面圖上顯示的短名稱（label 用於問題的「戶別 / 區域」） */
  short?: string;
  /** 戶型資訊，例：約 39.84 坪 */
  info?: string;
  /** 非矩形區域的外框（x/y/w/h 為外接矩形） */
  poly?: [number, number][];
};

/** 設備圖例 */
export type EquipKind = "hydrant" | "extinguisher" | "smoke-detector" | "smoke-vent" | "emergency-light" | "exit-sign" | "panel" | "water-meter" | "sprinkler";
export type Equip = { id: string; kind: EquipKind; x: number; y: number };
export type ZoneKind = "unit" | "core" | "shop" | "lobby" | "parking" | "mep" | "garden" | "roof" | "corridor" | "stair" | "elevator" | "shaft" | "room";

export type Floor = {
  id: string; // B4 … B1, 1F … 22F, RF
  label: string;
  level: number; // B4 = -4, 1F = 1, RF = 23
  towers: TowerId[];
  /** 實際樓高（公尺），依建案簡介p.14 */
  height: number;
};

export type Building = {
  id: string;
  name: string;
  subtitle: string;
  address: string;
  site: { w: number; h: number };
  towers: { id: Exclude<TowerId, "S">; name: string; footprint: [number, number][] }[];
  /** 1F 量體與地下室開挖範圍外框（3D 用） */
  podium: [number, number][];
  basementOutline: [number, number][];
  floors: Floor[];
  floorHeight: number;
  /** 平面示意比例：平面圖 1 m = 實際 1 m × planScale（依原圖「約 24 米」標註換算） */
  planScale: number;
  publicAreas: PublicArea[];
};

/** 公共區域：花圃（可標記每一棵植栽）、車道 */
export type PublicArea = {
  id: string;
  name: string;
  kind: "garden" | "driveway";
  description: string;
  bounds: { x: number; y: number; w: number; h: number };
  beds: Rect[]; // 花圃 / 樹穴
};

// 基地範圍（依 p.3 基地配置圖換算）；A、B 兩棟以 x = MIRROR / 2 左右對稱
const SITE = { w: 60, h: 48 };
const MIRROR = 72.38;
const mirror = (pts: [number, number][]): [number, number][] =>
  pts.map(([x, y]) => [r2(MIRROR - x), y] as [number, number]).reverse();

/*
 * 標準層依建案簡介平面圖描繪：座標以原圖像素記錄（A 棟左上約 (33,36)），
 * 再換算為示意公尺。原圖柱位為規則 3×3 跨（柱心約 x 45/168/304/439、y 45/199/368/490）。
 */
const S = 0.0398;
const r2 = (n: number) => Math.round(n * 100) / 100;
const PX = (x: number) => r2(18 + (x - 33) * S);
const PY = (y: number) => r2(19 + (y - 36) * S);
const box = (x1: number, y1: number, x2: number, y2: number) => ({ x: PX(x1), y: PY(y1), w: r2((x2 - x1) * S), h: r2((y2 - y1) * S) });
const polyPx = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [PX(x), PY(y)]);

const A_FOOTPRINT: [number, number][] = polyPx([
  [160, 36], [447, 36], [447, 378], [303, 378], [303, 497], [33, 497], [33, 191], [160, 191],
]);

const B_FOOTPRINT = mirror(A_FOOTPRINT);

// A 棟標準層戶別（無 4 號）；坪數取自建案簡介戶型頁（p.19–24），外框含陽台
const A5_POLY: [number, number][] = [[210, 369], [303, 369], [303, 497], [168, 497], [168, 406], [210, 406]];
const A_UNITS: Rect[] = [
  { id: "A1", label: "A1", ...box(160, 36, 302, 208), kind: "unit", link: "unit", info: "權狀 41.48 坪 · 計價 39.84 坪 · 室內 26.12 坪" },
  { id: "A2", label: "A2", ...box(305, 36, 447, 208), kind: "unit", link: "unit", info: "權狀 42.52 坪 · 計價 40.18 坪 · 室內 26.12 坪" },
  { id: "A3", label: "A3", ...box(302, 250, 447, 378), kind: "unit", link: "unit", info: "權狀 33.10 坪 · 計價 30.16 坪 · 室內 19.23 坪" },
  { id: "A5", label: "A5", ...box(168, 369, 303, 497), poly: polyPx(A5_POLY), kind: "unit", link: "unit", info: "權狀 28.36 坪 · 計價 27.70 坪 · 室內 17.36 坪" },
  { id: "A6", label: "A6", ...box(33, 360, 167, 497), kind: "unit", link: "unit", info: "權狀 31.44 坪 · 計價 29.41 坪 · 室內 18.99 坪" },
  { id: "A7", label: "A7", ...box(33, 191, 177, 360), kind: "unit", link: "unit", info: "權狀 40.76 坪 · 計價 38.65 坪 · 室內 25.16 坪" },
];

// 核心：兩部電梯、排煙室兼梯廳、兩座安全梯、管道間、梯廳（走廊）
const A_CORE: Rect[] = [
  { id: "A-C1", label: "A 梯廳", short: "梯廳", ...box(177, 208, 334, 242), kind: "corridor" },
  { id: "A-C3", label: "A 梯廳", short: "", ...box(302, 242, 334, 250), kind: "corridor" },
  { id: "A-C2", label: "A 梯廳", short: "梯廳", ...box(177, 242, 211, 406), kind: "corridor" },
  { id: "A-P1", label: "A 管道間", short: "管道", ...box(211, 242, 221, 278), kind: "shaft" },
  { id: "A-E1", label: "A 電梯 1", short: "電梯", ...box(221, 242, 260, 278), kind: "elevator" },
  { id: "A-E2", label: "A 電梯 2", short: "電梯", ...box(260, 242, 302, 278), kind: "elevator" },
  { id: "A-V1", label: "A 排煙室兼梯廳", short: "排煙室", ...box(211, 278, 302, 313), kind: "core" },
  { id: "A-S1", label: "A 安全梯 1", short: "安全梯", ...box(211, 313, 302, 369), kind: "stair" },
  { id: "A-V2", label: "A 排煙室", short: "排煙室", ...box(334, 208, 381, 226), kind: "core" },
  { id: "A-P2", label: "A 管道間（給排水）", short: "管道", ...box(334, 226, 381, 250), kind: "shaft" },
  { id: "A-S2", label: "A 安全梯 2", short: "安全梯", ...box(381, 208, 436, 250), kind: "stair" },
];

// 結構柱（原圖柱心，約 0.68 m 見方）
const COL = 17;
const A_COLUMNS: Rect[] = (
  [
    [168, 45], [304, 45], [439, 45],
    [45, 199], [168, 199], [304, 199], [439, 199],
    [45, 368], [168, 368], [304, 368], [439, 368],
    [45, 490], [168, 490], [304, 490],
  ] as const
).map(([cx, cy], i) => ({ id: `A-col${i}`, label: "結構柱", ...box(cx - COL / 2, cy - COL / 2, cx + COL / 2, cy + COL / 2), kind: "core" as const }));

// 各戶隔間（原圖像素 x1, y1, x2, y2）
type RoomPx = [name: string, x1: number, y1: number, x2: number, y2: number];
const A1_ROOMS: RoomPx[] = [
  ["陽台", 160, 36, 302, 54],
  ["陽台", 160, 54, 170, 159],
  ["主臥", 170, 54, 210, 107],
  ["臥室 2", 210, 54, 250, 107],
  ["客餐廳", 250, 54, 302, 122],
  ["走道", 195, 107, 250, 122],
  ["主衛", 170, 107, 195, 135],
  ["浴室", 170, 135, 195, 159],
  ["臥室 3", 195, 122, 228, 180],
  ["餐廳", 228, 122, 302, 163],
  ["工作陽台", 170, 159, 195, 208],
  ["廚房", 195, 180, 244, 208],
  ["客衛", 244, 163, 271, 208],
  ["玄關", 271, 163, 302, 208],
];
const ROOMS_PX: Record<string, RoomPx[]> = {
  A1: A1_ROOMS,
  // A2 與 A1 以分戶牆左右對稱（對稱軸 x = 302）
  A2: A1_ROOMS.map(([n, x1, y1, x2, y2]) => [n, 604 - x2, y1, 604 - x1, y2]),
  A7: [
    ["陽台", 33, 191, 160, 209],
    ["陽台", 33, 209, 48, 360],
    ["主臥", 48, 209, 87, 260],
    ["臥室 2", 87, 209, 127, 259],
    ["客餐廳", 127, 209, 177, 332],
    ["主衛", 48, 260, 72, 287],
    ["浴室", 48, 287, 72, 312],
    ["走道", 72, 259, 127, 274],
    ["書房", 72, 274, 127, 300],
    ["臥室 3", 72, 300, 127, 334],
    ["工作陽台", 48, 312, 72, 360],
    ["廚房", 72, 334, 127, 360],
    ["玄關", 127, 332, 143, 360],
    ["客衛", 143, 332, 167, 360],
  ],
  A6: [
    ["陽台", 33, 482, 168, 497],
    ["陽台", 33, 419, 48, 482],
    ["工作陽台", 48, 360, 64, 419],
    ["廚房", 64, 360, 113, 391],
    ["衛浴", 113, 360, 142, 406],
    ["玄關", 142, 360, 167, 406],
    ["書房", 64, 391, 100, 421],
    ["客餐廳", 100, 406, 167, 439],
    ["走道", 64, 421, 100, 439],
    ["主臥", 48, 421, 85, 482],
    ["臥室 2", 85, 439, 123, 482],
    ["客餐廳", 123, 439, 167, 482],
  ],
  A5: [
    ["陽台", 168, 482, 303, 497],
    ["衛浴", 210, 369, 238, 406],
    ["廚房", 238, 369, 286, 396],
    ["工作陽台", 286, 369, 303, 429],
    ["走道", 238, 396, 255, 406],
    ["書房", 255, 396, 286, 430],
    ["客餐廳", 168, 406, 211, 482],
    ["客餐廳", 211, 406, 255, 446],
    ["臥室 2", 211, 446, 261, 482],
    ["主臥", 261, 430, 303, 482],
  ],
  A3: [
    ["陽台", 302, 360, 447, 378],
    ["陽台", 436, 285, 447, 360],
    ["玄關", 302, 250, 334, 285],
    ["衛浴", 334, 250, 372, 285],
    ["廚房", 372, 250, 409, 269],
    ["走道", 372, 269, 409, 285],
    ["工作陽台", 409, 250, 436, 285],
    ["客餐廳", 302, 285, 346, 360],
    ["客餐廳", 346, 285, 399, 318],
    ["書房", 399, 285, 436, 318],
    ["臥室 2", 346, 318, 382, 360],
    ["主臥", 382, 318, 436, 360],
  ],
};

const A_ROOMS: Rect[] = Object.entries(ROOMS_PX).flatMap(([unit, rooms]) =>
  rooms.map(([name, x1, y1, x2, y2], i) => ({
    id: `${unit}-${i}`,
    label: `${unit} ${name}`,
    short: name,
    ...box(x1, y1, x2, y2),
    kind: "room" as const,
  })),
);

const E = (id: string, kind: EquipKind, x: number, y: number): Equip => ({ id, kind, x: PX(x), y: PY(y) });
const A_EQUIP: Equip[] = [
  E("A-FH1", "hydrant", 182, 330),
  E("A-EX1", "extinguisher", 322, 216),
  E("A-EX2", "extinguisher", 205, 396),
  E("A-SD1", "smoke-detector", 232, 225),
  E("A-SD2", "smoke-detector", 290, 225),
  E("A-SD3", "smoke-detector", 194, 282),
  E("A-SD4", "smoke-detector", 194, 362),
  E("A-SP1", "sprinkler", 261, 225),
  E("A-SP2", "sprinkler", 194, 322),
  E("A-SV1", "smoke-vent", 290, 296),
  E("A-SV2", "smoke-vent", 357, 217),
  E("A-EL1", "emergency-light", 200, 252),
  E("A-EL2", "emergency-light", 318, 236),
  E("A-EXIT1", "exit-sign", 256, 318),
  E("A-EXIT2", "exit-sign", 388, 214),
  E("A-PN1", "panel", 216, 260),
  E("A-WM1", "water-meter", 357, 238),
];

const mirrorRect = (r: Rect, from: string, to: string): Rect => ({
  ...r,
  id: r.id.replace(from, to),
  label: r.label.replace(from, to),
  x: r2(MIRROR - r.x - r.w),
  ...(r.poly && { poly: mirror(r.poly) }),
});

const B_UNITS = A_UNITS.map((r) => mirrorRect(r, "A", "B"));
const B_CORE = A_CORE.map((r) => mirrorRect(r, "A", "B"));
const B_ROOMS = A_ROOMS.map((r) => mirrorRect(r, "A", "B"));
const B_COLUMNS = A_COLUMNS.map((r) => mirrorRect(r, "A", "B"));
const B_EQUIP: Equip[] = A_EQUIP.map((e) => ({ ...e, id: e.id.replace("A", "B"), x: r2(MIRROR - e.x) }));

const A_DRAWING = toMeters(PX, PY, S);
const B_DRAWING = toMeters(PX, PY, S, (x) => r2(MIRROR - x));

/* 鋼板制震壁（p.16 隔層配置）：X 向 2–16F 偶數層 + 9F、11F；Y 向 2–16F 偶數層 + 13F、15F，每棟每向 2 組 */
export type Damper = { x1: number; y1: number; x2: number; y2: number; dir: "X" | "Y" };
const A_DAMPERS: Damper[] = [
  { x1: PX(383), y1: PY(52), x2: PX(393), y2: PY(52), dir: "X" },
  { x1: PX(211), y1: PY(481), x2: PX(221), y2: PY(481), dir: "X" },
  { x1: PX(47), y1: PY(309), x2: PX(47), y2: PY(319), dir: "Y" },
  { x1: PX(437), y1: PY(294), x2: PX(437), y2: PY(304), dir: "Y" },
];
const B_DAMPERS: Damper[] = A_DAMPERS.map((d) => ({ ...d, x1: r2(MIRROR - d.x1), x2: r2(MIRROR - d.x2) }));
const damperFloors = { X: [2, 4, 6, 8, 9, 10, 11, 12, 14, 16], Y: [2, 4, 6, 8, 10, 12, 13, 14, 15, 16] };

// 1F、地下室與公共區域：對齊 A 棟電梯中心（PX 261.5 / PY 260）與兩棟對稱軸
const SITE_PLAN = buildSitePlan(MIRROR / 2, PY(260));

const isTypical = (floorId: string) => /^\d+F$/.test(floorId) && floorId !== "1F";

/** 標準層細節：各戶隔間與設備（其他樓層回傳空陣列） */
export function getDetail(
  floorId: string,
  tower: TowerId,
): { rooms: Rect[]; equip: Equip[]; columns: Rect[]; drawing?: PlanDrawing; dampers: Damper[] } {
  const none = { rooms: [], equip: [], columns: [], dampers: [] };
  if (floorId === "1F") return { ...none, drawing: SITE_PLAN.groundDrawing };
  if (floorId.startsWith("B")) return { ...none, drawing: SITE_PLAN.basementDrawing };
  if (tower === "S" || !(isTypical(floorId) || floorId === "RF")) return none;
  const columns = tower === "A" ? A_COLUMNS : B_COLUMNS;
  if (floorId === "RF") return { ...none, columns };
  const n = Number(floorId.replace("F", ""));
  const dampers = (tower === "A" ? A_DAMPERS : B_DAMPERS).filter((d) => damperFloors[d.dir].includes(n));
  return tower === "A"
    ? { rooms: A_ROOMS, equip: A_EQUIP, columns, drawing: A_DRAWING, dampers }
    : { rooms: B_ROOMS, equip: B_EQUIP, columns, drawing: B_DRAWING, dampers };
}

const ROOF = (t: "A" | "B"): Rect[] => {
  const base: Rect[] = [
    { id: "A-roof-n", label: "屋頂北側", ...box(160, 36, 447, 208), kind: "roof" },
    { id: "A-roof-w", label: "屋頂西側", ...box(33, 191, 177, 497), kind: "roof" },
    { id: "A-mech", label: "機房 / 水箱", ...box(177, 208, 302, 369), kind: "mep" },
    { id: "A-roof-e", label: "屋頂東側", ...box(302, 208, 447, 378), kind: "roof" },
    { id: "A-roof-s", label: "屋頂南側", ...box(177, 369, 303, 497), kind: "roof" },
  ];
  return t === "A" ? base : base.map((r) => mirrorRect(r, "A", "B"));
};

// 1F：店鋪 + 大廳 + 中庭；地下室：B1 實測（p.8），B2–B4 沿用
const GROUND: Rect[] = SITE_PLAN.ground;
const basement = SITE_PLAN.basement;
const PUBLIC_AREAS: PublicArea[] = SITE_PLAN.publicAreas;

export const SHOPS = GROUND.filter((z) => z.kind === "shop");

// 樓高（p.14）：B2–B4 3.10、B1 4.20、1F 6.00、2F–20F 3.30、21F–22F 3.40 m；R 樓為屋突示意
function buildFloors(): Floor[] {
  const floors: Floor[] = [];
  for (let b = 4; b >= 1; b--) floors.push({ id: `B${b}`, label: `B${b}`, level: -b, towers: ["S"], height: b === 1 ? 4.2 : 3.1 });
  floors.push({ id: "1F", label: "1F", level: 1, towers: ["S"], height: 6 });
  for (let f = 2; f <= 22; f++) floors.push({ id: `${f}F`, label: `${f}F`, level: f, towers: ["A", "B"], height: f >= 21 ? 3.4 : 3.3 });
  floors.push({ id: "RF", label: "R 樓", level: 23, towers: ["A", "B"], height: 3.4 });
  return floors;
}

/** 樓板底的實際標高（公尺，1F 地面 = 0） */
export function floorElevation(b: Building, floorId: string) {
  const f = b.floors.find((x) => x.id === floorId);
  if (!f) return 0;
  if (f.level > 0) return b.floors.filter((x) => x.level > 0 && x.level < f.level).reduce((s, x) => s + x.height, 0);
  return -b.floors.filter((x) => x.level < 0 && x.level >= f.level).reduce((s, x) => s + x.height, 0);
}

export const BUILDINGS: Building[] = [
  {
    id: "blueprint",
    name: "藍圖社區",
    subtitle: "Blueprint Residence · A/B 雙棟",
    address: "作品集示範版 · 地址已隱藏",
    site: SITE,
    towers: [
      { id: "A", name: "A 棟", footprint: A_FOOTPRINT },
      { id: "B", name: "B 棟", footprint: B_FOOTPRINT },
    ],
    podium: SITE_PLAN.podium,
    basementOutline: SITE_PLAN.basementOutline,
    floors: buildFloors(),
    floorHeight: 3.3,
    planScale: 0.61,
    publicAreas: PUBLIC_AREAS,
  },
];

/*
 * 示範模式：已登入、尚未被核准的帳號看同一棟建築的結構，資料則讀「<社區>:demo」這份假名示範資料。
 * proxy 會把這類請求的社區代號改寫成示範範圍，真實資料不會送到示範帳號。
 */
const DEMO_SUFFIX = ":demo";
export const demoScope = (id: string) => (id.endsWith(DEMO_SUFFIX) ? id : id + DEMO_SUFFIX);
export const isDemoScope = (id: string | null | undefined) => !!id?.endsWith(DEMO_SUFFIX);
/** 資料範圍 → 實際社區代號（示範範圍對應同一棟建築） */
export const realBuildingId = (id: string) => (isDemoScope(id) ? id.slice(0, -DEMO_SUFFIX.length) : id);

export function getBuilding(id: string) {
  const real = realBuildingId(id);
  return BUILDINGS.find((b) => b.id === real);
}

export function getArea(b: Building, areaId: string) {
  return b.publicAreas.find((a) => a.id === areaId);
}

/** 管理員名冊用：所有住戶與店鋪單位 */
/** 戶別權狀坪數（店鋪無資料回傳 0）；id 例 A-12F-A3 */
export function unitPing(unitId: string) {
  const code = unitId.split("-").pop() ?? "";
  const info = A_UNITS.find((u) => u.id === code.replace(/^B/, "A"))?.info ?? "";
  return Number(info.match(/權狀\s*([\d.]+)/)?.[1] ?? 0);
}

export function unitLabel(unitId: string) {
  const [t, f, ...rest] = unitId.split("-");
  return t === "S" ? `1F ${SHOPS.find((s) => s.id === rest.join("-"))?.label ?? rest.join("-")}` : `${t} 棟 ${f} ${rest.join("-")}`;
}

export function residentUnits(b: Building) {
  const units: { id: string; tower: TowerId; floor: string; unit: string }[] = [];
  for (const f of b.floors) {
    if (f.id === "1F") for (const s of SHOPS) units.push({ id: `S-1F-${s.id}`, tower: "S", floor: "1F", unit: s.label });
    if (f.level < 2 || f.id === "RF") continue;
    for (const t of f.towers)
      for (const u of t === "A" ? A_UNITS : B_UNITS)
        if (u.kind === "unit") units.push({ id: `${t}-${f.id}-${u.id}`, tower: t, floor: f.id, unit: u.label });
  }
  return units;
}

/** 某棟某層的平面分區 */
export function getZones(floorId: string, tower: TowerId): Rect[] {
  if (floorId.startsWith("B")) return basement(Number(floorId.slice(1)));
  if (floorId === "1F") return GROUND;
  if (floorId === "RF") return ROOF(tower as "A" | "B");
  return tower === "A" ? [...A_UNITS, ...A_CORE] : [...B_UNITS, ...B_CORE];
}

/** 平面圖顯示範圍（公尺） */
export function getPlanBounds(floorId: string, tower: TowerId) {
  if (floorId.startsWith("B") || floorId === "1F") return { x: 0, y: 0, w: SITE.w, h: SITE.h };
  const fp = tower === "A" ? A_FOOTPRINT : B_FOOTPRINT;
  const xs = fp.map((p) => p[0]);
  const ys = fp.map((p) => p[1]);
  const x = Math.min(...xs) - 1.5;
  const y = Math.min(...ys) - 1.5;
  return { x, y, w: Math.max(...xs) + 1.5 - x, h: Math.max(...ys) + 1.5 - y };
}

export function towerFootprint(b: Building, tower: TowerId) {
  return b.towers.find((t) => t.id === tower)?.footprint;
}

export function zoneAt(floorId: string, tower: TowerId, x: number, y: number) {
  // 小的區塊優先（梯廳疊在停車區上、房間疊在戶上）
  const zones = [...getZones(floorId, tower), ...getDetail(floorId, tower).rooms].sort((a, b) => a.w * a.h - b.w * b.h);
  return zones.find((z) => inZone(z, x, y));
}

export function inZone(z: Rect, x: number, y: number) {
  if (x < z.x || x > z.x + z.w || y < z.y || y > z.y + z.h) return false;
  if (!z.poly) return true;
  let inside = false;
  for (let i = 0, j = z.poly.length - 1; i < z.poly.length; j = i++) {
    const [xi, yi] = z.poly[i];
    const [xj, yj] = z.poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const FLOOR_ORDER = (id: string) => {
  if (id === "RF") return 23;
  if (id.startsWith("B")) return -Number(id.slice(1));
  return Number(id.replace("F", ""));
};
