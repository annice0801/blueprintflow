import "server-only";
import { ANN_TEMPLATES, type Announcement } from "@/lib/field";
import { dateStr, maxLen, str, ValidationError } from "@/lib/validate";

const text = (o: unknown, k: string, n: number) => maxLen(str((o ?? {}) as Record<string, unknown>, k), n, k) ?? "";
const photoName = (p: unknown): p is string => typeof p === "string" && /^[\w-]+\.\w+$/.test(p);

/** 公告可編輯欄位驗證（只回傳有帶的欄位） */
export function annFields(b: Record<string, unknown>): Partial<Announcement> {
  const out: Partial<Announcement> = {};
  if (b.template !== undefined) {
    if (!ANN_TEMPLATES.includes(b.template as Announcement["template"])) throw new ValidationError("公告模板不正確");
    out.template = b.template as Announcement["template"];
  }
  if (b.zh) out.zh = { title: text(b.zh, "title", 80), body: text(b.zh, "body", 4000) };
  if (b.en) out.en = { title: text(b.en, "title", 120), body: text(b.en, "body", 6000) };
  if (b.fields) {
    const f = b.fields as Record<string, unknown>;
    const dt = (k: string) => {
      const v = str(f, k) ?? "";
      if (v && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v)) throw new ValidationError("公告日期格式不正確");
      return v;
    };
    out.fields = { start: dt("start"), end: dt("end"), area: text(f, "area", 80), areaEn: text(f, "areaEn", 120), contact: text(f, "contact", 60), issuer: text(f, "issuer", 60), issuerEn: text(f, "issuerEn", 120) };
  }
  if (Array.isArray(b.photos)) out.photos = b.photos.filter(photoName).slice(0, 6);
  if (b.layout) {
    const l = b.layout as Record<string, unknown>;
    out.layout = {
      lang: (["both", "zh", "en"] as const).includes(l.lang as "both") ? (l.lang as "both") : "both",
      fontScale: Math.min(1.6, Math.max(0.6, Number(l.fontScale) || 1)),
      photoLayout: (["none", "top", "side", "bottom"] as const).includes(l.photoLayout as "none") ? (l.photoLayout as "none") : "none",
      accent: /^#[0-9a-f]{6}$/i.test(String(l.accent ?? "")) ? String(l.accent) : "",
    };
  }
  if (b.source !== undefined) out.source = text(b, "source", 4000);
  if (b.removeBy !== undefined) out.removeBy = dateStr(str(b, "removeBy"), "撤下日") ?? "";
  return out;
}

export { photoName };
