// 一次性搬遷：data/*.json → MongoDB；data/uploads → Vercel Blob
// 用法：node --env-file=.env.local scripts/migrate-local-to-cloud.mjs
// Mongo 中已有資料的 collection 會略過，避免重複匯入
import { promises as fs } from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import { put } from "@vercel/blob";

const DATA = path.join(process.cwd(), "data");
const ACCESS = process.env.BLOB_ACCESS === "private" ? "private" : "public";
const MIME = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".heic": "image/heic", ".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".txt": "text/plain", ".md": "text/plain" };

const client = await new MongoClient(process.env.MONGODB_URI).connect();
const db = client.db();
for (const f of (await fs.readdir(DATA)).filter((x) => x.endsWith(".json"))) {
  const name = f.slice(0, -5);
  const items = JSON.parse(await fs.readFile(path.join(DATA, f), "utf8"));
  const col = db.collection(name);
  if (!items.length) continue;
  if (await col.countDocuments()) {
    console.log(`略過 ${name}：Mongo 已有資料`);
    continue;
  }
  const t = Date.now();
  await col.insertMany(items.map((x, i) => ({ ...x, _id: String(x.id ?? x.buildingId), _order: t + i })));
  console.log(`${name}：${items.length} 筆`);
}
await client.close();

for (const [dir, folder] of [[path.join(DATA, "uploads"), "uploads"], [path.join(DATA, "uploads", "docs"), "docs"]]) {
  const files = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of files.filter((x) => x.isFile() && MIME[path.extname(x.name).toLowerCase()])) {
    await put(`${folder}/${e.name}`, await fs.readFile(path.join(dir, e.name)), { access: ACCESS, addRandomSuffix: false, allowOverwrite: true, contentType: MIME[path.extname(e.name).toLowerCase()] });
    console.log(`Blob ${folder}/${e.name}`);
  }
}
