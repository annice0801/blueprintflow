"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Grid, Html, Line as DreiLine, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { floorElevation, getDetail, getZones, type Building, type Floor, type Rect, type TowerId } from "@/lib/buildings";
import { ALERT, alertOf, TOWER_LABEL, type AlertLevel, type Issue } from "@/lib/issues";
import type { Plant } from "@/lib/records";

export type FloorKey = { tower: TowerId; floor: string };

type Props = {
  building: Building;
  issues: Issue[];
  plants: Plant[];
  selected: FloorKey | null;
  onSelect: (key: FloorKey) => void;
  onHover: (key: FloorKey | null) => void;
  onPlant: (plant: Plant) => void;
  onIssue: (issue: Issue) => void;
  /** 樓層炸裂展開 0–1 */
  explode: number;
  /** 顯示的光圈等級 */
  levels: AlertLevel[];
};

/** 完全展開時每層額外拉開的距離 */
const GAP = 4;
/** 樓層相對 1F 的展開位移（地下室往下） */
const liftOf = (f: Floor, gap: number) => (f.level > 0 ? f.level - 1 : f.level) * gap;

const CYAN = new THREE.Color("#4cc9ff");
const DIM = new THREE.Color("#1d5f8a");
const WARN = new THREE.Color(ALERT.orange.color);
const HOT = new THREE.Color(ALERT.red.color);


