import type { NextRequest } from "next/server";
import { parseIssueFields } from "@/lib/issue-form";
import { errorResponse, photosFrom } from "@/lib/validate";
import type { Issue } from "@/lib/issues";
import { mutateIssues, readIssues, savePhoto } from "@/lib/store";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const issues = (await readIssues()).filter(
    (i) =>
      (!q.get("buildingId") || i.buildingId === q.get("buildingId")) &&
      (!q.get("tower") || i.tower === q.get("tower")) &&
      (!q.get("floor") || i.floor === q.get("floor")),
  );
  return Response.json(issues);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const fields = parseIssueFields(form, true);
    const photos = await Promise.all(photosFrom(form).map(savePhoto));
    const now = new Date().toISOString();
    const issue: Issue = {
      id: crypto.randomUUID(),
      buildingId: fields.buildingId!,
      tower: fields.tower!,
      floor: fields.floor!,
      x: fields.x!,
      y: fields.y!,
      title: fields.title!,
      zone: fields.zone ?? "",
      description: fields.description ?? "",
      category: fields.category ?? "其他",
      severity: fields.severity ?? "中",
      status: fields.status ?? "待處理",
      assignee: fields.assignee ?? "",
      due: fields.due ?? "",
      photos,
      createdAt: now,
      updatedAt: now,
    };
    await mutateIssues((all) => void all.push(issue));
    return Response.json(issue, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
