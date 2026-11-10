"use client";

import { useMe } from "./AuthProvider";

/** 示範模式提示：尚未核准的帳號看到的是假名示範資料，可申請查看完整資料 */
export default function DemoBanner() {
  const me = useMe();
  if (!me?.demo) return null;
  return (
    <div className="fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-9rem)] items-center gap-2 rounded-full border border-amber-400/50 bg-[#06142a]/95 py-1.5 pl-3.5 pr-1.5 text-sm text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.2)]">
      <span className="truncate">示範模式 · 內容為假名示範資料</span>
      <a href="/login?status=pending" className="shrink-0 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-400/25">
        申請完整權限
      </a>
    </div>
  );
}
