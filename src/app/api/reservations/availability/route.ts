import type { NextRequest } from "next/server";
import type { Reservation } from "@/lib/field";
import { readCollection } from "@/lib/store";

/** 某日某類型已被預約的時段（不含個資） */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const date = q.get("date") ?? "";
  const list = (await readCollection<Reservation>("reservations")).filter(
    (r) => r.buildingId === (q.get("buildingId") ?? "blueprint") && r.type === q.get("type") && r.start.startsWith(date) && ["待審核", "已確認", "使用中"].includes(r.status),
  );
  return Response.json(list.map((r) => ({ start: r.start, end: r.end })));
}
