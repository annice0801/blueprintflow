import { getBuilding } from "@/lib/buildings";

export async function GET(_req: Request, ctx: RouteContext<"/api/buildings/[id]">) {
  const building = getBuilding((await ctx.params).id);
  if (!building) return Response.json({ error: "找不到建築物" }, { status: 404 });
  return Response.json(building);
}
