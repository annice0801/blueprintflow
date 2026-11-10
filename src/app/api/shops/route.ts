import type { NextRequest } from "next/server";
import type { Shop } from "@/lib/records";
import { readCollection } from "@/lib/store";

export async function GET(request: NextRequest) {
  const buildingId = request.nextUrl.searchParams.get("buildingId");
  return Response.json((await readCollection<Shop>("shops")).filter((s) => !buildingId || s.buildingId === buildingId));
}
