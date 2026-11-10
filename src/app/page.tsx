import Link from "next/link";
import MemberOnly from "@/components/auth/MemberOnly";
import UserMenu from "@/components/auth/UserMenu";
import { BUILDINGS } from "@/lib/buildings";

export default function Home() {
  return (
    <main className="min-h-dvh bg-[#020814] bg-[linear-gradient(rgba(76,201,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(76,201,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px] px-6 py-16 text-slate-200">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <p className="font-mono text-sm font-bold tracking-[0.4em] text-cyan-300">BLUEPRINTFLOW</p>
          <UserMenu />
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-cyan-50">我的社區</h1>
        <p className="mt-2 text-sm text-cyan-200/60">選擇社區，進入 3D 平面圖、管理中心與現場作業。</p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {BUILDINGS.map((b) => (
            <MemberOnly key={b.id} id={b.id}>
              <li>
                <Link
                  href={`/buildings/${b.id}`}
                  className="group block rounded-xl border border-cyan-400/30 bg-[#04122a]/80 p-5 transition hover:border-cyan-300 hover:shadow-[0_0_30px_rgba(76,201,255,0.25)]"
                >
                  <div className="flex items-end gap-1.5" aria-hidden>
                    {[0.55, 0.5].map((hgt, i) => (
                      <div
                        key={i}
                        className="w-10 border border-cyan-300/70 bg-[repeating-linear-gradient(0deg,rgba(76,201,255,0.35)_0_1px,transparent_1px_5px)]"
                        style={{ height: `${hgt * 140}px` }}
                      />
                    ))}
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-cyan-50 group-hover:text-white">{b.name}</h2>
                  <p className="text-sm text-cyan-200/70">{b.subtitle}</p>
                  <p className="mt-3 text-xs text-slate-400">{b.address}</p>
                  <p className="mt-1 text-xs text-slate-400">地下 4 層 · 地上 22 層 + R 樓 · A / B 雙棟</p>
                </Link>
              </li>
            </MemberOnly>
          ))}
        </ul>
      </div>
    </main>
  );
}
