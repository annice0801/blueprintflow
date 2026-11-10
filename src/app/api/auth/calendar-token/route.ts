import { dataScope } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { calendarToken } from "@/lib/calendar-token";

/** 行事曆訂閱網址用的 token（登入者才拿得到） */
export async function GET(request: NextRequest) {
  const buildingId = dataScope(request);
  return Response.json({ token: await calendarToken(buildingId) });
}
