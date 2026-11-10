import type { NextRequest } from "next/server";
import { extractText } from "@/lib/meeting-parse";
import { parseRegulation, requireBuildingId } from "@/lib/mgmt-forms";
import type { Regulation } from "@/lib/mgmt";
import { mutateCollection, readCollection, saveDocument } from "@/lib/store";
import { errorResponse } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const buildingId = request.nextUrl.searchParams.get("buildingId");
  return Response.json((await readCollection<Regulation>("regulations")).filter((r) => !buildingId || r.buildingId === buildingId));
}

/** multipart：欄位 + 選填原檔（docx / pdf / txt）；未填條文時自動帶入檔案文字 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const buildingId = requireBuildingId(Object.fromEntries(form));
    const f = parseRegulation(form, true);
    const upload = form.get("file");
    let file: Regulation["file"];
    let content = f.content ?? "";
    if (upload instanceof File && upload.size) {
      file = { name: await saveDocument(upload), original: upload.name.slice(0, 200) };
      if (!content) content = (await extractText(upload).catch(() => ({ text: "" }))).text.slice(0, 100_000);
    }
    const now = new Date().toISOString();
    const reg: Regulation = {
      id: crypto.randomUUID(),
      buildingId,
      title: f.title!,
      category: f.category ?? "管理辦法",
      status: f.status ?? "草案",
      version: f.version ?? "v1",
      effectiveDate: f.effectiveDate ?? "",
      ...(f.meetingId && { meetingId: f.meetingId }),
      ...(f.termId && { termId: f.termId }),
      summary: f.summary ?? "",
      content,
      ...(file && { file }),
      history: [{ at: now, text: `建立（${f.version ?? "v1"}，${f.status ?? "草案"}）` }],
      createdAt: now,
      updatedAt: now,
    };
    await mutateCollection<Regulation, void>("regulations", (all) => void all.push(reg));
    return Response.json(reg, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
