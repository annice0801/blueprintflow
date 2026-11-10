import type { NextRequest } from "next/server";
import { parseAttendance, parseMeetingMeta, parsePlanRef, parseRoles, requireBuildingId } from "@/lib/mgmt-forms";
import { roleOf, ROLE_IDS, termAt, TODO_STATUS, type Meeting, type RoleId, type Term, type Todo } from "@/lib/mgmt";
import { mutateCollection, readCollection } from "@/lib/store";
import { dateStr, errorResponse, jsonBody, maxLen, str, ValidationError } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const buildingId = request.nextUrl.searchParams.get("buildingId");
  const list = (await readCollection<Meeting>("meetings")).filter((m) => !buildingId || m.buildingId === buildingId);
  // 清單不回傳全文，節省流量
  return Response.json(list.map(({ text, ...m }) => ({ ...m, textLength: text.length })).sort((a, b) => b.date.localeCompare(a.date)));
}

/** 確認匯入：建立會議、勾選的地點與待辦事項，並可套用職務名單 */
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const meta = parseMeetingMeta(body);
    if (!meta.title) throw new ValidationError("請填寫會議名稱");
    const now = new Date().toISOString();
    const file = body.file as { name?: unknown; original?: unknown } | undefined;
    const meeting: Meeting = {
      id: crypto.randomUUID(),
      buildingId,
      title: meta.title,
      type: meta.type ?? "其他",
      date: meta.date ?? "",
      place: meta.place ?? "",
      ...(file && typeof file.name === "string" && { file: { name: file.name.replace(/[^\w.-]/g, ""), original: String(file.original ?? "").slice(0, 200) } }),
      text: typeof body.text === "string" ? body.text.slice(0, 200_000) : "",
      mentions: (Array.isArray(body.mentions) ? body.mentions : []).slice(0, 200).map((m: Record<string, unknown>) => ({
        ...parsePlanRef(m)!,
        id: crypto.randomUUID(),
        snippet: maxLen(str(m, "snippet"), 600, "原文片段") ?? "",
      })),
      attendance: parseAttendance(body.attendance) ?? [],
      createdAt: now,
      updatedAt: now,
    };
    const todos: Todo[] = (Array.isArray(body.todos) ? body.todos : []).slice(0, 200).map((t: Record<string, unknown>) => {
      const title = maxLen(str(t, "title"), 120, "待辦標題");
      if (!title) throw new ValidationError("待辦事項標題不可空白");
      const status = TODO_STATUS.includes(str(t, "status") as Todo["status"]) ? (str(t, "status") as Todo["status"]) : "未開始";
      const loc = parsePlanRef(t.location ?? undefined);
      return {
        id: crypto.randomUUID(),
        buildingId,
        title,
        description: maxLen(str(t, "description"), 4000, "待辦說明") ?? "",
        assignees: parseRoles(t.assignees)?.length ? parseRoles(t.assignees)! : ["gm"],
        status,
        priority: "中",
        start: meeting.date,
        due: dateStr(str(t, "due"), "期限") ?? "",
        meetingId: meeting.id,
        ...(loc && { location: loc }),
        log: [{ at: now, text: `由會議「${meeting.title}」匯入` }],
        createdAt: now,
        updatedAt: now,
      };
    });
    const roleNames = (Array.isArray(body.roleNames) ? body.roleNames : []).filter(
      (r: Record<string, unknown>) => ROLE_IDS.includes(r.id as RoleId) && typeof r.name === "string" && r.name.trim(),
    ) as { id: RoleId; name: string }[];

    await mutateCollection<Meeting, void>("meetings", (all) => void all.push(meeting));
    if (todos.length) await mutateCollection<Todo, void>("todos", (all) => void all.push(...todos));
    // 職務名單寫入當屆（管委會 / 物業）；找不到該日期的屆次就新建
    const termName = typeof body.termName === "string" ? body.termName.trim().slice(0, 60) : "";
    let touched: Term[] = [];
    if (roleNames.length)
      touched = await mutateCollection<Term, Term[]>("terms", (all) => {
        const mine = all.filter((t) => t.buildingId === buildingId);
        const out: Term[] = [];
        for (const kind of ["committee", "property"] as const) {
          const names = roleNames.filter((r) => (roleOf(r.id).group === "管委會") === (kind === "committee"));
          if (!names.length) continue;
          let term = (kind === "committee" && termName && mine.find((t) => t.kind === kind && t.name === termName)) || termAt(mine, kind, meeting.date || now.slice(0, 10));
          if (!term) {
            term = {
              id: crypto.randomUUID(),
              buildingId,
              kind,
              name: kind === "committee" ? termName || "第一屆" : "物業（由會議紀錄帶入）",
              start: meeting.date,
              end: "",
              note: `由會議「${meeting.title}」建立`,
              members: [],
              createdAt: now,
              updatedAt: now,
            };
            all.push(term);
          }
          for (const { id, name } of names) {
            const m = term.members.find((x) => x.roleId === id);
            if (m) m.name = name.trim().slice(0, 40);
            else term.members.push({ id: crypto.randomUUID(), roleId: id, name: name.trim().slice(0, 40), phone: "", email: "", note: "", start: "", end: "" });
          }
          term.updatedAt = now;
          out.push(term);
        }
        return out;
      });
    return Response.json({ meeting, todos, terms: touched }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
