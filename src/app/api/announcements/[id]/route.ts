import type { Announcement, AnnStatus } from "@/lib/field";
import { deletePhoto, mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, notFound, str, ValidationError } from "@/lib/validate";
import { annFields, photoName } from "../fields";

const FLOW: Record<string, { from: AnnStatus[]; to: AnnStatus; text: string }> = {
  submit: { from: ["草稿", "退回修改"], to: "待審核", text: "送管委會審核" },
  approve: { from: ["待審核"], to: "已核准", text: "核准" },
  reject: { from: ["待審核"], to: "退回修改", text: "退回修改" },
  assign: { from: ["已核准", "張貼中", "已張貼"], to: "張貼中", text: "指派張貼" },
  remove: { from: ["張貼中", "已張貼"], to: "已撤下", text: "撤下公告" },
};

export async function PATCH(request: Request, ctx: RouteContext<"/api/announcements/[id]">) {
  const { id } = await ctx.params;
  try {
    const body = await jsonBody(request);
    const action = str(body, "action");
    const by = (str(body, "by") ?? "").slice(0, 40);
    const comment = (str(body, "comment") ?? "").slice(0, 500);
    const fields = action ? {} : annFields(body);
    const ann = await mutateCollection<Announcement, Announcement | null>("announcements", (all) => {
      const a = all.find((x) => x.id === id);
      if (!a) return null;
      const now = new Date().toISOString();
      if (!action) {
        // 審核中或已核准後修改內容，退回草稿重新送審
        if (["待審核", "已核准"].includes(a.status) && (fields.zh || fields.en || fields.photos)) {
          a.status = "草稿";
          a.review.push({ at: now, by: by || "物業", action: "內容修改，需重新送審", comment: "" });
        }
        Object.assign(a, fields);
      } else if (action === "post") {
        // 張貼某位置並附照片
        const spot = a.postings.find((p) => p.spotId === str(body, "spotId"));
        if (!spot) throw new ValidationError("找不到張貼位置");
        const photo = str(body, "photo") ?? "";
        if (photo && !photoName(photo)) throw new ValidationError("照片不正確");
        Object.assign(spot, { photo, postedAt: now, by });
        if (a.postings.every((p) => p.postedAt)) {
          a.status = "已張貼";
          a.review.push({ at: now, by, action: "全部位置張貼完成", comment: "" });
        }
      } else {
        const f = FLOW[action];
        if (!f) throw new ValidationError("不支援的操作");
        if (!f.from.includes(a.status)) throw new ValidationError(`目前狀態「${a.status}」無法${f.text}`);
        if (action === "reject" && !comment) throw new ValidationError("請填寫退回原因");
        let to = f.to;
        if (action === "assign") {
          const spots = (Array.isArray(body.spots) ? body.spots : []) as { spotId: string; label: string }[];
          if (!spots.length) throw new ValidationError("請選擇張貼位置");
          const keep = new Map(a.postings.map((p) => [p.spotId, p]));
          a.postings = spots.slice(0, 30).map((s) => keep.get(s.spotId) ?? { spotId: String(s.spotId).slice(0, 64), label: String(s.label).slice(0, 40), photo: "", postedAt: "", by: "" });
          if (a.postings.every((p) => p.postedAt)) to = "已張貼";
        }
        a.status = to;
        a.review.push({ at: now, by, action: f.text, comment });
      }
      a.updatedAt = now;
      return a;
    });
    return ann ? Response.json(ann) : notFound("公告");
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/announcements/[id]">) {
  const { id } = await ctx.params;
  const removed = await mutateCollection<Announcement, Announcement | null>("announcements", (all) => {
    const i = all.findIndex((x) => x.id === id);
    return i === -1 ? null : all.splice(i, 1)[0];
  });
  if (!removed) return notFound("公告");
  await Promise.all([...removed.photos, ...removed.postings.map((p) => p.photo).filter(Boolean)].map(deletePhoto));
  return new Response(null, { status: 204 });
}
