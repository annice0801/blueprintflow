import type { Metadata } from "next";
import { Suspense } from "react";
import LoginPanel from "@/components/auth/LoginPanel";
import { BUILDINGS } from "@/lib/buildings";

export const metadata: Metadata = { title: "登入 · Blueprintflow" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#020814] bg-[linear-gradient(rgba(76,201,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(76,201,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px] px-4 text-slate-200">
      <Suspense>
        <LoginPanel clientId={process.env.GOOGLE_CLIENT_ID ?? ""} communities={BUILDINGS.map((b) => ({ id: b.id, name: b.name, address: b.address }))} />
      </Suspense>
    </main>
  );
}
