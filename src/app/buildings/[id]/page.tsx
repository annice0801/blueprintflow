import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import BuildingWorkspace from "@/components/BuildingWorkspace";
import { BUILDINGS, getBuilding } from "@/lib/buildings";

export function generateStaticParams() {
  return BUILDINGS.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: PageProps<"/buildings/[id]">): Promise<Metadata> {
  const b = getBuilding((await params).id);
  return { title: b ? `${b.name} · Blueprintflow` : "Blueprintflow" };
}

export default function BuildingPage({ params }: PageProps<"/buildings/[id]">) {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-[#020814] text-sm tracking-widest text-cyan-400/70">載入中…</div>}>
      <Workspace params={params} />
    </Suspense>
  );
}

async function Workspace({ params }: { params: Promise<{ id: string }> }) {
  const building = getBuilding((await params).id);
  if (!building) notFound();
  return <BuildingWorkspace building={building} />;
}
