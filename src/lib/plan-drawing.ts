// 標準層向量圖：牆、門、門窗、衛浴廚具、電梯、樓梯。
// 座標為對照銷售簡介平面圖量出的像素值（與 buildings.ts 的 PX/PY 同一基準），
// 由 toMeters() 換算為平面圖公尺座標；B 棟與 A 棟左右鏡像。

type Dir = "U" | "D" | "L" | "R";
/** x1, y1, x2, y2, 外牆 / 結構牆 = 1 */
type WallPx = [number, number, number, number, 0 | 1];
/** 門軸 hx,hy；門扇開啟端 ox,oy；關閉端 cx,cy */
type DoorPx = [number, number, number, number, number, number];
/** 落地門 / 窗（折疊門符號），三角形朝 dir（室外側） */
type FoldPx = [number, number, number, number, Dir];
type LinePx = [number, number, number, number];
type FixturePx =
  | ["toilet", number, number, Dir] // 中心、馬桶座朝向
  | ["basin", number, number]
  | ["tub" | "stove" | "ksink" | "box" | "xbox" | "hatch", number, number, number, number];
/** 樓梯：外框、踏階方向（v = 垂直線排列）、中央扶手位置 */
type StairPx = [number, number, number, number, "v" | "h", number];

type DrawingPx = {
  walls: WallPx[];
  doors: DoorPx[];
  folds: FoldPx[];
  rails: LinePx[];
  dashed: LinePx[];
  lines: LinePx[];
  fixtures: FixturePx[];
  stairs: StairPx[];
  polylines: [number, number][][];
};

const A1: DrawingPx = {
  walls: [
    [177, 52, 296, 52, 1], [170, 53, 170, 190, 1], [170, 208, 275, 208, 1],
    [211, 53, 211, 107, 0], [211, 107, 236, 107, 0], [251, 53, 251, 93, 0],
    [170, 108, 196, 108, 0], [196, 108, 196, 180, 0], [196, 196, 196, 208, 0],
    [170, 134, 196, 134, 0], [170, 158, 196, 158, 0],
    [196, 122, 229, 122, 0], [229, 122, 229, 153, 0], [229, 167, 229, 180, 0], [196, 180, 229, 180, 0],
    [244, 163, 270, 163, 0], [270, 163, 270, 208, 0], [244, 177, 244, 208, 0], [244, 191, 270, 191, 0],
  ],
  doors: [
    [251, 107, 251, 93, 237, 107], [196, 110, 183, 110, 196, 123], [195, 135, 186, 135, 195, 144],
    [228, 122, 228, 109, 215, 122], [229, 167, 215, 167, 229, 153], [196, 196, 182, 196, 196, 183],
    [243, 191, 243, 177, 229, 191], [292, 208, 292, 190, 276, 208],
  ],
  folds: [
    [191, 52, 203, 52, "U"], [237, 52, 250, 52, "U"], [258, 52, 270, 52, "U"], [283, 52, 295, 52, "U"],
    [170, 57, 170, 68, "L"], [170, 81, 170, 90, "L"], [170, 121, 170, 131, "L"],
  ],
  rails: [[160, 37, 296, 37], [160, 53, 160, 140], [170, 160, 170, 190]],
  dashed: [[229, 122, 264, 122], [264, 122, 264, 151], [264, 151, 229, 151]],
  lines: [[196, 196, 243, 196]],
  fixtures: [
    ["basin", 176, 116], ["toilet", 178, 127, "R"], ["basin", 174.5, 140], ["tub", 171.5, 147, 193.5, 157],
    ["stove", 196.5, 197, 208.5, 206.5], ["ksink", 220, 197, 229, 205.5],
    ["basin", 264, 169], ["toilet", 264, 185, "L"], ["box", 262, 194, 269, 204], ["hatch", 212, 45, 230, 49],
  ],
  stairs: [],
  polylines: [],
};

const mirrorX = (x: number, axis: number) => axis - x;
const flipDir = (d: Dir): Dir => (d === "L" ? "R" : d === "R" ? "L" : d);

