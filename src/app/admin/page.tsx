import type { Metadata } from "next";
import { Suspense } from "react";
import AdminConsole from "@/components/admin/AdminConsole";

export const metadata: Metadata = { title: "後台管理 · Blueprintflow" };

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-[#020814] text-sm text-cyan-400/70">載入中…</div>}>
      <AdminConsole />
    </Suspense>
  );
}
