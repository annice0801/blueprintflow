"use client";

/** 蓋在 3D 畫面上的大面板（樓層平面、花圃、車道、管理員） */
export default function Overlay({
  title,
  meta,
  onBack,
  backLabel = "← 返回 3D",
  actions,
  hint,
  children,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  onBack: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="absolute inset-3 flex flex-col overflow-hidden rounded-xl border border-cyan-400/40 bg-[#030d1c]/95 shadow-[0_0_50px_rgba(76,201,255,0.18)] backdrop-blur md:inset-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-cyan-500/20 px-4 py-2.5">
        <button onClick={onBack} className="rounded-md px-2 py-1 text-sm text-cyan-300 hover:bg-cyan-400/10">
          {backLabel}
        </button>
        <h2 className="text-lg font-semibold text-cyan-50">{title}</h2>
        {meta && <span className="text-xs text-cyan-300/70">{meta}</span>}
        <div className="flex-1" />
        {actions}
      </div>
      {hint && <p className="px-4 pt-2 text-xs text-cyan-300/60">{hint}</p>}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
