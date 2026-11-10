import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ResidentBooking from "@/components/field/ResidentBooking";
import { BUILDINGS, getBuilding } from "@/lib/buildings";

export function generateStaticParams() {
  return BUILDINGS.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: PageProps<"/buildings/[id]/book">): Promise<Metadata> {
  const b = getBuilding((await params).id);
  return { title: b ? `住戶預約 · ${b.name}` : "住戶預約" };
}

export default function BookPage({ params }: PageProps<"/buildings/[id]/book">) {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-[#020814] text-sm text-cyan-400/70">載入中…</div>}>
      <Book params={params} />
    </Suspense>
  );
}

async function Book({ params }: { params: Promise<{ id: string }> }) {
  const building = getBuilding((await params).id);
  if (!building) notFound();
  return <ResidentBooking building={building} />;
}
