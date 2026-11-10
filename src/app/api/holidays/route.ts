import type { NextRequest } from "next/server";
import { holidaysOf } from "@/lib/holidays";

/** ?year=2026（可多個：?year=2026&year=2027） */
export async function GET(request: NextRequest) {
  const years = request.nextUrl.searchParams.getAll("year").map(Number).filter((y) => y >= 2000 && y <= 2100).slice(0, 3);
  const res = await Promise.all((years.length ? years : [new Date().getFullYear()]).map(holidaysOf));
  return Response.json(res);
}
