import "server-only";
import { getZones } from "./buildings";
import type { Announcement } from "./field";
import type { Issue } from "./issues";
import type { Meeting, Regulation, Todo } from "./mgmt";
import type { MyRepair, PortalAnnouncement, PortalMeeting, PortalRegulation, PortalRepair } from "./perms";
import { GATE_PARTS, GATES, partState, type GateLog } from "./records";
import { readCollection } from "./store";

/*
 * 住戶專區：只回傳整理過的公開內容。
 * 不含人員姓名與電話、內部備註、審核紀錄、廠商與合約、指派對象；文字再遮蔽電話、Email、身分證字號。
 */

export function scrub(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "＊＊＊")
    .replace(/\b[A-Z][12]\d{8}\b/g, "＊＊＊")
    .replace(/(?:\+?886[-\s]?|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}/g, "＊＊＊")
    .replace(/\(?0\d{1,2}\)?[-\s]?\d{3,4}[-\s]?\d{4}/g, "＊＊＊");
}

const PUBLISHED_ANN: Announcement["status"][] = ["已核准", "張貼中", "已張貼"];
const PUBLISHED_REG: Regulation["status"][] = ["已通過", "已公告"];

export async function portalAnnouncements(buildingId: string): Promise<PortalAnnouncement[]> {
  const today = new Date().toISOString().slice(0, 10);
  return (await readCollection<Announcement>("announcements"))
    .filter((a) => a.buildingId === buildingId && PUBLISHED_ANN.includes(a.status) && (!a.removeBy || a.removeBy >= today))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => ({
      id: a.id,
      title: a.zh.title,
      body: scrub(a.zh.body),
      titleEn: a.en.title,
      bodyEn: scrub(a.en.body),
      start: a.fields.start,
      end: a.fields.end,
      area: a.fields.area,
      photos: a.photos,
      postedAt: a.postings[0]?.postedAt ?? a.updatedAt,
    }));
}

export async function portalRegulations(buildingId: string): Promise<PortalRegulation[]> {
  return (await readCollection<Regulation>("regulations"))
    .filter((r) => r.buildingId === buildingId && PUBLISHED_REG.includes(r.status))
    .map((r) => ({ id: r.id, title: r.title, category: r.category, version: r.version, effectiveDate: r.effectiveDate, summary: scrub(r.summary), content: scrub(r.content) }));
}

/** 會議結果：決議事項與後續處理情形（不含出席名單、原檔、地點標記） */
export async function portalMeetings(buildingId: string): Promise<PortalMeeting[]> {
  const todos = await readCollection<Todo>("todos");
  return (await readCollection<Meeting>("meetings"))
    .filter((m) => m.buildingId === buildingId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((m) => ({
      id: m.id,
      title: m.title,
      date: m.date,
      type: m.type,
      decisions: decisionsOf(m.text),
      followUps: todos.filter((t) => t.meetingId === m.id).map((t) => ({ title: scrub(t.title.replace(/^.+?｜/, "")), status: t.status })),
    }));
}

/** 從會議紀錄取出「決議」段落 */
function decisionsOf(text: string) {
  const out: string[] = [];
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/決\s*[”"“]?\s*議\s*[:：]\s*(.*)/);
    if (!m) continue; // 需有冒號，排除「上次會議決議執行情況」這類標題
    let s = m[1];
    // 決議常換行續寫：接到下一個編號或段落標題為止
    for (let j = i + 1; j < lines.length && s.length < 400 && !/^\s*([一二三四五六七八九十]+、|\d+[.、]|[壹貳參肆伍陸柒捌玖拾][、.]|案由|說明|決\s*議)/.test(lines[j]); j++) s += lines[j].trim();
    s = scrub(s.split(/議題[一二三四五六七八九十\d]+\s*[:：]|[壹貳參肆伍陸柒捌玖拾]{1,2}、/)[0].trim()); // 不黏到下一個議題
    if (s.length > 4) out.push(s.slice(0, 400));
  }
  return out;
}

/** 位置是否在住戶室內 / 店鋪內（不公開給其他住戶，避免看出是哪一戶） */
function isPrivateSpot(floor: string, tower: "A" | "B" | "S", x: number, y: number) {
  return getZones(floor, tower).some((z) => (z.kind === "unit" || z.kind === "shop") && x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
}

/** 目前維修中（只含公共區域）：報修與巡檢問題、進行中且有位置的待辦、車道設備故障 */
export async function portalRepairs(buildingId: string): Promise<PortalRepair[]> {
  const out: PortalRepair[] = [];
  for (const i of await readCollection<Issue>("issues"))
    if (i.buildingId === buildingId && i.status !== "已完成" && !isPrivateSpot(i.floor, i.tower, i.x, i.y))
      out.push({ id: `i-${i.id}`, kind: "報修", title: `${i.category}：${scrub(i.title)}`, floor: i.floor, tower: i.tower, x: i.x, y: i.y, label: i.zone || i.floor, status: i.status, since: i.createdAt.slice(0, 10), expected: "" });
  for (const t of await readCollection<Todo>("todos"))
    if (t.buildingId === buildingId && t.location && !isPrivateSpot(t.location.floor, t.location.tower, t.location.x, t.location.y) && (t.status === "進行中" || (t.status === "未開始" && t.start && t.start <= new Date().toISOString().slice(0, 10))))
      out.push({ id: `t-${t.id}`, kind: "維修", title: "維修 / 施工處理中", floor: t.location.floor, tower: t.location.tower, x: t.location.x, y: t.location.y, label: t.location.label, status: t.status === "進行中" ? "處理中" : "已排定", since: t.start, expected: t.due });
  const logs = (await readCollection<GateLog>("gate-logs")).filter((l) => l.buildingId === buildingId);
  const ramp = getZones("1F", "S").find((z) => z.link === "driveway");
  if (ramp)
    for (const g of GATES)
      for (const part of GATE_PARTS[g]) {
        const st = partState(logs, g, part);
        if (st.bad || st.fixing)
          out.push({ id: `g-${g}-${part}`, kind: "設備", title: `${g}道閘 ${part}${st.bad ? " 故障" : " 維修中"}`, floor: "1F", tower: "S", x: ramp.x + ramp.w / 2, y: ramp.y + ramp.h / 2, label: "車道出入口", status: st.bad ? "待維修" : "維修中", since: st.last!.at.slice(0, 10), expected: "" });
      }
  return out;
}

/** 我的報修：只回傳自己送出的 */
export async function myRepairs(buildingId: string, email: string): Promise<MyRepair[]> {
  return (await readCollection<Issue>("issues"))
    .filter((i) => i.buildingId === buildingId && i.reporter === email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((i) => ({ id: i.id, title: i.title, description: i.description, category: i.category, floor: i.floor, tower: i.tower, zone: i.zone, status: i.status, photos: i.photos, createdAt: i.createdAt, updatedAt: i.updatedAt }));
}
