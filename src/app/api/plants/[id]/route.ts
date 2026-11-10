import { parsePlant } from "@/lib/record-forms";
import type { Plant } from "@/lib/records";
import { deletePhoto, mutateCollection, savePhoto } from "@/lib/store";
import { errorResponse, notFound, photosFrom, removedPhotos } from "@/lib/validate";

export async function PATCH(request: Request, ctx: RouteContext<"/api/plants/[id]">) {
  const { id } = await ctx.params;
  try {
    const form = await request.formData();
    const fields = parsePlant(form, false);
    const remove = removedPhotos(form);
    const added = await Promise.all(photosFrom(form).map(savePhoto));
    let removed: string[] = [];
    const plant = await mutateCollection<Plant, Plant | null>("plants", (all) => {
      const p = all.find((x) => x.id === id);
      if (!p) return null;
      removed = p.photos.filter((x) => remove.includes(x));
      Object.assign(p, fields, { photos: [...p.photos.filter((x) => !remove.includes(x)), ...added], updatedAt: new Date().toISOString() });
      return p;
    });
    if (!plant) {
      await Promise.all(added.map(deletePhoto));
      return notFound("植栽");
    }
    await Promise.all(removed.map(deletePhoto));
    return Response.json(plant);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/plants/[id]">) {
  const { id } = await ctx.params;
  const removed = await mutateCollection<Plant, Plant | null>("plants", (all) => {
    const idx = all.findIndex((x) => x.id === id);
    return idx === -1 ? null : all.splice(idx, 1)[0];
  });
  if (!removed) return notFound("植栽");
  await Promise.all([...removed.photos, ...removed.events.flatMap((e) => e.photos)].map(deletePhoto));
  return new Response(null, { status: 204 });
}
