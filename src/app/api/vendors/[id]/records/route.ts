import { parseRecord } from "@/lib/mgmt-forms";
import type { Vendor } from "@/lib/mgmt";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, notFound } from "@/lib/validate";

/** 新增維修 / 保養紀錄，回傳更新後的公司 */
export async function POST(request: Request, ctx: RouteContext<"/api/vendors/[id]/records">) {
  const { id } = await ctx.params;
  try {
    const rec = { id: crypto.randomUUID(), ...parseRecord(await jsonBody(request)), createdAt: new Date().toISOString() };
    const v = await mutateCollection<Vendor, Vendor | null>("vendors", (all) => {
      const x = all.find((c) => c.id === id);
      if (!x) return null;
      (x.records ??= []).push(rec);
      x.updatedAt = rec.createdAt;
      return x;
    });
    return v ? Response.json(v, { status: 201 }) : notFound("廠商");
  } catch (e) {
    return errorResponse(e);
  }
}
