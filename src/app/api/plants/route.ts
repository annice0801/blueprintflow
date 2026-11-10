import { dataScope } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { parsePlant } from "@/lib/record-forms";
import type { Plant } from "@/lib/records";
import { mutateCollection, readCollection, savePhoto } from "@/lib/store";
import { errorResponse, photosFrom } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const plants = (await readCollection<Plant>("plants")).filter(
    (p) => p.buildingId === dataScope(request) && (!q.get("areaId") || p.areaId === q.get("areaId")),
  );
  return Response.json(plants);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const f = parsePlant(form, true);
    const photos = await Promise.all(photosFrom(form).map(savePhoto));
    const now = new Date().toISOString();
    const plant: Plant = {
      id: crypto.randomUUID(),
      buildingId: f.buildingId!,
      areaId: f.areaId!,
      x: f.x!,
      y: f.y!,
      name: f.name!,
      bed: f.bed ?? "",
      species: f.species ?? "",
      type: f.type ?? "喬木",
      health: f.health ?? "良好",
      plantedAt: f.plantedAt ?? "",
      height: f.height ?? "",
      description: f.description ?? "",
      photos,
      events: [],
      createdAt: now,
      updatedAt: now,
    };
    await mutateCollection<Plant, void>("plants", (all) => void all.push(plant));
    return Response.json(plant, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
