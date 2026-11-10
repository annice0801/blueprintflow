import type { TowerId } from "./buildings";

export const CATEGORIES = ["結構裂縫", "滲漏水", "磁磚 / 表面", "門窗", "水電 / 機電", "消防", "其他"] as const;
export const SEVERITIES = ["低", "中", "高"] as const;
export const STATUSES = ["待處理", "處理中", "已完成"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Status = (typeof STATUSES)[number];

export type Issue = {
  id: string;
  buildingId: string;
  tower: TowerId;
  floor: string;
  zone: string; // 戶別 / 區域名稱
  x: number; // 平面座標（公尺）
  y: number;
  title: string;
  description: string;
  category: Category;
  severity: Severity;
  status: Status;
  photos: string[]; // 檔名，經 /api/uploads/[file] 讀取
  reporter?: string; // 住戶報修：回報者帳號（僅管理端看得到）
  assignee?: string; // 維修工單：負責廠商 / 人員
  due?: string; // 維修工單：預計完成日 YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
};

export const TOWER_LABEL: Record<TowerId, string> = { A: "A 棟", B: "B 棟", S: "共用" };

/* 3D 警示光圈：紅 = 緊急（漏水 / 裂痕 / 高嚴重）、橘 = 設備異常與一般待修、綠 = 正常 / 已修復 */
export type AlertLevel = "red" | "orange" | "green";
export const ALERT_LEVELS: AlertLevel[] = ["red", "orange", "green"];
export const ALERT: Record<AlertLevel, { color: string; label: string; hint: string }> = {
  red: { color: "#ff4d6d", label: "緊急", hint: "漏水 / 裂痕" },
  orange: { color: "#ff9a1f", label: "異常", hint: "設備異常" },
  green: { color: "#34d399", label: "正常", hint: "已修復" },
};

export function alertOf(i: Pick<Issue, "status" | "category" | "severity">): AlertLevel {
  if (i.status === "已完成") return "green";
  if (i.category === "結構裂縫" || i.category === "滲漏水" || i.severity === "高") return "red";
  return "orange";
}
