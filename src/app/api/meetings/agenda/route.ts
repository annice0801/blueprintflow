import { dataScope } from "@/lib/auth";
import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import type { NextRequest } from "next/server";
import { roleOf, termAt, type Meeting, type Regulation, type Term, type Todo } from "@/lib/mgmt";
import { readCollection } from "@/lib/store";

const FONT = { ascii: "Times New Roman", eastAsia: "標楷體", hAnsi: "Times New Roman" };
const p = (text: string, opts: { bold?: boolean; size?: number; indent?: number; center?: boolean; after?: number } = {}) =>
  new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    indent: opts.indent ? { left: opts.indent * 240 } : undefined,
    spacing: { after: opts.after ?? 80, line: 340 },
    children: [new TextRun({ text, bold: opts.bold, size: (opts.size ?? 12) * 2, font: FONT })],
  });
const CN = "一二三四五六七八九十";
const roc = (d: string) => (d ? `${Number(d.slice(0, 4)) - 1911} 年 ${d.slice(5, 7)} 月 ${d.slice(8, 10)} 日` : "　年　月　日");

/** 依前次會議與待辦進度，產生下次管委會議程（Word） */
export async function GET(request: NextRequest) {
  const buildingId = dataScope(request);
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const terms = (await readCollection<Term>("terms")).filter((t) => t.buildingId === buildingId);
  const term = termAt(terms, "committee", today);
  const pm = termAt(terms, "property", today);
  const meetings = (await readCollection<Meeting>("meetings")).filter((m) => m.buildingId === buildingId).sort((a, b) => a.date.localeCompare(b.date));
  const regular = meetings.filter((m) => m.type === "管委會例會" && (!term?.start || m.date >= term.start));
  const last = [...meetings].reverse().find((m) => m.type === "管委會例會" || m.type === "管委會臨時會");
  const todos = (await readCollection<Todo>("todos")).filter((t) => t.buildingId === buildingId);
  // 前次會議代辦：未完成者全部列入；已完成者只列前次會議之後完成的
  const sinceLast = last?.date ?? "";
  const items = todos
    .filter((t) => (t.status !== "已完成" && t.status !== "暫緩") || (t.status === "已完成" && t.updatedAt.slice(0, 10) >= sinceLast && t.meetingId === last?.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const regs = (await readCollection<Regulation>("regulations")).filter((r) => r.buildingId === buildingId && (r.status === "討論中" || r.status === "草案"));
  const confirm = todos.filter((t) => t.status === "待確認");

  const name = (r: Parameters<typeof roleOf>[0]) => term?.members.find((m) => m.roleId === r)?.name ?? "";
  const members = term?.members.filter((m) => m.name && !m.end).map((m) => `${roleOf(m.roleId).label.replace(/ \d$/, "")} ${m.name}`) ?? [];
  const gm = pm?.members.find((m) => m.roleId === "gm")?.name;
  const progress = (t: Todo) => {
    const note = [...t.log].reverse().find((l) => !/^建立|^由會議/.test(l.text));
    return `辦理情形：${t.status}${note ? `（${note.at.slice(5, 10).replace("-", "/")} ${note.text}）` : ""}${t.due ? `；期限 ${t.due.slice(5).replace("-", "/")}` : ""}`;
  };

  const children: Paragraph[] = [
    p("藍圖社區", { center: true, size: 16, bold: true, after: 40 }),
    p(`${term?.name ?? "第一屆"} 管理委員會 第 ${regular.length + 1} 次例行會議 議程`, { center: true, size: 16, bold: true, after: 240 }),
    p(`壹、會議時間：${roc(date)}　　時　　分`),
    p(`貳、會議地點：${last?.place ?? ""}`),
    p(`參、主　　席：主任委員 ${name("chair")}`),
    p(`肆、出席人員：${members.join("、")}`),
    p(`伍、列席人員：${gm ? `社區經理 ${gm}` : ""}`),
    p("陸、會議記錄：", { after: 200 }),
    p("一、報到"),
    p("二、主席致詞"),
    p(`三、服務中心行政事務報告（前次會議代辦事項${last ? `，${roc(last.date)}` : ""}）：`, { after: 120 }),
    ...(items.length
      ? items.flatMap((t, i) => [
          p(`代辦事項(${i + 1})${t.title}　【${t.assignees.map((r) => roleOf(r).short).join("、")}】`, { indent: 1, after: 20 }),
          p(progress(t), { indent: 2, size: 11 }),
        ])
      : [p("（無）", { indent: 1 })]),
    p("捌、議題討論：", { bold: true, after: 120 }),
    ...[...regs.map((r) => `${r.title}（${r.version}，${r.status}）修訂討論。`), ...confirm.map((t) => `${t.title}（待確認）`)].flatMap((text, i) => [
      p(`【議題${CN[i] ?? i + 1}】${text}`, { indent: 1, after: 20 }),
      p("說明：", { indent: 2, after: 20 }),
      p("決議：", { indent: 2 }),
    ]),
    ...(regs.length + confirm.length === 0 ? [p("【議題一】", { indent: 1 }), p("說明：", { indent: 2 }), p("決議：", { indent: 2 })] : []),
    p("玖、臨時動議：", { bold: true }),
    p("拾、散會。", { bold: true, after: 240 }),
    p("會議主席：　　　　　　　　　　紀錄：", { after: 0 }),
  ];

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }] });
  const buf = await Packer.toBuffer(doc);
  const filename = `${term?.name ?? ""}管委會第${regular.length + 1}次例會議程.docx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
