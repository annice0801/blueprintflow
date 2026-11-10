import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ManagementCenter from "@/components/manage/ManagementCenter";
import { BUILDINGS, getBuilding } from "@/lib/buildings";

export function generateStaticParams() {
  return BUILDINGS.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: PageProps<"/buildings/[id]/manage">): Promise<Metadata> {
  const b = getBuilding((await params).id);
  return { title: b ? `管理中心 · ${b.name}` : "Blueprintflow" };
}

export default function ManagePage({ params }: PageProps<"/buildings/[id]/manage">) {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-[#020814] text-sm tracking-widest text-cyan-400/70">載入中…</div>}>
      <Center params={params} />
    </Suspense>
  );
}

async function Center({ params }: { params: Promise<{ id: string }> }) {
  const building = getBuilding((await params).id);
  if (!building) notFound();
  return <ManagementCenter building={building} />;
}
