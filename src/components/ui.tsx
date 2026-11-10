"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const INPUT =
  "w-full rounded-md border border-cyan-500/30 bg-slate-950/60 px-3 py-2 text-sm text-cyan-50 placeholder:text-slate-500 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50";

export const BTN_PRIMARY = "rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50";
export const BTN_GHOST = "rounded-md px-4 py-2 text-sm text-slate-300 hover:bg-white/5";
export const BTN_DANGER = "rounded-md px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50";
export const BTN_OUTLINE = "rounded-md border border-cyan-500/40 px-2.5 py-1 text-sm text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-30";

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-xs text-cyan-300">{label}</span>
      {children}
    </label>
  );
}

export function Select<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <select className={INPUT} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return children ? <p className="rounded-md bg-rose-500/15 px-3 py-2 text-sm text-rose-300">{children}</p> : null;
}

/** 置中對話框；Esc 或點背景關閉 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  onSubmit,
  wide,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // portal 到 body：避免祖先的 backdrop-filter 讓 fixed 改以祖先為定位基準
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.(e);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full ${wide ? "max-w-2xl" : "max-w-lg"} flex-col overflow-hidden rounded-xl border border-cyan-400/40 bg-[#06142a] shadow-[0_0_40px_rgba(76,201,255,0.25)]`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-cyan-500/20 px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-cyan-100">{title}</h2>
            {subtitle && <p className="text-xs text-cyan-300/70">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="關閉">
            ✕
          </button>
        </header>
        <div className="space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex items-center gap-2 border-t border-cyan-500/20 px-5 py-3">{footer}</footer>}
      </form>
    </div>,
    document.body,
  );
}

/** 照片欄位狀態：保留的舊照片 + 新選的檔案 */
export function usePhotos(initial: string[] = []) {
  const [keep, setKeep] = useState<string[]>(initial);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  return {
    keep,
    files,
    add(list: FileList | null) {
      const picked = Array.from(list ?? []).map((file) => ({ file, url: URL.createObjectURL(file) }));
      urls.current.push(...picked.map((p) => p.url));
      setFiles((fs) => [...fs, ...picked]);
    },
    removeKept: (p: string) => setKeep((k) => k.filter((x) => x !== p)),
    removeNew: (url: string) => setFiles((fs) => fs.filter((x) => x.url !== url)),
    reset(next: string[] = []) {
      setKeep(next);
      setFiles([]);
    },
    /** 寫入 FormData：photos（新檔）+ removePhotos（被移除的舊檔） */
    appendTo(fd: FormData, original: string[] = []) {
      files.forEach((f) => fd.append("photos", f.file));
      original.filter((p) => !keep.includes(p)).forEach((p) => fd.append("removePhotos", p));
    },
  };
}

export function PhotoField({ photos, label = "照片" }: { photos: ReturnType<typeof usePhotos>; label?: string }) {
  return (
    <div className="space-y-2">
      <span className="text-xs text-cyan-300">{label}</span>
      <div className="grid grid-cols-4 gap-2">
        {photos.keep.map((p) => (
          <Thumb key={p} src={`/api/uploads/${p}`} onRemove={() => photos.removeKept(p)} />
        ))}
        {photos.files.map((f) => (
          <Thumb key={f.url} src={f.url} onRemove={() => photos.removeNew(f.url)} isNew />
        ))}
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-cyan-500/40 text-cyan-300/80 hover:border-cyan-400 hover:bg-cyan-400/5">
          <span className="text-2xl leading-none">＋</span>
          <span className="mt-1 text-[11px]">上傳</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
            multiple
            className="hidden"
            onChange={(e) => {
              photos.add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

export function Thumb({ src, onRemove, isNew }: { src: string; onRemove?: () => void; isNew?: boolean }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-cyan-500/30 bg-slate-900">
      <a href={src} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
      </a>
      {isNew && <span className="absolute left-1 top-1 rounded bg-cyan-500 px-1 text-[10px] font-semibold text-slate-950">新</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white group-hover:flex"
          aria-label="移除照片"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** fetch 包裝：非 2xx 時丟出伺服器錯誤訊息 */
/** 目前所在社區：/buildings/<id>/… 或後台 /admin?c=<id>；伺服器據此套用該社區的權限 */
function currentCommunity() {
  if (typeof window === "undefined") return "";
  const { pathname, search } = window.location;
  return pathname.match(/^\/buildings\/([^/]+)/)?.[1] ?? (pathname.startsWith("/admin") ? (new URLSearchParams(search).get("c") ?? "") : "");
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const community = currentCommunity();
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined && { "Content-Type": "application/json" }), ...(community && { "x-bf-building": community }), ...(rest.headers as Record<string, string>) },
    ...(json !== undefined && { body: JSON.stringify(json) }),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "操作失敗");
  return data as T;
}

/** 本地時間 YYYY-MM-DDTHH:mm，給 datetime-local 預設值 */
export function nowLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function fmtDateTime(s: string) {
  return s.replace("T", " ");
}
