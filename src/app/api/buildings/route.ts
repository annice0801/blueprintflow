import { BUILDINGS } from "@/lib/buildings";

export async function GET() {
  return Response.json(BUILDINGS.map(({ id, name, subtitle, address, floors }) => ({ id, name, subtitle, address, floorCount: floors.length })));
}
