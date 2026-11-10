import { dataScope } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { parseGateLog } from "@/lib/record-forms";
import type { Todo } from "@/lib/mgmt";
import type { GateLog } from "@/lib/records";
import { mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const buildingId = dataScope(request);
  const logs = (await readCollection<GateLog>("gate-logs")).filter((l) => !buildingId || l.buildingId === buildingId);
  return Response.json(logs.sort((a, b) => b.at.localeCompare(a.at)));
}

export async function POST(request: Request) {
  try {
    const f = parseGateLog(await jsonBody(request), true) as Partial<GateLog>;
    const now = new Date().toISOString();
    const log: GateLog = {
      id: crypto.randomUUID(),
      buildingId: f.buildingId!,
      gate: f.gate!,
      action: f.action!,
      at: f.at!,
      operator: f.operator ?? "",
      note: f.note ?? "",
      ...(f.part && { part: f.part }),
      createdAt: now,
      updatedAt: now,
    };
    await mutateCollection<GateLog, void>("gate-logs", (all) => void all.push(log));
    await syncRepairTodo(log);
    return Response.json(log, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** 設備故障 → 建立維修待辦；維修 → 進行中；恢復正常 → 結案（同一設備只開一筆） */
async function syncRepairTodo(log: GateLog) {
  if (log.action !== "故障" && log.action !== "維修" && log.action !== "恢復正常") return;
  const target = `${log.gate}道閘 ${log.part ?? "整座"}`;
  const now = new Date().toISOString();
  const text = `${log.at.replace("T", " ")} ${log.action}${log.operator ? `（${log.operator}）` : ""}${log.note ? `：${log.note}` : ""}`;
  await mutateCollection<Todo, void>("todos", (all) => {
    const open = all.find((t) => t.buildingId === log.buildingId && t.link === "driveway" && t.title.startsWith(`🚗 ${target}`) && t.status !== "已完成");
    if (open) {
      open.log.push({ at: now, text });
      if (log.action === "維修" && open.status === "未開始") {
        open.log.push({ at: now, text: `狀態：${open.status} → 進行中` });
        open.status = "進行中";
      }
      if (log.action === "恢復正常") {
        open.log.push({ at: now, text: `狀態：${open.status} → 已完成` });
        open.status = "已完成";
      }
      open.updatedAt = now;
    } else if (log.action === "故障") {
      all.push({
        id: crypto.randomUUID(),
        buildingId: log.buildingId,
        title: `🚗 ${target} 故障維修`,
        description: `車道設備登記故障，系統自動建立。\n${text}\n維修後請在「車道」頁登記「恢復正常」，本項會自動結案。`,
        assignees: ["gm", "vendor"],
        status: "未開始",
        priority: "高",
        start: log.at.slice(0, 10),
        due: new Date(Date.parse(log.at.slice(0, 10)) + 3 * 86400000).toISOString().slice(0, 10),
        link: "driveway",
        log: [{ at: now, text: `由車道故障紀錄建立：${text}` }],
        createdAt: now,
        updatedAt: now,
      });
    }
  });
}