export default function BuildingScene(props: Props) {
  const { building } = props;
  const top = (floorElevation(building, "RF") + 3.4) * building.planScale;
  return (
    <Canvas
      camera={{ position: [105, 78, 135], fov: 42, near: 0.5, far: 1200 }}
      gl={{ antialias: true }}
      onPointerMissed={() => props.onHover(null)}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#020814"]} />
      <fog attach="fog" args={["#020814", 140 + 160 * props.explode, 420 + 260 * props.explode]} />
      <ambientLight intensity={0.4} />
      <Model {...props} />
      <City />
      <Grid
        position={[0, 0.01, 0]}
        args={[600, 600]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#0c3a5c"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#1b74a8"
        fadeDistance={320}
        fadeStrength={1.4}
        infiniteGrid
      />
      <OrbitControls makeDefault target={[0, top * 0.42, 0]} maxPolarAngle={Math.PI * 0.62} minDistance={25} maxDistance={420} enableDamping />
      <CameraRig base={top * 0.42} explode={props.explode} />
      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}

function Model({ building, issues, plants, selected, onSelect, onHover, onPlant, onIssue, explode, levels }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const [hoverIssue, setHoverIssue] = useState<string | null>(null);
  const gap = explode * GAP;
  const { w, h } = building.site;
  // 高度依實際樓高 × 平面示意比例，讓立面與平面比例一致
  const k = building.planScale;
  const fh = building.floorHeight * k;
  // 平面（公尺）→ 3D 座標，基地置中
  const toV = (x: number, y: number, z: number) => new THREE.Vector3(x - w / 2, z, y - h / 2);
  const floorY = (f: Floor) => floorElevation(building, f.id) * k;
  const roofY = floorElevation(building, "RF") * k;

  const openByFloor = useMemo(() => {
    const m = new Map<string, { open: number; high: number }>();
    for (const i of issues) {
      const lv = alertOf(i);
      if (lv === "green") continue;
      const k = `${i.tower}:${i.floor}`;
      const v = m.get(k) ?? { open: 0, high: 0 };
      v.open++;
      if (lv === "red") v.high++;
      m.set(k, v);
    }
    return m;
  }, [issues]);

  const slabs = building.floors.flatMap((f) =>
    f.towers.map((t) => {
      const outline = t === "S" ? (f.level < 0 ? building.basementOutline : building.podium) : building.towers.find((x) => x.id === t)!.footprint;
      return { f, t, outline, key: `${t}:${f.id}` };
    }),
  );

  // 立面直櫺：每棟每邊約 1.6m 一條，從 2F 到屋頂
  const mullions = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const y0 = floorElevation(building, "2F") * k;
    const y1 = roofY;
    for (const t of building.towers) {
      const fp = t.footprint;
      fp.forEach(([x1, y1p], i) => {
        const [x2, y2] = fp[(i + 1) % fp.length];
        const len = Math.hypot(x2 - x1, y2 - y1p);
        const n = Math.max(1, Math.round(len / 1.6));
        for (let k = 0; k < n; k++) {
          const a = k / n;
          const x = x1 + (x2 - x1) * a;
          const y = y1p + (y2 - y1p) * a;
          pts.push(toV(x, y, y0), toV(x, y, y1));
        }
      });
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building]);

  return (
    <group>
      {/* 立面直櫺跨越樓層，展開時淡出 */}
      {explode < 0.25 && (
        <lineSegments geometry={mullions}>
          <lineBasicMaterial color={CYAN} transparent opacity={0.28 * (1 - explode * 4)} toneMapped={false} />
        </lineSegments>
      )}

      {slabs.map(({ f, t, outline, key }) => {
        const stats = openByFloor.get(key);
        const isSel = selected?.tower === t && selected.floor === f.id;
        const isHover = hover === key;
        const base = f.level < 0 ? DIM : CYAN;
        const color = stats?.high ? HOT : stats ? WARN : base;
        const height = f.id === "RF" ? fh * 0.6 : f.height * k;
        return (
          <Lift key={key} y={liftOf(f, gap)}>
          <Slab
            outline={outline}
            y={floorY(f)}
            height={height}
            toV={toV}
            color={color}
            emphasis={isSel ? 2 : isHover ? 1 : 0}
            dim={f.level < 0}
            plate={explode}
            onOver={(e) => {
              e.stopPropagation();
              setHover(key);
              onHover({ tower: t, floor: f.id });
            }}
            onOut={() => {
              setHover((k) => (k === key ? null : k));
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ tower: t, floor: f.id });
            }}
          />
            {explode > 0.12 && <Interior floor={f.id} tower={t} y={floorY(f)} height={height} toV={toV} opacity={Math.min(1, (explode - 0.12) * 2.5)} />}
          </Lift>
        );
      })}

      {/* 屋突、天線 */}
      {building.towers.map((t) => {
        // 屋突放在核心筒（梯廳 / 電梯）上方
        const xs = t.footprint.map((p) => p[0]);
        const ys = t.footprint.map((p) => p[1]);
        const [cx, cy] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
        const y = roofY + fh * 0.6;
        return (
          <Lift key={t.id} y={liftOf(building.floors.find((f) => f.id === "RF")!, gap)}>
            <mesh position={toV(cx, cy, y + 2)}>
              <boxGeometry args={[5, 4, 5]} />
              <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.5} toneMapped={false} />
            </mesh>
            <Line points={[toV(cx, cy, y + 4), toV(cx, cy, y + 9)]} color={CYAN} />
            <Label text={t.name} position={toV(cx, cy, y + 11.5)} />
          </Lift>
        );
      })}

      {/* 植栽：綠色線框樹 */}
      {plants.map((p) => (
        <Tree
          key={p.id}
          position={toV(p.x, p.y, 0)}
          color={p.health === "良好" ? "#34d399" : p.health === "已移除" ? "#475569" : p.health === "需注意" ? "#ffb020" : "#ff4d6d"}
          onClick={(e) => {
            e.stopPropagation();
            onPlant(p);
          }}
        />
      ))}

      {/* 修繕標記：警示光圈（紅 / 橘 / 綠）＋呼吸動態 */}
      {issues.map((i) => {
        const f = building.floors.find((x) => x.id === i.floor);
        const level = alertOf(i);
        if (!f || !levels.includes(level)) return null;
        return (
          <Lift key={i.id} y={liftOf(f, gap)}>
            <Beacon
              position={toV(i.x, i.y, floorY(f) + 0.06)}
              height={f.height * k}
              level={level}
              seed={i.id}
              active={hoverIssue === i.id}
              onOver={() => setHoverIssue(i.id)}
              onOut={() => setHoverIssue((h) => (h === i.id ? null : h))}
              onClick={() => onIssue(i)}
            >
              {hoverIssue === i.id && <IssueTip issue={i} level={level} />}
            </Beacon>
          </Lift>
        );
      })}
    </group>
  );
}

