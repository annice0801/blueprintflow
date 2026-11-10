import { requestUser } from "@/lib/auth";
import { chargePoints, getSettings, validateReservation } from "@/lib/field-server";
import type { Reservation, ResStatus } from "@/lib/field";
import { mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody, notFound, str, ValidationError } from "@/lib/validate";

const ACTIONS: Record<string, { from: ResStatus[]; to: ResStatus; text: string }> = {
  approve: { from: ["待審核"], to: "已確認", text: "物業核准" },
  reject: { from: ["待審核", "已確認"], to: "已退回", text: "物業退回" },
  checkin: { from: ["已確認"], to: "使用中", text: "報到（領取磁扣）" },
  complete: { from: ["使用中", "已確認"], to: "已完成", text: "使用完畢" },
  noshow: { from: ["已確認"], to: "未到", text: "預約未到" },
  cancel: { from: ["待審核", "已確認"], to: "已取消", text: "取消預約" },
};

/** body.action：approve / reject / checkin / complete / noshow / cancel；或直接修改欄位（物業） */
export async function PATCH(request: Request, ctx: RouteContext<"/api/reservations/[id]">) {
  const { id } = await ctx.params;
  try {
    const body = await jsonBody(request);
    const action = str(body, "action");
    // 只有「住戶預約」權限者：只能用電話取消自己的預約
    if (!requestUser(request).can("field", "edit") && (action !== "cancel" || body.phone === undefined))
      return Response.json({ error: "沒有編輯權限，請洽管理員" }, { status: 403 });
    const all = await readCollection<Reservation>("reservations");
    const cur = all.find((r) => r.id === id);
    if (!cur) return notFound("預約");
    const settings = await getSettings(cur.buildingId);
    const edits = !action ? await validateReservation({ ...cur, ...body, consent: undefined }, settings, { resident: false, ignoreId: id }) : null;

    const saved = await mutateCollection<Reservation, Reservation | null>("reservations", (list) => {
      const r = list.find((x) => x.id === id);
      if (!r) return null;
      const now = new Date().toISOString();
      if (action) {
        const a = ACTIONS[action];
        if (!a) throw new ValidationError("不支援的操作");
        // 住戶取消需提供相符電話
        if (action === "cancel" && body.phone !== undefined && String(body.phone).replace(/\D/g, "").slice(-6) !== r.phone.replace(/\D/g, "").slice(-6)) throw new ValidationError("電話不符，無法取消");
        if (!a.from.includes(r.status)) throw new ValidationError(`目前狀態「${r.status}」無法${a.text}`);
        r.status = a.to;
        let extra = "";
        if (action === "checkin" || action === "noshow") {
          r.points = chargePoints(r, list, settings, action === "noshow" ? settings.noShowPenalty : undefined);
          extra = r.points.charged || r.points.overflow ? `，扣 ${r.points.charged} 點${r.points.overflow ? `，不足 ${r.points.overflow} 點折算管理費 NT$ ${r.points.fee}` : ""}` : "";
        }
        r.log.push({ at: now, text: `${a.text}${extra}${str(body, "comment") ? `：${str(body, "comment")}` : ""}` });
      } else if (edits) {
        Object.assign(r, { ...edits, consent: r.consent });
        r.log.push({ at: now, text: "物業修改預約" });
      }
      r.updatedAt = now;
      return r;
    });
    return saved ? Response.json(saved) : notFound("預約");
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/reservations/[id]">) {
  const { id } = await ctx.params;
  const ok = await mutateCollection<Reservation, boolean>("reservations", (all) => {
    const i = all.findIndex((x) => x.id === id);
    if (i !== -1) all.splice(i, 1);
    return i !== -1;
  });
  return ok ? new Response(null, { status: 204 }) : notFound("預約");
}
