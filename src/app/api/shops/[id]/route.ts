import { parseShop } from "@/lib/record-forms";
import type { Shop } from "@/lib/records";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody } from "@/lib/validate";

/** 新增或更新店鋪經營資料（id = 1F 分區 id） */
export async function PUT(request: Request, ctx: RouteContext<"/api/shops/[id]">) {
  const { id } = await ctx.params;
  try {
    const fields = parseShop(await jsonBody(request), id);
    const shop = await mutateCollection<Shop, Shop>("shops", (all) => {
      let s = all.find((x) => x.id === id && x.buildingId === fields.buildingId);
      if (!s) {
        s = { id, buildingId: fields.buildingId, shopName: "", business: "", status: "營業中", hours: "", phone: "", contact: "", note: "", updatedAt: "" };
        all.push(s);
      }
      Object.assign(s, fields, { updatedAt: new Date().toISOString() });
      return s;
    });
    return Response.json(shop);
  } catch (e) {
    return errorResponse(e);
  }
}
