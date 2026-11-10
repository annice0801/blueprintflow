import "server-only";
import { plansOf } from "./inspection-forms";
import { dueState, nextDue } from "./inspections";
import { isOverdue, type Meeting, type Todo } from "./mgmt";
import { addDays, planDates, playbookOf, type CommunityEvent } from "./playbooks";
import { GATE_PARTS, GATES, partState, type GateLog } from "./records";
import { mutateCollection, readCollection } from "./store";
import { ValidationError } from "./validate";

/** 開會前自動彙整的待討論事項 */
export async function discussionItems(buildingId: string, today: string) {
  const todos = (await readCollection<Todo>("todos")).filter((t) => t.buildingId === buildingId);
  const lines: string[] = [];
  const pending = todos.filter((t) => t.status === "待確認");
  const overdue = todos.filter((t) => isOverdue(t, today));
  const meetings = (await readCollection<Meeting>("meetings")).filter((m) => m.buildingId === buildingId && m.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const last = meetings[0];
  const carry = last ? todos.filter((t) => t.meetingId === last.id && t.status !== "已完成") : [];
  if (pending.length) lines.push("【待管委會確認】", ...pending.map((t) => `・${t.title}`));
  if (overdue.length) lines.push("【逾期待辦】", ...overdue.map((t) => `・${t.title}（期限 ${t.due}）`));
  if (carry.length) lines.push(`【上次會議（${last!.title}）未結案】`, ...carry.filter((t) => !pending.includes(t) && !overdue.includes(t)).map((t) => `・${t.title}（${t.status}）`));
  const insp = (await plansOf(buildingId)).filter((p) => {
    const due = nextDue(p);
    return p.enabled && due && (dueState(p, today) === "逾期" || due <= addDays(today, 60));
  });
  if (insp.length) lines.push("【年度檢測即將到期】", ...insp.map((p) => `・${p.name}（期限 ${nextDue(p)}）`));
  const logs = (await readCollection<GateLog>("gate-logs")).filter((l) => l.buildingId === buildingId);
  const faults = GATES.flatMap((g) => GATE_PARTS[g].filter((part) => partState(logs, g, part).bad || partState(logs, g, part).fixing).map((part) => `・${g}道閘 ${part}（${partState(logs, g, part).last!.action}）`));
  if (faults.length) lines.push("【車道設備異常】", ...faults);
  return lines.length ? lines.join("\n") : "目前沒有自動彙整到的事項";
}

export async function createEvent(input: { buildingId: string; playbookId: string; name: string; date: string; note: string; keys?: string[]; meetingId?: string }) {
  const pb = playbookOf(input.playbookId);
  if (!pb) throw new ValidationError("找不到情境範本");
  const steps = pb.steps.filter((s) => (input.keys ? input.keys.includes(s.key) : !s.optional));
  if (!steps.length) throw new ValidationError("請至少勾選一項待辦");
  const dates = planDates(pb, input.date, steps.map((s) => s.key));
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const eventId = crypto.randomUUID();
  const label = input.name || pb.name;
  const extra = pb.id === "meeting" ? await discussionItems(input.buildingId, today) : "";
  const ids = new Map(steps.map((s) => [s.key, crypto.randomUUID()]));
  const todos: Todo[] = steps.map((s) => {
    const planned = dates.get(s.key)!;
    const after = s.after && ids.get(s.after);
    // 基準日太近、算出來已過期的步驟 → 排到今天
    const due = !after && planned < today ? today : planned;
    const start = after ? due : s.offset < 0 ? addDays(due, -2) : due;
    return {
      id: ids.get(s.key)!,
      buildingId: input.buildingId,
      title: `${pb.icon} ${label}｜${s.title}`,
      description: [s.description, s.key === "collect" ? extra : "", input.note].filter(Boolean).join("\n\n"),
      assignees: s.assignees,
      status: "未開始",
      priority: pb.id === "typhoon" || pb.id === "quake" ? "高" : "中",
      start: start < today && !after ? today : start,
      due,
      ...(input.meetingId && { meetingId: input.meetingId }),
      eventId,
      ...(after && { after, afterDays: s.offset }),
      ...(s.link && { link: s.link }),
      log: [{ at: now, text: `由情境「${pb.name}」建立${after ? "（前一步完成後自動排程）" : ""}` }],
      createdAt: now,
      updatedAt: now,
    };
  });
  const event: CommunityEvent = { id: eventId, buildingId: input.buildingId, playbookId: pb.id, name: label, date: input.date, note: input.note, ...(input.meetingId && { meetingId: input.meetingId }), todoIds: todos.map((t) => t.id), createdAt: now };
  await mutateCollection<Todo, void>("todos", (all) => void all.push(...todos));
  await mutateCollection<CommunityEvent, void>("events", (all) => void all.push(event));
  return { event, todos };
}

/** 待辦完成後：等待它的下一步自動開始，期限 = 今天 + 間隔天數 */
export function releaseDependents(all: Todo[], doneId: string, today: string, now: string) {
  const out: Todo[] = [];
  for (const t of all)
    if (t.after === doneId && t.status === "未開始") {
      t.start = today;
      t.due = addDays(today, t.afterDays ?? 7);
      t.log.push({ at: now, text: `前一步已完成，自動排程：期限 ${t.due}` });
      t.updatedAt = now;
      out.push(t);
    }
  return out;
}
