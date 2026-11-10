import { dataScope } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { ANN_TEMPLATES, type Announcement } from "@/lib/field";
import { requireBuildingId } from "@/lib/mgmt-forms";
import { mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody } from "@/lib/validate";
import { annFields } from "./fields";

export async function GET(request: NextRequest) {
  const buildingId = dataScope(request);
  return Response.json((await readCollection<Announcement>("announcements")).filter((a) => a.buildingId === buildingId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const f = annFields(body);
    const now = new Date().toISOString();
    const ann: Announcement = {
      id: crypto.randomUUID(),
      buildingId,
      template: f.template ?? ANN_TEMPLATES[0],
      zh: f.zh ?? { title: "公告", body: "" },
      en: f.en ?? { title: "Notice", body: "" },
      fields: f.fields ?? { start: "", end: "", area: "", areaEn: "", contact: "", issuer: "藍圖社區管理委員會", issuerEn: "Blueprint Residence Management Committee" },
      photos: f.photos ?? [],
      layout: f.layout ?? { lang: "both", fontScale: 1, photoLayout: "none", accent: "" },
      source: f.source ?? "",
      status: "草稿",
      review: [{ at: now, by: "總幹事", action: "建立草稿", comment: "" }],
      postings: [],
      removeBy: f.removeBy ?? "",
      createdAt: now,
      updatedAt: now,
    };
    await mutateCollection<Announcement, void>("announcements", (all) => void all.push(ann));
    return Response.json(ann, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
