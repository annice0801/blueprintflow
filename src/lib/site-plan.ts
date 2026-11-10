// 1F 基地配置與地下室（依建案簡介p.3 基地配置圖、p.8 B1 全區平面圖描繪）
// 座標以 PDF 頁面轉出圖（2000 px 寬）的像素記錄，再以兩棟電梯中心對齊標準層換算為公尺。

import type { GroundKind, PlanDrawing, TreeTone } from "./plan-drawing";
import type { PublicArea, Rect, ZoneKind } from "./buildings";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** 建立某頁的像素 → 公尺換算（axisPx：兩棟對稱軸；corePy：電梯中心 y） */
function pageMap(axisPx: number, corePy: number, s: number, axisM: number, coreM: number) {
  const fx = (x: number) => r2(axisM + (x - axisPx) * s);
  const fy = (y: number) => r2(coreM + (y - corePy) * s);
  const box = (x1: number, y1: number, x2: number, y2: number) => ({ x: fx(x1), y: fy(y1), w: r2((x2 - x1) * s), h: r2((y2 - y1) * s) });
  const poly = (pts: [number, number][]) => pts.map(([x, y]) => [fx(x), fy(y)] as [number, number]);
  return { fx, fy, box, poly, s };
}

type PageMap = ReturnType<typeof pageMap>;
type Box = [number, number, number, number];

