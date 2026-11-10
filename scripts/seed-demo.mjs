// 匯入示範資料（假名）：尚未核准的登入者在示範模式看到的就是這份資料
// 用法：node --env-file=.env.local scripts/seed-demo.mjs
// 只寫入 buildingId = "blueprint:demo" 的資料，可重複執行；不會讀取或修改真實社區的資料
import { MongoClient } from "mongodb";

const SCOPE = "blueprint:demo";
const now = new Date().toISOString();
const base = (id) => ({ id, buildingId: SCOPE, createdAt: now, updatedAt: now });

const terms = [
  {
    ...base("demo-term-committee"),
    kind: "committee",
    name: "第一屆管理委員會（示範）",
    start: "2026-01-01",
    end: "2027-12-31",
    note: "示範資料，人名皆為假名",
    members: [
      { id: "demo-m1", roleId: "chair", name: "王小明", phone: "", email: "", note: "", start: "", end: "" },
      { id: "demo-m2", roleId: "vice", name: "陳美玲", phone: "", email: "", note: "", start: "", end: "" },
      { id: "demo-m3", roleId: "finance", name: "林志豪", phone: "", email: "", note: "", start: "", end: "" },
      { id: "demo-m4", roleId: "audit", name: "張雅婷", phone: "", email: "", note: "", start: "", end: "" },
    ],
  },
  {
    ...base("demo-term-property"),
    kind: "property",
    name: "藍圖物業（示範）",
    start: "2026-01-01",
    end: "2026-12-31",
    note: "示範資料",
    members: [
      { id: "demo-p1", roleId: "gm", name: "李建宏", phone: "", email: "", note: "社區經理", start: "", end: "" },
      { id: "demo-p2", roleId: "secretary", name: "黃淑芬", phone: "", email: "", note: "", start: "", end: "" },
      { id: "demo-p3", roleId: "guard", name: "吳家豪", phone: "", email: "", note: "日班", start: "", end: "" },
    ],
  },
];

const vendor = (id, name, category, kind, scope, contact) => ({
  ...base(id),
  kind,
  name,
  category,
  taxId: "",
  representative: "",
  representativePhone: "",
  developer: "",
  developerPhone: "",
  builderId: "",
  contact,
  phone: "",
  email: "",
  address: "",
  website: "",
  scope,
  contractStart: "2026-01-01",
  contractEnd: "2026-12-31",
  amount: "",
  note: "示範資料",
  contacts: [{ id: "c1", name: contact, title: "窗口", dept: "", phone: "", email: "", reportsTo: "", note: "" }],
  records: [],
});

const vendors = [
  vendor("demo-v1", "藍圖物業管理", "物業管理", "property", "社區總幹事、秘書派駐與日常管理", "李建宏"),
  vendor("demo-v2", "安心保全", "保全", "vendor", "24 小時門禁與巡邏", "周文傑"),
  vendor("demo-v3", "昇陽電梯", "電梯", "vendor", "A／B 棟電梯每月保養與故障排除", "鄭家瑜"),
  vendor("demo-v4", "綠意景觀", "景觀植栽", "vendor", "中庭與騎樓植栽修剪、病蟲害防治", "許志明"),
];

const meetings = [
  {
    ...base("demo-meeting-1"),
    title: "第 3 次管委會例會（示範）",
    type: "管委會例會",
    date: "2026-09-15",
    place: "B1 會議室",
    text: [
      "一、主席報告：本月社區運作正常，颱風前已完成排水溝清理。",
      "二、財務報告：管理費收繳率 96%，欠繳戶已寄發催繳通知。",
      "三、提案討論",
      "  1. A 棟 12F 走廊燈具更換為 LED：通過，由物業取得三家報價。",
      "  2. 中庭植栽秋季修剪：通過，請綠意景觀於 10 月底前完成。",
      "  3. 電梯年度安全檢查：請昇陽電梯提供檢查排程。",
      "四、臨時動議：無。",
      "（示範資料，人名與內容皆為虛構）",
    ].join("\n"),
    mentions: [],
    attendance: [
      { name: "王小明", status: "出席", title: "主任委員" },
      { name: "陳美玲", status: "出席", title: "副主任委員" },
      { name: "林志豪", status: "請假", title: "財務委員" },
      { name: "張雅婷", status: "出席", title: "監察委員" },
      { name: "李建宏", status: "列席", title: "總幹事" },
    ],
  },
];

const todo = (id, title, description, assignees, status, priority, start, due, log = []) => ({
  ...base(id),
  title,
  description,
  assignees,
  status,
  priority,
  start,
  due,
  meetingId: "demo-meeting-1",
  log: log.map((text, i) => ({ at: new Date(Date.parse(start) + i * 86400000 * 3).toISOString(), text })),
});

const todos = [
  todo("demo-todo-1", "A 棟 12F 走廊燈具更換報價", "取得三家 LED 燈具報價，提下次例會決議", ["gm"], "進行中", "中", "2026-09-16", "2026-10-15", ["已聯繫兩家廠商"]),
  todo("demo-todo-2", "中庭植栽秋季修剪", "通知綠意景觀排定施工日，施工前一週張貼公告", ["gm", "secretary"], "未開始", "低", "2026-10-01", "2026-10-31"),
  todo("demo-todo-3", "電梯年度安全檢查排程", "請昇陽電梯提供檢查日期並安排停用公告", ["gm"], "待確認", "高", "2026-09-16", "2026-10-05", ["廠商已回覆兩個可選日期"]),
  todo("demo-todo-4", "管理費欠繳催繳", "寄發第二次催繳通知並記錄回覆", ["finance", "secretary"], "進行中", "中", "2026-09-16", "2026-10-20"),
  todo("demo-todo-5", "颱風前排水溝清理", "B1 車道與屋頂排水孔清理", ["gm", "cleaner"], "已完成", "高", "2026-09-01", "2026-09-10", ["已完成並拍照存證"]),
];

const sets = { terms, vendors, meetings, todos };

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("請用 --env-file=.env.local 執行，需要 MONGODB_URI");
const client = new MongoClient(uri);
await client.connect();
const db = client.db();
for (const [name, docs] of Object.entries(sets)) {
  const col = db.collection(name);
  // 先移除這次清單裡沒有的舊示範資料，只動示範範圍
  const keep = docs.map((d) => d.id);
  const removed = await col.deleteMany({ buildingId: SCOPE, _id: { $nin: keep } });
  for (const [i, d] of docs.entries()) {
    await col.replaceOne({ _id: d.id }, { ...d, _id: d.id, _order: i }, { upsert: true });
  }
  console.log(`${name}: ${docs.length} 筆示範資料${removed.deletedCount ? `，移除舊的 ${removed.deletedCount} 筆` : ""}`);
}
await client.close();