/** 以 x = axis/2 為軸左右鏡像（A1 → A2：axis = 604，對照 PDF 量得） */
function mirrorPx(d: DrawingPx, axis: number): DrawingPx {
  const m = (x: number) => mirrorX(x, axis);
  const seg = ([x1, y1, x2, y2]: LinePx): LinePx => [m(x1), y1, m(x2), y2];
  return {
    walls: d.walls.map(([x1, y1, x2, y2, e]) => [m(x1), y1, m(x2), y2, e]),
    doors: d.doors.map(([hx, hy, ox, oy, cx, cy]) => [m(hx), hy, m(ox), oy, m(cx), cy]),
    folds: d.folds.map(([x1, y1, x2, y2, dir]) => [m(x1), y1, m(x2), y2, flipDir(dir)]),
    rails: d.rails.map(seg),
    dashed: d.dashed.map(seg),
    lines: d.lines.map(seg),
    fixtures: d.fixtures.map((f) => {
      if (f[0] === "toilet") return ["toilet", m(f[1]), f[2], flipDir(f[3])];
      if (f[0] === "basin") return ["basin", m(f[1]), f[2]];
      return [f[0], m(f[3]), f[2], m(f[1]), f[4]];
    }),
    stairs: d.stairs.map(([x1, y1, x2, y2, o, mid]) => [m(x2), y1, m(x1), y2, o, mid]),
    polylines: d.polylines.map((pl) => pl.map(([x, y]) => [m(x), y] as [number, number])),
  };
}

const A7: DrawingPx = {
  walls: [
    [55, 208, 160, 208, 1], [47, 208, 47, 311, 1], [176, 208, 176, 263, 1], [176, 282, 176, 360, 1], [55, 361, 160, 361, 1],
    [88, 208, 88, 259, 0], [88, 259, 110, 259, 0], [127, 208, 127, 244, 0],
    [47, 261, 72, 261, 0], [72, 261, 72, 334, 0], [47, 286, 72, 286, 0], [47, 311, 72, 311, 0],
    [72, 275, 88, 275, 0], [72, 300, 127, 300, 0], [127, 300, 127, 316, 0], [72, 333, 127, 333, 0],
    [71, 349, 71, 361, 0], [127, 345, 127, 361, 0], [143, 332, 175, 332, 0], [143, 332, 143, 361, 0],
  ],
  doors: [
    [127, 259, 127, 244, 111, 259], [72, 262, 60.5, 262, 72, 273.5], [72, 287, 63, 287, 72, 296],
    [86.4, 273, 73, 273, 86.4, 260], [127, 331, 113, 331, 127, 316], [71, 349, 59, 349, 71, 337],
    [175, 282, 158, 282, 175, 264], [158, 333, 158, 346, 145, 333],
  ],
  folds: [
    [57, 208, 68, 208, "U"], [95, 208, 104, 208, "U"], [129, 208, 138, 208, "U"], [148, 208, 158, 208, "U"],
    [47, 213, 47, 221, "L"], [47, 234, 47, 241, "L"], [47, 276, 47, 284, "L"],
  ],
  rails: [[55, 192, 160, 192], [34, 208, 34, 312], [47, 312, 47, 355]],
  dashed: [[88, 275, 127, 275], [127, 275, 127, 300]],
  lines: [[72, 350, 125, 350]],
  fixtures: [
    ["basin", 52, 267], ["toilet", 54, 280, "R"], ["basin", 52, 293], ["tub", 48.6, 301.4, 70.7, 310],
    ["stove", 72, 351, 85, 360], ["ksink", 99, 351, 109, 359.5], ["basin", 135, 356], ["toilet", 151, 348, "U"],
  ],
  stairs: [],
  polylines: [],
};

const A6: DrawingPx = {
  walls: [
    [47, 375, 47, 423, 1], [47, 438, 47, 481, 1], [168, 405, 168, 481, 1], [53, 481, 160, 481, 1], [166, 405, 175, 405, 0],
    [65, 391, 65, 423, 0], [47, 423, 99, 423, 0], [65, 391, 99, 391, 0], [114, 362, 114, 380, 0],
    [142, 362, 142, 405, 0], [115, 405, 142, 405, 0], [126, 377, 142, 377, 0],
    [85, 439, 85, 481, 0], [85, 439, 108.6, 439, 0], [123, 439, 123, 481, 0],
  ],
  doors: [
    [65, 376, 50, 376, 65, 391], [114, 392, 114, 379, 99, 392], [168, 381, 154, 381, 168, 395],
    [123, 439, 123, 453, 109, 439], [86, 439, 99, 439, 86, 426], [126, 377, 118, 377, 126, 369],
  ],
  folds: [
    [58, 481, 66, 481, "D"], [109, 481, 118, 481, "D"], [150, 481, 159, 481, "D"],
    [47, 451, 47, 460, "L"], [47, 471, 47, 476, "L"],
  ],
  rails: [[34, 437, 34, 481], [53, 497, 160, 497]],
  dashed: [[99, 392, 99, 418]],
  lines: [[52, 375.5, 98, 375.5]],
  fixtures: [
    ["stove", 69.3, 361.4, 80, 370.7], ["ksink", 88, 361.4, 98.6, 370.7], ["box", 52, 362, 65, 375],
    ["toilet", 136, 385, "L"], ["basin", 137, 398.5], ["basin", 138, 368],
    ["hatch", 86, 485, 104, 489], ["hatch", 35, 418, 46, 437],
  ],
  stairs: [],
  polylines: [],
};

