import type { NextRequest } from "next/server";
import { parseVendor, requireBuildingId } from "@/lib/mgmt-forms";
import type { Vendor } from "@/lib/mgmt";
import { mutateCollection, readCollection } from "@/lib/store";
import { errorResponse, jsonBody } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const buildingId = request.nextUrl.searchParams.get("buildingId");
  return Response.json((await readCollection<Vendor>("vendors")).filter((v) => !buildingId || v.buildingId === buildingId));
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const f = parseVendor(body, true);
    const now = new Date().toISOString();
    const vendor: Vendor = {
      id: crypto.randomUUID(),
      buildingId,
      kind: f.kind ?? "vendor",
      name: f.name!,
      category: f.category ?? "其他",
      taxId: f.taxId ?? "",
      representative: f.representative ?? "",
      representativePhone: f.representativePhone ?? "",
      developer: f.developer ?? "",
      developerPhone: f.developerPhone ?? "",
      builderId: f.kind === "builder-vendor" ? (f.builderId ?? "") : "",
      contact: f.contact ?? "",
      phone: f.phone ?? "",
      email: f.email ?? "",
      address: f.address ?? "",
      website: f.website ?? "",
      scope: f.scope ?? "",
      contractStart: f.contractStart ?? "",
      contractEnd: f.contractEnd ?? "",
      amount: f.amount ?? "",
      note: f.note ?? "",
      contacts: f.contacts ?? [],
      records: [],
      createdAt: now,
      updatedAt: now,
    };
    await mutateCollection<Vendor, void>("vendors", (all) => void all.push(vendor));
    return Response.json(vendor, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
