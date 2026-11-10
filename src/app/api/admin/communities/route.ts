import { readUsers } from "@/lib/auth";
import { BUILDINGS } from "@/lib/buildings";
import type { CommunitySummary, Feedback } from "@/lib/perms";
import { aggregateDocs, readCollection } from "@/lib/store";

/** 系統擁有者：各社區比較（成員、待核准、活躍、意見回報） */
export async function GET() {
  const since7 = new Date(Date.now() - 7 * 86400000);
  const since30 = new Date(Date.now() - 30 * 86400000);
  const [users, feedback, act] = await Promise.all([
    readUsers(),
    readCollection<Feedback>("feedback"),
    aggregateDocs<{ _id: string; users7: string[]; views30: number }>("usage", [
      { $match: { at: { $gte: since30 } } },
      { $group: { _id: "$buildingId", views30: { $sum: 1 }, users7: { $addToSet: { $cond: [{ $gte: ["$at", since7] }, "$email", null] } } } },
    ]),
  ]);
  return Response.json(
    BUILDINGS.map((b) => {
      const ms = users.flatMap((u) => u.memberships.filter((m) => m.buildingId === b.id));
      const a = act.find((x) => x._id === b.id);
      return {
        id: b.id,
        name: b.name,
        members: ms.filter((m) => m.status === "active").length,
        pending: ms.filter((m) => m.status === "pending").length,
        admins: ms.filter((m) => m.status === "active" && m.role === "admin").length,
        active7: a ? a.users7.filter(Boolean).length : 0,
        views30: a?.views30 ?? 0,
        openFeedback: feedback.filter((f) => f.buildingId === b.id && (f.status === "新回報" || f.status === "處理中")).length,
      } satisfies CommunitySummary;
    }),
  );
}
