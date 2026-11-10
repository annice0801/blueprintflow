import path from "path";
import { getFile, MIME } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[file]">) {
  const name = path.basename((await ctx.params).file);
  const type = MIME[path.extname(name).toLowerCase()];
  const stream = type && (await getFile("uploads", name));
  if (!stream) return new Response("Not found", { status: 404 });
  return new Response(stream, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=31536000, immutable" } });
}
