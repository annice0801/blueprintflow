"use client";

import { rocDate, TEMPLATE_INFO } from "@/lib/announce";
import type { Announcement } from "@/lib/field";

/** A4 公告（字級以容器寬度 cqw 計，預覽與列印比例一致） */
export default function Poster({ ann, printable }: { ann: Announcement; printable?: boolean }) {
  const t = TEMPLATE_INFO[ann.template];
  const accent = ann.layout.accent || t.accent;
  const k = ann.layout.fontScale;
  const fs = (cqw: number) => `${cqw * k}cqw`;
  const showZh = ann.layout.lang !== "en";
  const showEn = ann.layout.lang !== "zh";
  const photos = ann.layout.photoLayout === "none" ? [] : ann.photos;
  const issued = rocDate(ann.createdAt.slice(0, 10));

  const header = (() => {
    switch (ann.template) {
      case "construction":
        return { background: `repeating-linear-gradient(-45deg, #facc15 0 3cqw, #111827 3cqw 6cqw)` };
      case "event":
        return { background: `radial-gradient(circle at 15% 30%, #f0abfc 0 1.2cqw, transparent 1.3cqw), radial-gradient(circle at 80% 60%, #fde68a 0 1cqw, transparent 1.1cqw), radial-gradient(circle at 60% 20%, #93c5fd 0 .8cqw, transparent .9cqw), linear-gradient(135deg, ${accent}, #6d28d9)` };
      case "water":
        return { background: `linear-gradient(180deg, ${accent}, #0369a1)` };
      default:
        return { background: `linear-gradient(135deg, ${accent}, ${shade(accent)})` };
    }
  })();

  const photoBlock = photos.length > 0 && (
    <div className={ann.layout.photoLayout === "side" ? "flex flex-col gap-[1.5cqw]" : "grid gap-[1.5cqw]"} style={ann.layout.photoLayout !== "side" ? { gridTemplateColumns: `repeat(${Math.min(photos.length, 3)}, 1fr)` } : undefined}>
      {photos.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p} src={`/api/uploads/${p}`} alt="" className="w-full rounded-[1cqw] object-cover" style={{ aspectRatio: ann.layout.photoLayout === "side" ? "4/3" : "16/10" }} />
      ))}
    </div>
  );

  const body = (
    <div className="flex flex-col gap-[3cqw]">
      {showZh && (
        <p className="whitespace-pre-wrap leading-[1.75]" style={{ fontSize: fs(3.1) }}>
          {ann.zh.body}
        </p>
      )}
      {showZh && showEn && <hr className="border-dashed" style={{ borderColor: accent }} />}
      {showEn && (
        <p className="whitespace-pre-wrap leading-[1.6] text-slate-700" style={{ fontSize: fs(showZh ? 2.6 : 3.1) }}>
          {ann.en.body}
        </p>
      )}
    </div>
  );

  return (
    <div
      className={`relative flex w-full flex-col overflow-hidden bg-white text-slate-900 shadow-2xl ${printable ? "print-area" : ""}`}
      style={{ aspectRatio: "210 / 297", containerType: "inline-size", fontFamily: '"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif' }}
    >
      <div className="relative px-[6cqw] pb-[4cqw] pt-[5cqw] text-white" style={header}>
        {ann.template === "construction" && <div className="absolute inset-x-0 bottom-0 top-[3cqw] bg-slate-900/85" />}
        <div className="relative flex items-start justify-between" style={{ fontSize: fs(2) }}>
          <div>
            <p className="font-semibold">{ann.fields.issuer}</p>
            {showEn && <p className="opacity-80">{ann.fields.issuerEn}</p>}
          </div>
          <span style={{ fontSize: fs(9) }} className="leading-none">
            {t.icon}
          </span>
        </div>
        <div className="relative mt-[2cqw]">
          {showZh && (
            <h1 className="font-black tracking-wider" style={{ fontSize: fs(8.5) }}>
              {ann.zh.title}
            </h1>
          )}
          {showEn && (
            <h2 className="font-bold uppercase tracking-wide opacity-90" style={{ fontSize: fs(showZh ? 3.4 : 7) }}>
              {ann.en.title}
            </h2>
          )}
        </div>
      </div>

      {(ann.fields.start || ann.fields.area) && (
        <div className="mx-[6cqw] mt-[4cqw] grid gap-[1cqw] rounded-[1.5cqw] border-[0.4cqw] px-[3cqw] py-[2cqw]" style={{ borderColor: accent, fontSize: fs(2.6) }}>
          {ann.fields.start && (
            <p>
              <b style={{ color: accent }}>{showZh ? "日期" : "Date"}</b>
              <span className="ml-[2cqw]">
                {showZh ? `${rocDate(ann.fields.start)}${ann.fields.end ? ` ～ ${rocDate(ann.fields.end)}` : ""}` : ""}
              </span>
            </p>
          )}
          {ann.fields.area && (
            <p>
              <b style={{ color: accent }}>{showZh ? "範圍" : "Area"}</b>
              <span className="ml-[2cqw]">
                {showZh ? ann.fields.area : ""}
                {showZh && showEn && ann.fields.areaEn ? " / " : ""}
                {showEn ? ann.fields.areaEn : ""}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="flex-1 px-[6cqw] py-[4cqw]">
        {ann.layout.photoLayout === "top" && <div className="mb-[3cqw]">{photoBlock}</div>}
        {ann.layout.photoLayout === "side" ? (
          <div className="grid grid-cols-[1.4fr_1fr] gap-[3cqw]">
            {body}
            {photoBlock}
          </div>
        ) : (
          body
        )}
        {ann.layout.photoLayout === "bottom" && <div className="mt-[3cqw]">{photoBlock}</div>}
      </div>

      <div className="flex items-end justify-between px-[6cqw] pb-[5cqw]" style={{ fontSize: fs(2.2) }}>
        <span className="text-slate-500">{showZh ? `公告日期：${issued}` : ""}</span>
        <div className="text-right">
          <p className="font-semibold">{ann.fields.issuer}　敬啟</p>
          {showEn && <p className="text-slate-500">{ann.fields.issuerEn}</p>}
        </div>
      </div>
      <div className="h-[1.6cqw]" style={{ background: accent }} />
    </div>
  );
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.round(c * 0.6));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("")}`;
}