const A5: DrawingPx = {
  walls: [
    [167, 405, 167, 481, 1], [167, 405, 186, 405, 0], [204, 405, 211, 405, 0],
    [211, 369, 211, 405, 0], [238, 369, 238, 392, 0], [211, 405, 225, 405, 0],
    [286, 369, 286, 382, 0], [286, 395, 286, 431, 0], [254, 397, 286, 397, 0], [254, 397, 254, 407, 0],
    [254, 431, 301, 431, 0], [301, 431, 301, 481, 1], [176, 481, 296, 481, 1],
    [211, 438, 211, 481, 0], [211, 447, 220, 447, 0], [234, 447, 262, 447, 0], [262, 447, 262, 481, 0],
  ],
  doors: [
    [186, 406, 186, 424, 204, 406], [238, 406, 238, 392, 225, 406], [240, 406, 240, 392, 254, 406],
    [286, 381, 299, 381, 286, 395], [255, 431, 269, 431, 255, 445], [220, 447, 220, 461, 234, 447],
  ],
  folds: [[179, 481, 186, 481, "D"], [200, 481, 206, 481, "D"], [223, 481, 231, 481, "D"], [273, 481, 281, 481, "D"]],
  rails: [[300, 382, 300, 431], [176, 494, 296, 494]],
  dashed: [[254, 407, 254, 430]],
  lines: [[251, 380, 285, 380]],
  fixtures: [
    ["toilet", 217, 393, "R"], ["basin", 232, 375], ["basin", 218, 403],
    ["ksink", 251.4, 370.7, 262, 378.6], ["stove", 270.7, 370.7, 281.4, 379.3],
  ],
  stairs: [],
  polylines: [[[211, 383], [220, 383], [226, 374]]],
};

const A3: DrawingPx = {
  walls: [
    [303, 243, 303, 360, 1], [295, 242, 314, 242, 0], [335, 226, 335, 285, 0], [334, 250, 437, 250, 1],
    [350, 250, 350, 285, 0], [373, 250, 373, 284, 0], [350, 285, 386, 285, 0], [360, 266, 373, 266, 0],
    [409, 251, 409, 280, 0], [399, 285, 437, 285, 0], [437, 250, 437, 360, 1],
    [397, 318, 437, 318, 0], [346, 318, 365, 318, 0], [346, 318, 346, 360, 0], [381, 331, 381, 360, 0],
    [314, 360, 430, 360, 1],
  ],
  doors: [
    [332, 243, 332, 261, 314, 243], [386, 285, 386, 271, 399, 285], [409, 282, 421, 282, 409, 269],
    [381, 318, 381, 332, 366, 318], [383, 318, 383, 331, 397, 318], [356, 209, 371, 209, 356, 224],
    [351, 270, 351, 261, 359, 270],
  ],
  folds: [
    [315, 360, 323, 360, "D"], [335, 360, 342, 360, "D"], [355, 360, 365, 360, "D"], [395, 360, 402, 360, "D"], [414, 360, 421, 360, "D"],
    [437, 299, 437, 312, "R"], [437, 326, 437, 337, "R"], [437, 349, 437, 357, "R"],
  ],
  rails: [[314, 375, 430, 375], [445, 285, 445, 360]],
  dashed: [[399, 286, 399, 316]],
  lines: [[374, 261, 409, 261], [368.6, 240.7, 380, 250]],
  fixtures: [
    ["box", 335.7, 252, 348.6, 258.6], ["basin", 342, 265], ["toilet", 366, 273.5, "L"],
    ["ksink", 374.3, 253.6, 384.3, 260.7], ["stove", 392, 253, 403.6, 261.4],
    ["xbox", 334, 226, 349, 250], ["box", 349, 226, 360, 250], ["box", 360, 226, 368.6, 250],
  ],
  stairs: [[386, 209, 437, 250, "v", 229]],
  polylines: [],
};

const CORE: DrawingPx = {
  walls: [
    [304, 53, 304, 190, 1], // A1 / A2 分戶牆
    [210, 242, 314, 242, 1], [211, 242, 211, 282, 1], [211, 310, 211, 406, 1], [220, 243, 220, 277, 0],
    [262, 243, 262, 278, 1], [302, 243, 302, 360, 1],
    [211, 278, 233, 278, 0], [251, 278, 273, 278, 0], [291, 278, 302, 278, 0],
    [211, 313, 285, 313, 1], [211, 369, 303, 369, 1],
  ],
  doors: [[211, 283, 224, 283, 211, 296.5], [211, 310, 224, 310, 211, 296.5], [300, 314, 300, 328, 286, 314]],
  folds: [],
  rails: [],
  dashed: [],
  lines: [],
  fixtures: [["box", 211, 243, 219, 277], ["box", 251, 315, 283.6, 325.7]],
  stairs: [[236, 325, 281, 367, "v", 346.8]],
  polylines: [[[283.6, 325], [227, 325], [213, 338], [213, 357], [227, 369]]],
};

