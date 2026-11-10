import { dataScope } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { parseTerm, requireBuildingId } from "@/lib/mgmt-forms";
import type { Term } from "@/lib/mgmt";
import { mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const buildingId = dataScope(request);
  return Response.json((await readCollection<Term>("terms")).filter((t) => !buildingId || t.buildingId === buildingId));
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const f = parseTerm(body, true);
    const now = new Date().toISOString();
    const term: Term = {
      id: crypto.randomUUID(),
      buildingId,
      kind: f.kind!,
      name: f.name!,
      ...(f.companyId && { companyId: f.companyId }),
      start: f.start ?? "",
      end: f.end ?? "",
      note: f.note ?? "",
      members: f.members ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await mutateCollection<Term, void>("terms", (all) => void all.push(term));
    return Response.json(term, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
