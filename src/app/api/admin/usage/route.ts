import type { NextRequest } from "next/server";
import { readUsers, requestUser } from "@/lib/auth";
import { aggregateDocs } from "@/lib/store";

const TZ = "Asia/Taipei";
const day = (field: unknown) => ({ $dateToString: { format: "%Y-%m-%d", date: field, timezone: TZ } });

/**
 * 本社區使用統計（近 N 天）：每日活躍人數與開頁次數、各區域使用量、每位使用者頻率、星期 × 時段分布。
 * 開頁來自 usage（前端回報），操作（新增 / 修改 / 刪除）來自 audit。
 */
export async function GET(request: NextRequest) {
  const { buildingId } = requestUser(request);
  const days = Math.min(180, Math.max(7, Number(request.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 86400000);
  const since7 = new Date(Date.now() - 7 * 86400000);
  const auditAt = { $toDate: "$at" };

  const [daily, areas, perUser, hours, actDaily, actUser, users] = await Promise.all([
    aggregateDocs<{ _id: string; users: string[]; views: number }>("usage", [
      { $match: { at: { $gte: since }, buildingId } },
      { $group: { _id: day("$at"), users: { $addToSet: "$email" }, views: { $sum: 1 } } },
    ]),
    aggregateDocs<{ _id: string; views: number; users: string[] }>("usage", [
      { $match: { at: { $gte: since }, buildingId } },
      { $group: { _id: "$area", views: { $sum: 1 }, users: { $addToSet: "$email" } } },
      { $sort: { views: -1 } },
    ]),
    aggregateDocs<{ _id: string; views: number; views7: number; days: string[]; last: Date; top: string[] }>("usage", [
      { $match: { at: { $gte: since }, buildingId } },
      { $group: { _id: "$email", views: { $sum: 1 }, views7: { $sum: { $cond: [{ $gte: ["$at", since7] }, 1, 0] } }, days: { $addToSet: day("$at") }, last: { $max: "$at" }, top: { $push: "$area" } } },
    ]),
    aggregateDocs<{ _id: { d: number; h: number }; n: number }>("usage", [
      { $match: { at: { $gte: since }, buildingId } },
      { $group: { _id: { d: { $dayOfWeek: { date: "$at", timezone: TZ } }, h: { $hour: { date: "$at", timezone: TZ } } }, n: { $sum: 1 } } },
    ]),
    aggregateDocs<{ _id: string; n: number }>("audit", [{ $addFields: { t: auditAt } }, { $match: { t: { $gte: since }, buildingId } }, { $group: { _id: day("$t"), n: { $sum: 1 } } }]),
    aggregateDocs<{ _id: string; n: number }>("audit", [{ $addFields: { t: auditAt } }, { $match: { t: { $gte: since }, buildingId } }, { $group: { _id: "$email", n: { $sum: 1 } } }]),
    readUsers(),
  ]);

  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(new Date(Date.now() - i * 86400000).toLocaleDateString("sv-SE", { timeZone: TZ }));
  const dMap = new Map(daily.map((d) => [d._id, d]));
  const aMap = new Map(actDaily.map((d) => [d._id, d.n]));
  const actByUser = new Map(actUser.map((u) => [u._id, u.n]));
  const mostUsed = (list: string[]) => {
    const c = new Map<string, number>();
    for (const a of list) c.set(a, (c.get(a) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a);
  };
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const h of hours) heat[(h._id.d + 5) % 7][h._id.h] = h.n; // 週一在前

  return Response.json({
    days,
    daily: dates.map((d) => ({ date: d, users: dMap.get(d)?.users.length ?? 0, views: dMap.get(d)?.views ?? 0, actions: aMap.get(d) ?? 0 })),
    areas: areas.map((a) => ({ area: a._id, views: a.views, users: a.users.length })),
    users: users
      .flatMap((u) => {
        const m = u.memberships.find((x) => x.buildingId === buildingId);
        return m ? [{ ...u, role: m.role, status: m.status }] : [];
      })
      .map((u) => {
        const p = perUser.find((x) => x._id === u.email);
        return { email: u.email, name: u.name, role: u.role, status: u.status, views: p?.views ?? 0, views7: p?.views7 ?? 0, activeDays: p?.days.length ?? 0, actions: actByUser.get(u.email) ?? 0, lastAt: p?.last ?? null, lastLoginAt: u.lastLoginAt, top: p ? mostUsed(p.top) : [] };
      })
      .sort((a, b) => b.views - a.views),
    heat,
    totals: { activeUsers: perUser.length, active7: perUser.filter((p) => p.views7 > 0).length, views: daily.reduce((s, d) => s + d.views, 0), actions: actDaily.reduce((s, d) => s + d.n, 0) },
  });
}
