import { getUser, requestUser } from "@/lib/auth";
import { countDocs, type Collection } from "@/lib/store";

const COLLECTIONS: [Collection, string][] = [
  ["users", "帳號"], ["todos", "待辦"], ["meetings", "會議紀錄"], ["events", "情境事件"], ["inspections", "年度檢測設定"], ["vendors", "廠商"], ["terms", "屆次"],
  ["regulations", "規範條例"], ["announcements", "公告"], ["reservations", "預約"], ["visitors", "訪客"], ["fieldlogs", "值班日誌"], ["shifts", "班表"],
  ["issues", "問題回報"], ["plants", "植栽"], ["gate-logs", "車道紀錄"], ["residents", "住戶名冊"], ["feedback", "意見回報"], ["usage", "使用紀錄"], ["audit", "操作紀錄"],
];

/** 系統狀態：本社區各資料筆數；必要設定是否齊全（只回報有無，不回傳值，僅系統擁有者可看） */
export async function GET(request: Request) {
  const { email, buildingId } = requestUser(request);
  const filterOf = (c: Collection) => (c === "users" ? { "memberships.buildingId": buildingId } : { buildingId });
  const counts = await Promise.all(COLLECTIONS.map(async ([c, label]) => ({ id: c, label, count: await countDocs(c, filterOf(c)).catch(() => -1) })));
  if (!(await getUser(email ?? ""))?.superAdmin) return Response.json({ counts, env: null, blobAccess: null, runtime: null });
  const env = (["MONGODB_URI", "BLOB_READ_WRITE_TOKEN", "GOOGLE_CLIENT_ID", "SESSION_SECRET", "OWNER_EMAILS"] as const).map((k) => ({ key: k, set: !!process.env[k] }));
  return Response.json({
    counts,
    env,
    blobAccess: process.env.BLOB_ACCESS === "private" ? "private" : "public",
    runtime: { node: process.version, vercel: !!process.env.VERCEL, region: process.env.VERCEL_REGION ?? "本機", commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "" },
  });
}
