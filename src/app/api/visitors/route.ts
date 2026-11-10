import type { NextRequest } from "next/server";
import { getSettings, localNow } from "@/lib/field-server";
import type { Visitor } from "@/lib/field";
import { requireBuildingId } from "@/lib/mgmt-forms";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, str, ValidationError } from "@/lib/validate";

/** 讀取時一併刪除超過保存期限的訪客紀錄（個資最小化） */
export async function GET(request: NextRequest) {
  const buildingId = request.nextUrl.searchParams.get("buildingId") ?? "blueprint";
  const { visitorRetentionDays } = await getSettings(buildingId);
  const cutoff = new Date(Date.now() - visitorRetentionDays * 86400000).toISOString();
  const list = await mutateCollection<Visitor, Visitor[]>("visitors", (all) => {
    for (let i = all.length - 1; i >= 0; i--) if (all[i].createdAt < cutoff) all.splice(i, 1);
    return all.filter((v) => v.buildingId === buildingId);
  });
  return Response.json(list.sort((a, b) => b.inAt.localeCompare(a.inAt)));
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const name = (str(body, "name") ?? "").slice(0, 40);
    if (!name) throw new ValidationError("請填寫訪客姓名");
    const v: Visitor = {
      id: crypto.randomUUID(),
      buildingId,
      name,
      unitId: (str(body, "unitId") ?? "").slice(0, 40),
      purpose: (str(body, "purpose") ?? "").slice(0, 60),
      plate: (str(body, "plate") ?? "").toUpperCase().slice(0, 12),
      count: Math.max(1, Math.min(50, Number(body.count) || 1)),
      inAt: str(body, "inAt") || localNow(),
      outAt: "",
      note: (str(body, "note") ?? "").slice(0, 300),
      createdAt: new Date().toISOString(),
    };
    await mutateCollection<Visitor, void>("visitors", (all) => void all.push(v));
    return Response.json(v, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
