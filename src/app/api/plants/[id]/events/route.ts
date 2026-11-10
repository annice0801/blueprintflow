import { parsePlantEvent } from "@/lib/record-forms";
import type { Plant, PlantEvent } from "@/lib/records";
import { deletePhoto, mutateCollection, savePhoto } from "@/lib/store";
import { errorResponse, notFound, photosFrom } from "@/lib/validate";

/** 新增植栽事件（颱風倒伏、修剪…），回傳更新後的植栽 */
export async function POST(request: Request, ctx: RouteContext<"/api/plants/[id]/events">) {
  const { id } = await ctx.params;
  try {
    const form = await request.formData();
    const f = parsePlantEvent(form, true);
    const photos = await Promise.all(photosFrom(form).map(savePhoto));
    const event: PlantEvent = {
      id: crypto.randomUUID(),
      date: f.date!,
      type: f.type ?? "其他",
      typhoon: f.typhoon ?? "",
      description: f.description ?? "",
      handling: f.handling ?? "",
      handler: f.handler ?? "",
      photos,
      createdAt: new Date().toISOString(),
    };
    const plant = await mutateCollection<Plant, Plant | null>("plants", (all) => {
      const p = all.find((x) => x.id === id);
      if (!p) return null;
      p.events.push(event);
      p.updatedAt = event.createdAt;
      return p;
    });
    if (!plant) {
      await Promise.all(photos.map(deletePhoto));
      return notFound("植栽");
    }
    return Response.json(plant, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
