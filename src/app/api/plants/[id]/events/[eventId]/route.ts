import { parsePlantEvent } from "@/lib/record-forms";
import type { Plant } from "@/lib/records";
import { deletePhoto, mutateCollection, savePhoto } from "@/lib/store";
import { errorResponse, notFound, photosFrom, removedPhotos } from "@/lib/validate";

type Ctx = RouteContext<"/api/plants/[id]/events/[eventId]">;

export async function PATCH(request: Request, ctx: Ctx) {
  const { id, eventId } = await ctx.params;
  try {
    const form = await request.formData();
    const fields = parsePlantEvent(form, false);
    const remove = removedPhotos(form);
    const added = await Promise.all(photosFrom(form).map(savePhoto));
    let removed: string[] = [];
    const plant = await mutateCollection<Plant, Plant | null>("plants", (all) => {
      const p = all.find((x) => x.id === id);
      const ev = p?.events.find((e) => e.id === eventId);
      if (!p || !ev) return null;
      removed = ev.photos.filter((x) => remove.includes(x));
      Object.assign(ev, fields, { photos: [...ev.photos.filter((x) => !remove.includes(x)), ...added] });
      p.updatedAt = new Date().toISOString();
      return p;
    });
    if (!plant) {
      await Promise.all(added.map(deletePhoto));
      return notFound("紀錄");
    }
    await Promise.all(removed.map(deletePhoto));
    return Response.json(plant);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, eventId } = await ctx.params;
  let photos: string[] = [];
  const plant = await mutateCollection<Plant, Plant | null>("plants", (all) => {
    const p = all.find((x) => x.id === id);
    const idx = p?.events.findIndex((e) => e.id === eventId) ?? -1;
    if (!p || idx === -1) return null;
    photos = p.events.splice(idx, 1)[0].photos;
    p.updatedAt = new Date().toISOString();
    return p;
  });
  if (!plant) return notFound("紀錄");
  await Promise.all(photos.map(deletePhoto));
  return Response.json(plant);
}