function Slab({
  outline,
  y,
  height,
  toV,
  color,
  emphasis,
  dim,
  plate,
  onOver,
  onOut,
  onClick,
}: {
  outline: [number, number][];
  y: number;
  height: number;
  toV: (x: number, y: number, z: number) => THREE.Vector3;
  color: THREE.Color;
  emphasis: 0 | 1 | 2;
  dim: boolean;
  /** 展開程度：樓板加實，方便看出每層板塊 */
  plate: number;
  onOver: (e: ThreeEvent<PointerEvent>) => void;
  onOut: () => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { loop, shape } = useMemo(() => {
    const loop = [...outline, outline[0]].map(([x, yy]) => toV(x, yy, 0));
    // Shape 在 XY 平面，旋轉成水平；y 取負讓旋轉後對應到 +Z
    const shape = new THREE.Shape(
      outline.map(([x, yy]) => {
        const v = toV(x, yy, 0);
        return new THREE.Vector2(v.x, -v.z);
      }),
    );
    return { loop, shape };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outline]);

  const opacity = emphasis === 2 ? 1 : emphasis === 1 ? 0.95 : dim ? 0.35 : 0.7;
  const fill = emphasis === 2 ? 0.35 : emphasis === 1 ? 0.18 : 0.02 * (1 - plate);

  return (
    <group position={[0, y, 0]}>
      <Line points={loop} color={color} opacity={opacity} width={emphasis ? 2.4 : 1.2} />
      {emphasis > 0 && <Line points={loop.map((p) => p.clone().setY(height))} color={color} opacity={opacity} width={2.4} />}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onClick={onClick}
      >
        <extrudeGeometry args={[shape, { depth: height * 0.96, bevelEnabled: false }]} />
        <meshBasicMaterial color={color} transparent opacity={fill} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* 展開時顯示樓板（薄板） */}
      {plate > 0.05 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <extrudeGeometry args={[shape, { depth: 0.12, bevelEnabled: false }]} />
          <meshBasicMaterial color={color} transparent opacity={0.1 * plate} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** 展開位移：平滑移動到目標高度（不觸發 React 重繪） */
function Lift({ y, children }: { y: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g || Math.abs(g.position.y - y) < 0.001) return;
    g.position.y += (y - g.position.y) * Math.min(1, dt * 7);
  });
  return <group ref={ref}>{children}</group>;
}

/** 展開時鏡頭跟著整棟高度上移並拉遠（只在滑桿變動時調整，不干擾手動旋轉、平移、縮放） */
function CameraRig({ base, explode }: { base: number; explode: number }) {
  const anim = useRef<{ from: number; y: number; dist: number } | null>(null);
  const last = useRef(explode);
  const zoom = (e: number) => 1 + e * 0.75;
  useFrame((state, dt) => {
    const controls = state.controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (!controls) return;
    const cam = state.camera;
    if (last.current !== explode) {
      const dist = cam.position.distanceTo(controls.target) * (zoom(explode) / zoom(last.current));
      anim.current = { from: last.current, y: base + 11 * GAP * explode, dist };
      last.current = explode;
    }
    const a = anim.current;
    if (!a) return;
    const k = Math.min(1, dt * 5);
    const dy = (a.y - controls.target.y) * k;
    controls.target.y += dy;
    cam.position.y += dy;
    const off = cam.position.clone().sub(controls.target);
    const d = off.length();
    off.setLength(d + (a.dist - d) * k);
    cam.position.copy(controls.target).add(off);
    controls.update();
    if (Math.abs(a.y - controls.target.y) < 0.05 && Math.abs(a.dist - d) < 0.05) anim.current = null;
  });
  return null;
}

/* 樓層內部：分區外框＋核心筒、管道間、結構柱（展開時才建立；同一層只計算一次） */
const SHAFT = "#b98cff";
const CORE_KINDS = new Set(["core", "elevator", "stair"]);
const interiorCache = new Map<string, { lines: THREE.BufferGeometry; core: THREE.BufferGeometry | null; shaft: THREE.BufferGeometry | null; cols: THREE.BufferGeometry | null }>();

function interiorOf(floor: string, tower: TowerId, height: number, toV: (x: number, y: number, z: number) => THREE.Vector3) {
  const key = `${tower}:${floor}`;
  const hit = interiorCache.get(key);
  if (hit) return hit;
  const zones = getZones(floor, tower);
  const pts: THREE.Vector3[] = [];
  const outline = (z: Rect) =>
    z.poly ?? [
      [z.x, z.y],
      [z.x + z.w, z.y],
      [z.x + z.w, z.y + z.h],
      [z.x, z.y + z.h],
    ];
  for (const z of zones) {
    const o = outline(z);
    o.forEach(([x, y], i) => {
      const [x2, y2] = o[(i + 1) % o.length];
      pts.push(toV(x, y, 0.15), toV(x2, y2, 0.15));
    });
  }
  const box = (z: Rect, h: number) => {
    const c = toV(z.x + z.w / 2, z.y + z.h / 2, h / 2);
    return new THREE.BoxGeometry(Math.max(0.1, z.w - 0.1), h, Math.max(0.1, z.h - 0.1)).translate(c.x, c.y, c.z);
  };
  const merge = (list: THREE.BufferGeometry[]) => (list.length ? mergeGeometries(list) : null);
  const h = height * 0.9;
  const out = {
    lines: new THREE.BufferGeometry().setFromPoints(pts),
    core: merge(zones.filter((z) => CORE_KINDS.has(z.kind) && !z.id.includes("-col")).map((z) => box(z, h))),
    shaft: merge(zones.filter((z) => z.kind === "shaft").map((z) => box(z, h))),
    cols: merge(getDetail(floor, tower).columns.map((z) => box(z, h))),
  };
  interiorCache.set(key, out);
  return out;
}

function Interior({ floor, tower, y, height, toV, opacity }: { floor: string; tower: TowerId; y: number; height: number; toV: (x: number, y: number, z: number) => THREE.Vector3; opacity: number }) {
  const g = interiorOf(floor, tower, height, toV);
  const mat = (color: string, o: number) => <meshBasicMaterial color={color} transparent opacity={o * opacity} depthWrite={false} toneMapped={false} />;
  return (
    <group position={[0, y, 0]} raycast={() => null}>
      <lineSegments geometry={g.lines} raycast={() => null}>
        <lineBasicMaterial color={CYAN} transparent opacity={0.35 * opacity} toneMapped={false} />
      </lineSegments>
      {g.core && <mesh geometry={g.core} raycast={() => null}>{mat("#4cc9ff", 0.22)}</mesh>}
      {g.shaft && <mesh geometry={g.shaft} raycast={() => null}>{mat(SHAFT, 0.55)}</mesh>}
      {g.cols && <mesh geometry={g.cols} raycast={() => null}>{mat("#c6f0ff", 0.4)}</mesh>}
    </group>
  );
}

/** 警示光圈：核心光點＋光柱＋呼吸光環＋向外擴散的漣漪（紅色最快、綠色最緩） */
const PULSE: Record<AlertLevel, { speed: number; ripple: boolean; size: number }> = {
  red: { speed: 3.2, ripple: true, size: 2.2 },
  orange: { speed: 2, ripple: true, size: 1.7 },
  green: { speed: 1, ripple: false, size: 1.2 },
};

function Beacon({
  position,
  height,
  level,
  seed,
  active,
  onOver,
  onOut,
  onClick,
  children,
}: {
  position: THREE.Vector3;
  height: number;
  level: AlertLevel;
  seed: string;
  active: boolean;
  onOver: () => void;
  onOut: () => void;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  const halo = useRef<THREE.Mesh>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const { speed, size } = PULSE[level];
  const color = ALERT[level].color;
  // 依 id 錯開相位，避免所有光圈同步閃爍
  const phase = useMemo(() => [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % 628 / 100, [seed]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + phase;
    const b = (Math.sin(t) + 1) / 2;
    const boost = active ? 1.35 : 1;
    if (halo.current) {
      halo.current.scale.setScalar(size * boost * (1 + b * 0.45));
      (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.55 * b;
    }
    if (ripple.current) {
      const p = (t / (Math.PI * 2)) % 1;
      ripple.current.scale.setScalar(size * boost * (1 + p * 1.8));
      (ripple.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.6;
    }
    if (core.current) core.current.scale.setScalar(boost * (0.85 + b * 0.3));
  });
  // 不做深度測試：光圈穿透樓板與立面也看得到
  const additive = { transparent: true, depthWrite: false, depthTest: false, toneMapped: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide } as const;
  return (
    <group position={position}>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <ringGeometry args={[0.7, 1, 48]} />
        <meshBasicMaterial color={color} {...additive} />
      </mesh>
      {PULSE[level].ripple && (
        <mesh ref={ripple} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <ringGeometry args={[0.9, 1, 48]} />
          <meshBasicMaterial color={color} {...additive} />
        </mesh>
      )}
      <mesh position={[0, height * 0.35, 0]} renderOrder={10}>
        <cylinderGeometry args={[0.08, 0.08, height * 0.7, 6]} />
        <meshBasicMaterial color={color} {...additive} opacity={0.5} />
      </mesh>
      <mesh ref={core} position={[0, height * 0.7, 0]} renderOrder={11}>
        <sphereGeometry args={[0.3 * size, 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} depthTest={false} transparent fog={false} />
      </mesh>
      {/* 點擊範圍比光點大 */}
      <mesh
        position={[0, height * 0.45, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          onOver();
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
          onOut();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <cylinderGeometry args={[size, size, height, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {children && <group position={[0, height * 0.7, 0]}>{children}</group>}
    </group>
  );
}

function IssueTip({ issue, level }: { issue: Issue; level: AlertLevel }) {
  const a = ALERT[level];
  return (
    <Html center position={[0, 2.4, 0]} style={{ pointerEvents: "none" }} zIndexRange={[20, 0]}>
      <div className="w-56 -translate-y-1/2 rounded-md border bg-slate-950/90 px-2.5 py-1.5 text-[11px] text-slate-300 shadow-lg backdrop-blur" style={{ borderColor: a.color }}>
        <p className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.color }} />
          <b className="truncate text-slate-100">{issue.title}</b>
        </p>
        <p className="mt-0.5 text-slate-400">
          {TOWER_LABEL[issue.tower]} {issue.floor === "RF" ? "R 樓" : issue.floor}
          {issue.zone ? ` · ${issue.zone}` : ""} · {issue.category} · {issue.status}
        </p>
        {(issue.assignee || issue.due) && (
          <p className="text-slate-400">
            {issue.assignee && `工單：${issue.assignee}`}
            {issue.due && ` · 預計 ${issue.due}`}
          </p>
        )}
      </div>
    </Html>
  );
}

function Tree({ position, color, onClick }: { position: THREE.Vector3; color: string; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  return (
    <group position={position} onClick={onClick}>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 1.6, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.6, 0]}>
        <coneGeometry args={[1.1, 2.6, 8]} />
        <meshBasicMaterial color={color} wireframe toneMapped={false} />
      </mesh>
    </group>
  );
}

/** 棟名標籤：canvas 貼圖 sprite（永遠面向鏡頭） */
function Label({ text, position }: { text: string; position: THREE.Vector3 }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = "rgba(76,201,255,0.8)";
    ctx.lineWidth = 3;
    ctx.fillStyle = "rgba(2,8,20,0.75)";
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 88, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c6f0ff";
    ctx.font = "bold 48px 'PingFang TC', 'Noto Sans TC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 50);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  return (
    <sprite position={position} scale={[9, 3.4, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

function Line({ points, color, opacity = 1, width = 1.2 }: { points: THREE.Vector3[]; color: THREE.Color | string; opacity?: number; width?: number }) {
  return <DreiLine points={points} color={color} lineWidth={width} transparent opacity={opacity} toneMapped={false} />;
}

/** 周邊城市線框（固定亂數，僅作氛圍） */
function buildCity() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pts: THREE.Vector3[] = [];
  const pos = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)).getAttribute("position");
  for (let i = 0; i < 90; i++) {
    const r = 105 + rnd() * 170;
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const bw = 8 + rnd() * 16;
    const bd = 8 + rnd() * 16;
    const bh = 6 + Math.pow(rnd(), 2.5) * 70;
    for (let k = 0; k < pos.count; k++) {
      pts.push(new THREE.Vector3(pos.getX(k) * bw + x, (pos.getY(k) + 0.5) * bh, pos.getZ(k) * bd + z));
    }
    // 樓層線
    for (let fy = 3.2; fy < bh; fy += 3.2 * (1 + Math.floor(rnd() * 3))) {
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => new THREE.Vector3(x + (sx * bw) / 2, fy, z + (sz * bd) / 2));
      for (let k = 0; k < 4; k++) pts.push(c[k], c[(k + 1) % 4]);
    }
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function City() {
  const geom = useMemo(() => buildCity(), []);
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#1a6ea8" transparent opacity={0.16} toneMapped={false} />
    </lineSegments>
  );
}

export type { Props as BuildingSceneProps };
