import type { NextRequest } from "next/server";
import { requestUser } from "@/lib/auth";
import type { AuditEntry } from "@/lib/perms";
import { queryDocs } from "@/lib/store";

/** 本社區操作紀錄：最近 300 筆，可依使用者或模組篩選 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const filter: Record<string, string> = { buildingId: requestUser(request).buildingId };
  if (q.get("email")) filter.email = q.get("email")!;
  if (q.get("module")) filter.module = q.get("module")!;
  return Response.json(await queryDocs<AuditEntry>("audit", filter, 300));
}
