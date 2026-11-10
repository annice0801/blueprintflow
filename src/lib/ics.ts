// iCalendar（.ics）：單筆「加入行事曆」下載與整個社區的訂閱來源共用

export type CalEvent = {
  uid: string;
  title: string;
  start: string; // YYYY-MM-DD（整天）或 YYYY-MM-DDTHH:mm（台北時間）
  end?: string;
  description?: string;
  location?: string;
  alarmMinutes?: number; // 提前提醒
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
const fold = (line: string) => {
  // RFC 5545：每行 75 字元內，續行以空白開頭
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 73) {
      out.push(cur);
      cur = " ";
    }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
};

function dt(v: string, key: "DTSTART" | "DTEND") {
  if (v.length <= 10) return `${key};VALUE=DATE:${v.replaceAll("-", "")}`;
  return `${key};TZID=Asia/Taipei:${v.replace(/[-:]/g, "").slice(0, 13)}00`;
}

function nextDay(d: string) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}

export function buildIcs(events: CalEvent[], name = "藍圖社區") {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Blueprintflow//Community//ZH-TW",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(name)}`,
    "X-WR-TIMEZONE:Asia/Taipei",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Taipei",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:CST",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  for (const e of events) {
    if (!e.start) continue;
    const end = e.end || (e.start.length <= 10 ? nextDay(e.start) : e.start);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@blueprintflow`,
      `DTSTAMP:${stamp}`,
      dt(e.start, "DTSTART"),
      dt(e.start.length <= 10 && end.length <= 10 && end === e.start ? nextDay(end) : end, "DTEND"),
      fold(`SUMMARY:${esc(e.title)}`),
    );
    if (e.description) lines.push(fold(`DESCRIPTION:${esc(e.description)}`));
    if (e.location) lines.push(fold(`LOCATION:${esc(e.location)}`));
    if (e.alarmMinutes !== undefined)
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", fold(`DESCRIPTION:${esc(e.title)}`), `TRIGGER:-PT${e.alarmMinutes}M`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** 瀏覽器端：下載單筆 .ics，開啟後即可加入 Google / Apple 行事曆 */
export function downloadIcs(event: CalEvent, filename = "event.ics") {
  const blob = new Blob([buildIcs([event])], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Google 行事曆「新增活動」網址（免下載，直接開啟） */
export function googleCalendarUrl(e: CalEvent) {
  const fmt = (v: string) => (v.length <= 10 ? v.replaceAll("-", "") : v.replace(/[-:]/g, "").slice(0, 13) + "00");
  const end = e.end || (e.start.length <= 10 ? nextDay(e.start) : e.start);
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${fmt(e.start)}/${fmt(end)}`, details: e.description ?? "", location: e.location ?? "", ctz: "Asia/Taipei" });
  return `https://calendar.google.com/calendar/render?${q}`;
}