/** 1F 景觀與建築細節（依 p.3 基地配置圖量測，座標為原圖像素） */
function addGroundDetail(g: PageMap, d: PlanDrawing) {
  const rect = ([x1, y1, x2, y2]: Box): [number, number][] => g.poly([[x1, y1], [x2, y1], [x2, y2], [x1, y2]]);
  const area = (kind: GroundKind, ...boxes: Box[]) => boxes.forEach((b) => d.areas!.push({ kind, pts: rect(b) }));
  const poly = (kind: GroundKind, pts: [number, number][]) => d.areas!.push({ kind, pts: g.poly(pts) });
  const tree = (tone: TreeTone, r: number, ...pts: [number, number][]) => pts.forEach(([x, y]) => d.trees!.push({ x: g.fx(x), y: g.fy(y), r: r * g.s, tone }));
  const row = (tone: TreeTone, r: number, y: number, x1: number, x2: number, step: number) => {
    for (let x = x1; x <= x2; x += step) tree(tone, r, [x, y]);
  };
  d.areas = [];
  d.trees = [];
  d.blobs = [];
  d.columns = [];
  d.labels = [];

  /* 道路與鋪面 */
  poly("road", [[300, 30], [1990, 30], [1990, 108], [300, 108]]);
  poly("road", [[1872, 30], [1990, 30], [1990, 1390], [1872, 1390]]);
  poly("road", [[300, 1348], [392, 1323], [1767, 1202], [1872, 1172], [1872, 1390], [300, 1390]]);
  poly("paving", [[846, 108], [1790, 108], [1872, 200], [1872, 1172], [1767, 1202], [392, 1323], [317, 732], [846, 711]]);
  d.labels.push(
    { x: g.fx(1250), y: g.fy(96), text: "北側道路（26 米）", size: 0.8 },
    { x: g.fx(1110), y: g.fy(1305), text: "南側道路（12 米）", size: 0.9 },
    { x: g.fx(1888), y: g.fy(700), text: "東側道路（12 米）", size: 0.7, vertical: true },
  );

  /* 前庭：行道樹、三座長花台、粉色樹列 */
  area("planter", [905, 125, 1720, 150], [905, 183, 1110, 208], [1165, 183, 1500, 208], [1548, 183, 1720, 208]);
  area("lawn", [880, 238, 1745, 262]);
  row("green", 24, 140, 930, 1700, 64);
  row("orange", 19, 195, 930, 1090, 55);
  row("orange", 19, 195, 1190, 1480, 58);
  row("orange", 19, 195, 1570, 1700, 55);
  row("pink", 32, 230, 965, 1660, 70);

  /* 中庭外圍綠籬與兩側植栽帶 */
  area("hedge", [865, 262, 935, 600], [905, 262, 1745, 285], [1725, 262, 1790, 610], [905, 585, 1146, 600], [1320, 590, 1725, 605], [1850, 240, 1872, 610]);
  tree("blue", 22, [882, 320], [882, 440], [882, 545]);
  tree("green", 18, [1862, 300], [1862, 370], [1862, 440], [1862, 510], [1862, 575]);

  /* 中庭花園 */
  area("lawn", [955, 295, 1180, 412], [1560, 512, 1715, 592]);
  area("planter", [993, 467, 1060, 540], [1230, 330, 1335, 365], [1365, 330, 1470, 365], [1500, 293, 1530, 362], [1340, 410, 1530, 440], [1470, 410, 1530, 560], [1350, 522, 1440, 552], [1268, 500, 1325, 555]);
  area("play", [1532, 290, 1705, 500]);
  d.blobs.push(
    { x: g.fx(1567), y: g.fy(357), rx: 18 * g.s, ry: 22 * g.s, rot: 0 },
    { x: g.fx(1625), y: g.fy(383), rx: 16 * g.s, ry: 30 * g.s, rot: -20 },
    { x: g.fx(1610), y: g.fy(455), rx: 42 * g.s, ry: 26 * g.s, rot: 10 },
  );
  d.lines.push({ x1: g.fx(1600), y1: g.fy(470), x2: g.fx(1645), y2: g.fy(420) }); // 蹺蹺板
  d.fixtures.push({ kind: "box", ...g.box(1572, 500, 1640, 512) }); // 長椅
  tree("red", 30, [1027, 503]);
  tree("red", 22, [1513, 325]);
  tree("red", 25, [1512, 440], [1515, 557]);
  tree("blue", 18, [1250, 345], [1310, 345], [1385, 345], [1450, 345]);
  tree("purple", 45, [1295, 527]);
  tree("pink", 42, [1665, 562]);

  /* 建築周邊：坡道旁花台、綠化格、車道柏油、B 棟東側花台、店鋪後方花台 */
  area("planter", [1257, 600, 1304, 775], [380, 765, 576, 841]);
  area("hedge", [1316, 600, 1600, 617]);
  area("grid", [1205, 790, 1316, 828], [576, 760, 735, 775]);
  area("asphalt", [1660, 619, 1872, 765], [1316, 619, 1660, 765]);
  // 坡道：斜線鋪面 + 往地下室方向標示
  for (let x = 1330; x < 1660; x += 22) d.lines.push({ x1: g.fx(x), y1: g.fy(625), x2: g.fx(x - 14), y2: g.fy(760) });
  d.labels.push({ x: g.fx(1470), y: g.fy(745), text: "◀ 汽機車坡道往 B1", size: 0.55 });
  area("lawn", [1732, 893, 1786, 1083]);
  area("hedge", [1830, 845, 1858, 1050]);
  d.dashed.push(
    { x1: g.fx(1660), y1: g.fy(660), x2: g.fx(1872), y2: g.fy(660) },
    { x1: g.fx(1660), y1: g.fy(725), x2: g.fx(1872), y2: g.fy(725) },
    { x1: g.fx(1745), y1: g.fy(619), x2: g.fx(1745), y2: g.fy(765) },
  );
  tree("blue", 30, [410, 800], [500, 800], [585, 800]);
  tree("green", 18, [1844, 880], [1844, 960], [1844, 1030], [1810, 965]);

  /* 結構柱 */
  const C = 14;
  const cols: [number, number[]][] = [
    [611, [912, 1057, 1204, 1316, 1459, 1607]],
    [777, [783, 912, 1057, 1204, 1316, 1459, 1607, 1736]],
    [953, [412, 598, 782, 912, 1057, 1204, 1316, 1459, 1607, 1736]],
    [1083, [412, 598, 782, 912, 1057, 1204, 1379, 1459, 1607, 1736]],
  ];
  for (const [y, xs] of cols) for (const x of xs) d.columns.push(g.box(x - C / 2, y - C / 2, x + C / 2, y + C / 2));

  /* 核心：電梯、安全梯 */
  d.fixtures.push({ kind: "xbox", ...g.box(973, 822, 1009, 854) }, { kind: "xbox", ...g.box(1016, 822, 1051, 854) }, { kind: "xbox", ...g.box(1464, 826, 1504, 858) }, { kind: "xbox", ...g.box(1511, 826, 1550, 858) });
  d.stairs.push({ ...g.box(980, 926, 1051, 950), orient: "v", mid: g.fy(938) }, { ...g.box(1479, 926, 1550, 950), orient: "v", mid: g.fy(938) });

  /* 店鋪：上方樓梯與廁所、下方挑空（虛線 X） */
  const shops: [number, number, "v" | "h" | ""][] = [
    [412, 598, "v"], [598, 782, "v"], [782, 912, "v"], [912, 1057, "h"], [1057, 1146, ""], [1375, 1462, "h"], [1462, 1600, "h"], [1600, 1733, "v"],
  ];
  for (const [x1, x2, st] of shops) {
    const c = (x1 + x2) / 2;
    const top = x1 < 900 ? 955 : 1000;
    d.dashed.push({ x1: g.fx(x1 + 8), y1: g.fy(top), x2: g.fx(x2 - 8), y2: g.fy(1075) }, { x1: g.fx(x2 - 8), y1: g.fy(top), x2: g.fx(x1 + 8), y2: g.fy(1075) });
    if (st === "v") d.stairs.push({ ...g.box(c - 12, x1 < 900 ? 898 : 990, c + 12, x1 < 900 ? 950 : 1040), orient: "h", mid: g.fy(x1 < 900 ? 924 : 1015) });
    if (st === "h") d.stairs.push({ ...g.box(c - (x2 - x1) * 0.32, 992, c + (x2 - x1) * 0.32, 1008), orient: "v", mid: g.fy(1000) });
    if (x1 < 900) d.fixtures.push({ kind: "toilet", x: g.fx(c - 32), y: g.fy(882), dir: "D" }, { kind: "toilet", x: g.fx(c + 32), y: g.fy(882), dir: "D" });
  }
  // 主入口大門
  d.folds.push({ x1: g.fx(1225), y1: g.fy(950), x2: g.fx(1292), y2: g.fy(950), dir: "D" });

  /* 騎樓前廣場花台、南側道路行道樹 */
  area("lawn", [400, 1130, 465, 1200], [515, 1130, 630, 1200], [670, 1130, 770, 1200], [820, 1130, 875, 1185]);
  tree("green", 20, [432, 1175], [545, 1175], [600, 1175], [700, 1175], [745, 1175], [848, 1160]);
  for (const pts of [
    [[395, 1285], [590, 1270], [590, 1290], [395, 1305]],
    [[665, 1250], [805, 1240], [805, 1258], [665, 1268]],
    [[1010, 1205], [1125, 1197], [1125, 1215], [1010, 1223]],
    [[1240, 1185], [1455, 1170], [1455, 1188], [1240, 1203]],
    [[1580, 1170], [1770, 1158], [1770, 1176], [1580, 1188]],
  ] as [number, number][][])
    poly("planter", pts);
  tree("orange", 22, [420, 1290], [490, 1283], [555, 1278], [700, 1252], [775, 1247], [1045, 1208], [1110, 1203], [1270, 1185], [1345, 1180], [1420, 1175], [1620, 1167], [1690, 1162], [1745, 1160]);
}

