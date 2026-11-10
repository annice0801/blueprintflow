import "server-only";
import { del, get, put } from "@vercel/blob";
import { MongoClient, type AnyBulkWriteOperation, type Document } from "mongodb";
import path from "path";
import type { Issue } from "./issues";
import { ValidationError } from "./validate";

// 文字資料存 MongoDB（每個 collection 一個 Mongo collection，_id = 資料 id）；照片與檔案存 Vercel Blob

export type Collection = "issues" | "plants" | "gate-logs" | "shops" | "residents" | "meetings" | "todos" | "vendors" | "terms" | "regulations" | "settings" | "reservations" | "visitors" | "fieldlogs" | "announcements" | "shifts" | "inspections" | "events" | "holidays" | "users" | "roles" | "audit" | "usage" | "feedback" | "fees";

const g = globalThis as unknown as { _mongo?: Promise<MongoClient> };

function db() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("未設定 MONGODB_URI");
  // 開發模式熱更新時沿用同一個連線
  g._mongo ??= new MongoClient(uri).connect();
  return g._mongo.then((c) => c.db());
}

/** 每筆資料的鍵：一般用 id；設定類（一社區一筆）用 buildingId */
const keyOf = (item: Record<string, unknown>) => String(item.id ?? item.buildingId ?? "");

const queues = new Map<Collection, Promise<unknown>>();

/** 同一 collection 依序寫入，避免同時修改互相覆蓋 */
function serialize<T>(name: Collection, fn: () => Promise<T>): Promise<T> {
  const run = (queues.get(name) ?? Promise.resolve()).then(fn, fn);
  queues.set(name, run.catch(() => {}));
  return run;
}

async function readRaw(name: Collection) {
  const docs = await (await db()).collection(name).find({}, { projection: { _id: 0 } }).sort({ _order: 1 }).toArray();
  const orders = new Map<string, number>();
  const items = docs.map(({ _order, ...d }) => {
    orders.set(keyOf(d), _order as number);
    return d;
  });
  return { items, orders };
}

export async function readCollection<T>(name: Collection): Promise<T[]> {
  return (await readRaw(name)).items as T[];
}

/** 讀出整個 collection 交給 fn 修改，再只把有變動的資料寫回（新增、修改、刪除） */
export function mutateCollection<T, R>(name: Collection, fn: (items: T[]) => R | Promise<R>): Promise<R> {
  return serialize(name, async () => {
    const raw = await readRaw(name);
    const items = raw.items as T[];
    const before = new Map(items.map((x) => [keyOf(x as Record<string, unknown>), JSON.stringify(x)]));
    const result = await fn(items);
    const ops: AnyBulkWriteOperation<Document>[] = [];
    const seen = new Set<string>();
    let order = Date.now();
    for (const item of items as Record<string, unknown>[]) {
      const key = keyOf(item);
      if (!key) throw new Error(`${name} 資料缺少 id`);
      seen.add(key);
      const old = before.get(key);
      if (old === JSON.stringify(item)) continue;
      const doc = JSON.parse(JSON.stringify(item)); // 去掉 undefined
      ops.push(
        old === undefined
          ? { updateOne: { filter: { _id: key as never }, update: { $set: doc, $setOnInsert: { _order: order++ } }, upsert: true } }
          : { replaceOne: { filter: { _id: key as never }, replacement: { ...doc, _order: raw.orders.get(key) ?? order++ }, upsert: true } },
      );
    }
    const removed = [...before.keys()].filter((k) => !seen.has(k));
    if (removed.length) ops.push({ deleteMany: { filter: { _id: { $in: removed as never[] } } } });
    if (ops.length) await (await db()).collection(name).bulkWrite(ops, { ordered: true });
    return result;
  });
}

/** 只新增一筆（紀錄類，不讀整個 collection） */
export async function insertDoc(name: Collection, doc: { id: string } & Record<string, unknown>) {
  await (await db()).collection(name).insertOne({ ...doc, _id: doc.id as never, _order: Date.now() });
}

/** 依條件查詢最新 n 筆（紀錄類） */
export async function queryDocs<T>(name: Collection, filter: Record<string, unknown>, limit = 200): Promise<T[]> {
  const docs = await (await db()).collection(name).find(filter, { projection: { _id: 0, _order: 0 } }).sort({ _order: -1 }).limit(limit).toArray();
  return docs as T[];
}

/** 統計用聚合查詢 */
export async function aggregateDocs<T>(name: Collection, pipeline: Document[]): Promise<T[]> {
  return (await (await db()).collection(name).aggregate(pipeline).toArray()) as T[];
}

export async function countDocs(name: Collection, filter: Record<string, unknown> = {}) {
  return (await db()).collection(name).countDocuments(filter);
}

export const readIssues = () => readCollection<Issue>("issues");
export const mutateIssues = <R>(fn: (issues: Issue[]) => R | Promise<R>) => mutateCollection("issues", fn);

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
};
export const MIME: Record<string, string> = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));

export async function savePhoto(file: File): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new ValidationError(`不支援的檔案格式：${file.type || file.name}`);
  if (file.size > 15 * 1024 * 1024) throw new ValidationError(`照片超過 15MB：${file.name}`);
  const name = `${crypto.randomUUID()}${ext}`;
  await putFile("uploads", name, file);
  return name;
}

export async function deletePhoto(name: string) {
  await removeFile("uploads", name);
}

/*
 * Vercel Blob：uploads/<檔名>（照片）、docs/<檔名>（文件），一律經由 /api/uploads、/api/docs 讀取，前端不直接拿 Blob 網址。
 * 目前的 store 為 public（檔名為隨機 UUID）；改用 private store 後設 BLOB_ACCESS=private 即可。
 */
type Folder = "uploads" | "docs";
const ACCESS = process.env.BLOB_ACCESS === "private" ? "private" : "public";
const blobPath = (folder: Folder, name: string) => `${folder}/${path.basename(name)}`;

async function putFile(folder: Folder, name: string, file: File) {
  await put(blobPath(folder, name), Buffer.from(await file.arrayBuffer()), { access: ACCESS, addRandomSuffix: false, contentType: file.type || undefined });
}

async function removeFile(folder: Folder, name: string) {
  await del(blobPath(folder, name)).catch(() => {});
}

/** 讀取檔案串流；找不到回傳 null */
export async function getFile(folder: Folder, name: string) {
  const res = await get(blobPath(folder, name), { access: ACCESS }).catch(() => null);
  return res && res.statusCode === 200 ? res.stream : null;
}

export async function readFileBuffer(folder: Folder, name: string) {
  const stream = await getFile(folder, name);
  return stream ? Buffer.from(await new Response(stream).arrayBuffer()) : null;
}

/* 會議紀錄原檔（docx / pdf / txt） */
export const DOC_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

export async function saveDocument(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  if (!DOC_MIME[ext]) throw new ValidationError("僅支援 .docx、.pdf、.txt 檔");
  if (file.size > 20 * 1024 * 1024) throw new ValidationError("檔案超過 20MB");
  const name = `${crypto.randomUUID()}${ext}`;
  await putFile("docs", name, file);
  return name;
}

export async function deleteDocument(name: string) {
  await removeFile("docs", name);
}
