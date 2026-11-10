import { requestUser } from "@/lib/auth";
import { PAY_METHODS, statusOf, type FeeBill } from "@/lib/households";
import { mutateCollection } from "@/lib/store";
import { dateStr, errorResponse, jsonBody, maxLen, notFound, num, oneOf, str } from "@/lib/validate";

/** 繳費登記 / 調整金額 / 免繳：{ paid, paidAt, method, amount, note, waive } */
export async function PATCH(request: Request, ctx: RouteContext<"/api/fees/[id]">) {
  const id = decodeURIComponent((await ctx.params).id);
  try {
    const { buildingId } = requestUser(request);
    const body = await jsonBody(request);
    const paid = num(body.paid === undefined ? undefined : String(body.paid), "已繳金額");
    const amount = num(body.amount === undefined ? undefined : String(body.amount), "應繳金額");
    const bill = await mutateCollection<FeeBill, FeeBill | null>("fees", (all) => {
      const b = all.find((x) => x.id === id && x.buildingId === buildingId);
      if (!b) return null;
      if (amount !== undefined) b.amount = Math.max(0, amount);
      if (paid !== undefined) b.paid = Math.max(0, paid);
      b.paidAt = dateStr(str(body, "paidAt"), "繳費日")?.slice(0, 10) ?? b.paidAt;
      b.method = oneOf(str(body, "method") || undefined, PAY_METHODS, "繳費方式") ?? b.method;
      b.note = maxLen(str(body, "note"), 200, "備註") ?? b.note;
      b.status = body.waive === true ? "免繳" : statusOf(b.amount, b.paid);
      b.updatedAt = new Date().toISOString();
      return b;
    });
    return bill ? Response.json(bill) : notFound("帳單");
  } catch (e) {
    return errorResponse(e);
  }
}
