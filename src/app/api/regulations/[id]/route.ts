import { extractText } from "@/lib/meeting-parse";
import { parseRegulation } from "@/lib/mgmt-forms";
import type { Regulation } from "@/lib/mgmt";
import { deleteDocument, mutateCollection, saveDocument } from "@/lib/store";
import { errorResponse, notFound } from "@/lib/validate";

export async function PATCH(request: Request, ctx: RouteContext<"/api/regulations/[id]">) {
  const { id } = await ctx.params;
  try {
    const form = await request.formData();
    const f = parseRegulation(form, false);
    const upload = form.get("file");
    let file: Regulation["file"];
    let fileText = "";
    if (upload instanceof File && upload.size) {
      file = { name: await saveDocument(upload), original: upload.name.slice(0, 200) };
      fileText = (await extractText(upload).catch(() => ({ text: "" }))).text.slice(0, 100_000);
    }
    let oldFile: string | undefined;
    const reg = await mutateCollection<Regulation, Regulation | null>("regulations", (all) => {
      const r = all.find((x) => x.id === id);
      if (!r) return null;
      const now = new Date().toISOString();
      // 版本、狀態變更與換檔寫入沿革
      const changes = [
        f.version && f.version !== r.version && `版本 ${r.version} → ${f.version}`,
        f.status && f.status !== r.status && `狀態 ${r.status} → ${f.status}`,
        file && `更新原檔：${file.original}`,
      ].filter(Boolean);
      if (changes.length) r.history.push({ at: now, text: changes.join("；") });
      if (file) {
        oldFile = r.file?.name;
        r.file = file;
        if (!f.content && fileText) f.content = fileText;
      }
      Object.assign(r, f, { updatedAt: now });
      if (f.meetingId === "") delete r.meetingId;
      if (f.termId === "") delete r.termId;
      return r;
    });
    if (!reg) {
      if (file) await deleteDocument(file.name);
      return notFound("規範");
    }
    if (oldFile) await deleteDocument(oldFile);
    return Response.json(reg);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/regulations/[id]">) {
  const { id } = await ctx.params;
  const removed = await mutateCollection<Regulation, Regulation | null>("regulations", (all) => {
    const i = all.findIndex((x) => x.id === id);
    return i === -1 ? null : all.splice(i, 1)[0];
  });
  if (!removed) return notFound("規範");
  if (removed.file) await deleteDocument(removed.file.name);
  return new Response(null, { status: 204 });
}