// 電梯車廂（X 框）
const ELEVATORS: LinePx[] = [
  [225, 251.4, 257, 275],
  [265.7, 251.4, 297.9, 275],
];

const A_PX: DrawingPx[] = [A1, mirrorPx(A1, 604), A7, A6, A5, A3, CORE];

/* ── 換算為公尺 ── */

export type PlanDrawing = {
  walls: { x1: number; y1: number; x2: number; y2: number; ext: boolean }[];
  doors: { hx: number; hy: number; ox: number; oy: number; cx: number; cy: number }[];
  folds: { x1: number; y1: number; x2: number; y2: number; dir: Dir }[];
  rails: LineM[];
  dashed: LineM[];
  lines: LineM[];
  fixtures: (
    | { kind: "toilet"; x: number; y: number; dir: Dir }
    | { kind: "basin"; x: number; y: number }
    | { kind: "tub" | "stove" | "ksink" | "box" | "xbox" | "hatch"; x: number; y: number; w: number; h: number }
  )[];
  stairs: { x: number; y: number; w: number; h: number; orient: "v" | "h"; mid: number }[];
  polylines: [number, number][][];
  /** 繪圖單位：原圖 1 px 對應的公尺數 */
  unit: number;
  /** 地面（1F 景觀）：草坪、花台、鋪面、道路… */
  areas?: { pts: [number, number][]; kind: GroundKind }[];
  trees?: { x: number; y: number; r: number; tone: TreeTone }[];
  blobs?: { x: number; y: number; rx: number; ry: number; rot: number }[];
  columns?: { x: number; y: number; w: number; h: number }[];
  labels?: { x: number; y: number; text: string; size: number; vertical?: boolean }[];
};
export type GroundKind = "road" | "asphalt" | "paving" | "lawn" | "planter" | "hedge" | "play" | "grid";
export type TreeTone = "green" | "orange" | "pink" | "red" | "purple" | "blue";
type LineM = { x1: number; y1: number; x2: number; y2: number };

export function toMeters(PX: (x: number) => number, PY: (y: number) => number, unit: number, flipX?: (x: number) => number): PlanDrawing {
  const fx = (x: number) => (flipX ? flipX(PX(x)) : PX(x));
  const fd = (d: Dir) => (flipX ? flipDir(d) : d);
  const line = ([x1, y1, x2, y2]: LinePx): LineM => ({ x1: fx(x1), y1: PY(y1), x2: fx(x2), y2: PY(y2) });
  const rect = (x1: number, y1: number, x2: number, y2: number) => {
    const a = fx(x1);
    const b = fx(x2);
    return { x: Math.min(a, b), y: PY(y1), w: Math.abs(b - a), h: PY(y2) - PY(y1) };
  };
  const out: PlanDrawing = { walls: [], doors: [], folds: [], rails: [], dashed: [], lines: [], fixtures: [], stairs: [], polylines: [], unit };
  for (const d of A_PX) {
    out.walls.push(...d.walls.map(([x1, y1, x2, y2, e]) => ({ ...line([x1, y1, x2, y2]), ext: e === 1 })));
    out.doors.push(...d.doors.map(([hx, hy, ox, oy, cx, cy]) => ({ hx: fx(hx), hy: PY(hy), ox: fx(ox), oy: PY(oy), cx: fx(cx), cy: PY(cy) })));
    out.folds.push(...d.folds.map(([x1, y1, x2, y2, dir]) => ({ ...line([x1, y1, x2, y2]), dir: fd(dir) })));
    out.rails.push(...d.rails.map(line));
    out.dashed.push(...d.dashed.map(line));
    out.lines.push(...d.lines.map(line));
    out.fixtures.push(
      ...d.fixtures.map((f) => {
        if (f[0] === "toilet") return { kind: "toilet" as const, x: fx(f[1]), y: PY(f[2]), dir: fd(f[3]) };
        if (f[0] === "basin") return { kind: "basin" as const, x: fx(f[1]), y: PY(f[2]) };
        return { kind: f[0], ...rect(f[1], f[2], f[3], f[4]) };
      }),
    );
    out.stairs.push(...d.stairs.map(([x1, y1, x2, y2, orient, mid]) => ({ ...rect(x1, y1, x2, y2), orient, mid: PY(mid) })));
    out.polylines.push(...d.polylines.map((pl) => pl.map(([x, y]) => [fx(x), PY(y)] as [number, number])));
  }
  out.fixtures.push(...ELEVATORS.map(([x1, y1, x2, y2]) => ({ kind: "xbox" as const, ...rect(x1, y1, x2, y2) })));
  return out;
}