/** 兩棟對稱軸與電梯中心的平面公尺座標（由 buildings.ts 傳入，與標準層一致） */
export function buildSitePlan(axisM: number, coreM: number) {
  // p.3：A 電梯中心 (1013, 840)、B (1508, 840)；兩核心距 495 px ≈ 18.2 m
  const g = pageMap(1260.5, 840, 0.0365, axisM, coreM);
  // p.8：A 電梯中心 (1125, 780)、B (1667, 780)；542 px ≈ 18.2 m
  const b = pageMap(1396, 780, 0.03358, axisM, coreM);

  const z = (m: typeof g, id: string, label: string, kind: ZoneKind, x1: number, y1: number, x2: number, y2: number, link?: string): Rect => ({
    id,
    label,
    kind,
    ...m.box(x1, y1, x2, y2),
    ...(link && { link }),
  });

  /* ── 1F ── */
  const ground: Rect[] = [
    z(g, "G-garden", "前庭綠帶", "garden", 883, 115, 1754, 298, "garden:front"),
    z(g, "G-court", "中庭花園", "garden", 904, 298, 1754, 598, "garden:court"),
    z(g, "G-west", "西側花台", "garden", 350, 761, 783, 844, "garden:west"),
    z(g, "G-side", "東側道路植栽", "garden", 1829, 240, 1867, 1032, "garden:side"),
    z(g, "G-walk", "人行道植栽帶", "garden", 392, 1136, 1767, 1323, "garden:sidewalk"),
    z(g, "G-shop1", "店鋪 1", "shop", 412, 844, 596, 1077, "shop"),
    z(g, "G-shop2", "店鋪 2", "shop", 596, 844, 779, 1077, "shop"),
    z(g, "G-shop3", "店鋪 3", "shop", 779, 844, 912, 1077, "shop"),
    z(g, "G-shop4", "店鋪 4", "shop", 912, 948, 1058, 1077, "shop"),
    z(g, "G-shop5", "店鋪 5", "shop", 1058, 948, 1146, 1077, "shop"),
    z(g, "G-shop6", "店鋪 6", "shop", 1375, 948, 1462, 1077, "shop"),
    z(g, "G-shop7", "店鋪 7", "shop", 1462, 948, 1600, 1077, "shop"),
    z(g, "G-shop8", "店鋪 8", "shop", 1600, 948, 1733, 1077, "shop"),
    z(g, "G-lobby", "社區大廳", "lobby", 904, 598, 1208, 782),
    z(g, "G-coreA", "A 棟梯廳", "core", 912, 782, 1058, 948),
    z(g, "G-hall", "門廳 / 公共走廊", "lobby", 1058, 782, 1312, 948),
    z(g, "G-coreB", "B 棟梯廳", "core", 1312, 765, 1562, 948),
    z(g, "G-mepB", "公設 / 機電", "mep", 1562, 782, 1733, 948),
    z(g, "G-mepA", "公設 / 機電", "mep", 787, 769, 912, 844),
    z(g, "G-entry", "主入口", "core", 1146, 948, 1375, 1077),
    z(g, "G-arcade", "騎樓 / 人行步道", "core", 408, 1077, 1746, 1136),
    z(g, "G-ramp", "車道出入口", "parking", 1312, 607, 1854, 765, "driveway"),
  ];

  const podium = g.poly([
    [412, 844], [787, 844], [787, 769], [904, 769], [904, 598], [1208, 598], [1208, 765], [1733, 765], [1733, 1077], [412, 1077],
  ]);
  const siteBoundary = g.poly([
    [846, 123], [1750, 123], [1852, 282], [1852, 1048], [1767, 1202], [392, 1323], [317, 732], [846, 711],
  ]);

  const W = (m: typeof g, x1: number, y1: number, x2: number, y2: number, ext = false) => ({ x1: m.fx(x1), y1: m.fy(y1), x2: m.fx(x2), y2: m.fy(y2), ext });
  const loop = (m: typeof g, pts: [number, number][], ext = true) => pts.map((p, i) => W(m, p[0], p[1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1], ext));
  const emptyDrawing = (unit: number): PlanDrawing => ({ walls: [], doors: [], folds: [], rails: [], dashed: [], lines: [], fixtures: [], stairs: [], polylines: [], unit });

  const groundDrawing = emptyDrawing(g.s);
  groundDrawing.walls.push(
    ...loop(g, [
      [412, 844], [787, 844], [787, 769], [904, 769], [904, 598], [1208, 598], [1208, 765], [1733, 765], [1733, 1077], [412, 1077],
    ]),
    // 店鋪分間牆
    ...[596, 779, 912, 1058].map((x) => W(g, x, x === 912 || x === 1058 ? 948 : 844, x, 1077)),
    W(g, 912, 948, 1146, 948), W(g, 1146, 948, 1146, 1077), W(g, 1375, 948, 1375, 1077), W(g, 1375, 948, 1733, 948),
    ...[1462, 1600].map((x) => W(g, x, 948, x, 1077)),
  );
  groundDrawing.dashed.push(...loop(g, [[846, 123], [1750, 123], [1852, 282], [1852, 1048], [1767, 1202], [392, 1323], [317, 732], [846, 711]], false));
  // 車道坡道（下坡箭頭方向朝西）
  addGroundDetail(g, groundDrawing);

  /* ── 地下室（B1 實測，B2–B4 沿用外框、核心與車道） ── */
  const bm = (lvl: number): Rect[] => {
    const p = `B${lvl}`;
    const zones: Rect[] = [
      { ...z(b, `${p}-rampCar`, "汽車坡道（螺旋）", "parking", 1020, 335, 1247, 605, "driveway"), poly: b.poly([[1020, 451], [1139, 335], [1247, 335], [1247, 605], [1020, 605]]) },
      z(b, `${p}-rampMoto`, "機車坡道（螺旋）", "parking", 1339, 428, 1585, 601, "driveway"),
      z(b, `${p}-rampStraight`, "汽車車道", "parking", 1328, 601, 1624, 708, "driveway"),
      z(b, `${p}-aisle`, lvl === 1 ? "車道 / 防空避難室兼停車空間" : "車道", "parking", 874, 605, 1701, 993),
      z(b, `${p}-aisleW`, "車道", "parking", 597, 897, 874, 993),
      z(b, `${p}-mN`, "機車停車區（北）", "parking", 1432, 239, 1905, 300),
      z(b, `${p}-mE`, "機車停車區（東）", "parking", 1689, 300, 1905, 712),
      z(b, `${p}-mM`, "機車停車區", "parking", 1585, 300, 1689, 601),
      z(b, `${p}-mC`, "機車停車區（中）", "parking", 1247, 343, 1585, 428),
      z(b, `${p}-mSE`, "機車停車區（東南）", "parking", 1620, 989, 1905, 1097),
      z(b, `${p}-carS`, lvl === 1 ? "汽車位 265–282" : "汽車位（南）", "parking", 628, 993, 1582, 1062),
      z(b, `${p}-carW`, lvl === 1 ? "汽車位 260–264" : "汽車位（西）", "parking", 628, 805, 870, 897),
      z(b, `${p}-carAcc`, lvl === 1 ? "無障礙車位 283–286" : "汽車位（中）", "parking", 1343, 797, 1566, 897),
      z(b, `${p}-eA`, "A 棟電梯", "elevator", 1072, 762, 1177, 797),
      z(b, `${p}-vA`, "A 棟排煙室兼梯廳", "core", 1068, 800, 1180, 838),
      z(b, `${p}-sA`, "A 棟安全梯", "stair", 1090, 838, 1180, 890),
      z(b, `${p}-eB`, "B 棟電梯", "elevator", 1614, 762, 1720, 797),
      z(b, `${p}-vB`, "B 棟排煙室兼梯廳", "core", 1612, 800, 1720, 838),
      z(b, `${p}-sB`, "B 棟安全梯", "stair", 1612, 838, 1700, 890),
    ];
    if (lvl === 1)
      zones.push(
        z(b, "B1-tpc", "台電配電場所", "mep", 489, 858, 597, 1093),
        z(b, "B1-gen", "緊急發電機房", "mep", 1720, 712, 1905, 789),
        z(b, "B1-fcc", "防災中心", "mep", 1720, 793, 1832, 897),
        z(b, "B1-trashB", "垃圾及資源回收空間（B 棟）", "mep", 1832, 793, 1905, 920),
        z(b, "B1-tel", "電信機房", "mep", 1839, 920, 1905, 989),
        z(b, "B1-trashA", "垃圾及資源回收空間（A 棟）", "mep", 978, 805, 1070, 905),
        z(b, "B1-mech", "機房", "mep", 885, 724, 1024, 793),
      );
    else zones.push(z(b, `${p}-mep`, lvl === 4 ? "機電 / 筏基水箱" : "機電空間", "mep", 489, 858, 597, 1093));
    return zones;
  };

  const basementOutline = b.poly([
    [1428, 232], [1905, 232], [1905, 1097], [489, 1097], [489, 793], [874, 793], [874, 712], [1020, 712], [1020, 451], [1139, 335], [1428, 335],
  ]);

  const basementDrawing = emptyDrawing(b.s);
  basementDrawing.walls.push(
    ...loop(b, [
      [1428, 232], [1905, 232], [1905, 1097], [489, 1097], [489, 793], [874, 793], [874, 712], [1020, 712], [1020, 451], [1139, 335], [1428, 335],
    ]),
  );
  // 汽車位：[x1, x2, 車位數]，南排 y 993–1062、西排 y 805–897
  const stallRows: [number, number, number, number, number][] = [
    [628, 674, 1, 993, 1062], [693, 870, 4, 993, 1062], [905, 997, 2, 993, 1062], [1032, 1166, 3, 993, 1062], [1189, 1232, 1, 993, 1062], [1266, 1582, 7, 993, 1062],
    [628, 674, 1, 805, 897], [693, 870, 4, 805, 897], [1343, 1443, 2, 797, 897], [1466, 1566, 2, 797, 897],
  ];
  for (const [x1, x2, n, y1, y2] of stallRows) {
    const w = (x2 - x1) / n;
    for (let i = 0; i < n; i++) basementDrawing.fixtures.push({ kind: "box", ...b.box(x1 + i * w, y1, x1 + (i + 1) * w, y2) });
  }
  // 螺旋坡道（圓弧近似）
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) =>
    Array.from({ length: 24 }, (_, i) => {
      const a = ((a0 + ((a1 - a0) * i) / 23) * Math.PI) / 180;
      return [b.fx(cx + r * Math.cos(a)), b.fy(cy + r * Math.sin(a))] as [number, number];
    });
  basementDrawing.polylines.push(arc(1190, 520, 165, 140, 290), arc(1190, 520, 70, 140, 290), arc(1320, 515, 85, 90, 290), arc(1320, 515, 35, 90, 290));
  basementDrawing.stairs.push({ ...b.box(1328, 610, 1620, 700), orient: "v", mid: b.fy(655) });
  basementDrawing.fixtures.push(
    { kind: "xbox", ...b.box(1078, 765, 1124, 795) }, { kind: "xbox", ...b.box(1128, 765, 1174, 795) },
    { kind: "xbox", ...b.box(1617, 765, 1663, 795) }, { kind: "xbox", ...b.box(1667, 765, 1713, 795) },
  );
  basementDrawing.stairs.push({ ...b.box(1095, 845, 1175, 885), orient: "v", mid: b.fy(865) }, { ...b.box(1617, 845, 1697, 885), orient: "v", mid: b.fy(865) });

  /* ── 公共區域花圃 ── */
  const bed = (id: string, label: string, x1: number, y1: number, x2: number, y2: number): Rect => ({ id, label, kind: "garden", ...g.box(x1, y1, x2, y2) });
  const area = (id: string, name: string, description: string, x1: number, y1: number, x2: number, y2: number, beds: Rect[]): PublicArea => ({
    id,
    name,
    kind: "garden",
    description,
    bounds: g.box(x1, y1, x2, y2),
    beds,
  });
  const treeLine = (prefix: string, label: string, pts: [number, number][], size = 28) =>
    pts.map(([x, y], i) => bed(`${prefix}${i + 1}`, `${label} ${i + 1}`, x - size / 2, y - size / 2, x + size / 2, y + size / 2));

  const publicAreas: PublicArea[] = [
    area("front", "前庭綠帶", "北側道路側千坪綠化：一排行道樹、三座長花台與中庭外環樹列。", 883, 115, 1754, 298, [
      bed("F1", "前庭樹列", 904, 123, 1729, 148),
      bed("F2", "前庭花台 1", 907, 190, 1113, 215),
      bed("F3", "前庭花台 2", 1167, 190, 1500, 215),
      bed("F4", "前庭花台 3", 1554, 190, 1729, 215),
      bed("F5", "中庭外環樹列", 925, 244, 1746, 282),
    ]),
    area("court", "中庭花園", "A、B 棟後方中庭：草坪、花台、樹穴與兒童遊戲區。", 904, 298, 1754, 598, [
      bed("C1", "草坪（西）", 962, 311, 1179, 436),
      bed("C2", "樹穴 1", 998, 473, 1065, 548),
      bed("C3", "花台 1", 1233, 319, 1350, 382),
      bed("C4", "花台 2", 1371, 319, 1488, 382),
      bed("C5", "L 形花台", 1346, 407, 1475, 440),
      bed("C6", "L 形花台（南）", 1475, 407, 1533, 552),
      bed("C7", "花台 3", 1350, 519, 1442, 552),
      bed("C8", "樹穴 2", 1504, 302, 1533, 365),
      bed("C9", "兒童遊戲區", 1533, 311, 1696, 507),
      bed("C10", "草坪（東南）", 1571, 507, 1700, 582),
      bed("C11", "西側綠籬", 904, 307, 958, 594),
      bed("C12", "東側綠籬", 1700, 298, 1754, 598),
    ]),
    area("sidewalk", "人行道植栽帶", "南側道路：四座廣場花台與行道樹。", 392, 1136, 1767, 1323, [
      bed("P1", "廣場花台 1", 412, 1136, 479, 1211),
      bed("P2", "廣場花台 2", 529, 1136, 658, 1211),
      bed("P3", "廣場花台 3", 708, 1136, 850, 1211),
      bed("P4", "廣場花台 4", 869, 1136, 958, 1211),
      ...treeLine("S", "樹穴", Array.from({ length: 14 }, (_, i) => [430 + i * 100, 1290 - i * 100 * (100 / 1305)] as [number, number])),
    ]),
    area("side", "東側道路植栽", "東側道路行道樹。", 1825, 240, 1871, 1032, [
      ...treeLine("R", "樹穴", [[1848, 300], [1848, 375], [1848, 450], [1848, 525], [1848, 600], [1848, 900], [1848, 965], [1848, 1025]]),
    ]),
    area("west", "西側花台", "1F 店鋪後方與西側地界綠帶。", 350, 761, 783, 1073, [
      bed("W1", "西側花台", 360, 768, 780, 840),
      bed("W2", "西側綠帶", 355, 840, 405, 1070),
    ]),
    {
      id: "driveway",
      name: "車道",
      kind: "driveway",
      description: "東側道路車道出入口，汽車、機車分道，坡道通往 B1–B4。",
      bounds: g.box(1312, 607, 1854, 765),
      beds: [],
    },
  ];

  return { ground, groundDrawing, podium, siteBoundary, basement: bm, basementDrawing, basementOutline, publicAreas };
}
