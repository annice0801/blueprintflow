import { parseIssueFields } from "@/lib/issue-form";
import { errorResponse, photosFrom } from "@/lib/validate";
import { deletePhoto, mutateIssues, readIssues, savePhoto } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/issues/[id]">) {
  const { id } = await ctx.params;
  const issue = (await readIssues()).find((i) => i.id === id);
  if (!issue) return Response.json({ error: "找不到問題" }, { status: 404 });
  return Response.json(issue);
}

/** multipart：可編輯欄位 + photos（新增）+ removePhotos（要刪除的檔名） */
export async function PATCH(request: Request, ctx: RouteContext<"/api/issues/[id]">) {
  const { id } = await ctx.params;
  try {
    const form = await request.formData();
    const fields = parseIssueFields(form, false);
    const remove = form.getAll("removePhotos").filter((v): v is string => typeof v === "string");
    const added = await Promise.all(photosFrom(form).map(savePhoto));
    let removed: string[] = [];
    const updated = await mutateIssues((all) => {
      const issue = all.find((i) => i.id === id);
      if (!issue) return null;
      removed = issue.photos.filter((p) => remove.includes(p));
      Object.assign(issue, fields, {
        photos: [...issue.photos.filter((p) => !remove.includes(p)), ...added],
        updatedAt: new Date().toISOString(),
      });
      return issue;
    });
    if (!updated) {
      await Promise.all(added.map(deletePhoto));
      return Response.json({ error: "找不到問題" }, { status: 404 });
    }
    await Promise.all(removed.map(deletePhoto));
    return Response.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/issues/[id]">) {
  const { id } = await ctx.params;
  const removed = await mutateIssues((all) => {
    const idx = all.findIndex((i) => i.id === id);
    return idx === -1 ? null : all.splice(idx, 1)[0];
  });
  if (!removed) return Response.json({ error: "找不到問題" }, { status: 404 });
  await Promise.all(removed.photos.map(deletePhoto));
  return new Response(null, { status: 204 });
}
