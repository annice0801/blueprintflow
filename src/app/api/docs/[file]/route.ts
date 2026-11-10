import path from "path";
import type { Meeting, Regulation } from "@/lib/mgmt";
import { DOC_MIME, getFile, readCollection } from "@/lib/store";

/** 下載會議紀錄 / 規範原檔（以原始檔名下載） */
export async function GET(_req: Request, ctx: RouteContext<"/api/docs/[file]">) {
  const name = path.basename((await ctx.params).file);
  const type = DOC_MIME[path.extname(name).toLowerCase()];
  const stream = type && (await getFile("docs", name));
  if (!stream) return new Response("Not found", { status: 404 });
  const owners = [...(await readCollection<Meeting>("meetings")), ...(await readCollection<Regulation>("regulations"))];
  const original = owners.find((m) => m.file?.name === name)?.file?.original ?? name;
  return new Response(stream, { headers: { "Content-Type": type, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(original)}` } });
}
