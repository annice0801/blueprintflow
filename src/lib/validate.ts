import "server-only";

export class ValidationError extends Error {}

/** 表單或 JSON 欄位：去頭尾空白；不存在回傳 undefined */
export function str(src: FormData | Record<string, unknown>, key: string) {
  const v = src instanceof FormData ? src.get(key) : src[key];
  return typeof v === "string" ? v.trim() : undefined;
}

export function oneOf<T extends string>(value: string | undefined, list: readonly T[], label: string): T | undefined {
  if (value === undefined) return undefined;
  if (!list.includes(value as T)) throw new ValidationError(`${label}不正確：${value}`);
  return value as T;
}

export function num(value: string | undefined, label: string) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ValidationError(`${label}不正確`);
  return n;
}

export function maxLen(value: string | undefined, max: number, label: string) {
  if ((value?.length ?? 0) > max) throw new ValidationError(`${label}最多 ${max} 字`);
  return value;
}

/** YYYY-MM-DD 或 YYYY-MM-DDTHH:mm */
export function dateStr(value: string | undefined, label: string) {
  if (!value) return value;
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value) || Number.isNaN(Date.parse(value))) throw new ValidationError(`${label}格式不正確`);
  return value;
}

export function photosFrom(form: FormData) {
  return form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
}

export function removedPhotos(form: FormData) {
  return form.getAll("removePhotos").filter((v): v is string => typeof v === "string");
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {}
  throw new ValidationError("資料格式不正確");
}

export const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export function errorResponse(e: unknown) {
  if (e instanceof ValidationError) return Response.json({ error: e.message }, { status: 400 });
  console.error(e);
  return Response.json({ error: "伺服器發生錯誤" }, { status: 500 });
}

export const notFound = (what: string) => Response.json({ error: `找不到${what}` }, { status: 404 });
