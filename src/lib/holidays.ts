import "server-only";
import { mutateCollection, readCollection } from "./store";

/*
 * 國定假日與補班：來源為行政院人事行政總處「政府行政機關辦公日曆表」（開放資料，經 TaiwanCalendar 整理為 JSON）。
 * 每年第一次查詢時下載並存到 MongoDB（holidays），之後讀資料庫；連不上時 2026 年用內建資料。
 */

export type Holiday = { date: string; name: string; off: boolean }; // off=false 為補班日

const SOURCE = (y: number) => `https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${y}.json`;

const BUILTIN: Record<number, [string, string][]> = {
  2026: [
    ["0101", "開國紀念日"], ["0215", "小年夜"], ["0216", "農曆除夕"], ["0217", "春節"], ["0218", "春節"], ["0219", "春節"], ["0220", "補假"],
    ["0227", "補假"], ["0228", "和平紀念日"], ["0403", "補假"], ["0404", "兒童節"], ["0405", "清明節"], ["0406", "補假"], ["0501", "勞動節"],
    ["0619", "端午節"], ["0925", "中秋節"], ["0928", "教師節"], ["1009", "補假"], ["1010", "國慶日"], ["1025", "臺灣光復暨金門古寧頭大捷紀念日"],
    ["1026", "補假"], ["1225", "行憲紀念日"],
  ],
};

type Raw = { date: string; week: string; isHoliday: boolean; description: string };
const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

function fromRaw(rows: Raw[]): Holiday[] {
  const out: Holiday[] = [];
  for (const r of rows) {
    const weekend = r.week === "六" || r.week === "日";
    if (r.isHoliday && r.description) out.push({ date: iso(r.date), name: r.description.replace("孔子誕辰紀念日/", ""), off: true });
    else if (!r.isHoliday && weekend) out.push({ date: iso(r.date), name: r.description || "補行上班", off: false });
  }
  return out;
}

export async function holidaysOf(year: number): Promise<{ year: number; items: Holiday[]; source: "cache" | "remote" | "builtin" | "none" }> {
  const cached = (await readCollection<{ id: string; items: Holiday[] }>("holidays")).find((h) => h.id === String(year));
  if (cached) return { year, items: cached.items, source: "cache" };
  try {
    const res = await fetch(SOURCE(year), { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const items = fromRaw((await res.json()) as Raw[]);
      if (items.length) {
        await mutateCollection<{ id: string; items: Holiday[] }, void>("holidays", (all) => void all.push({ id: String(year), items }));
        return { year, items, source: "remote" };
      }
    }
  } catch {}
  const b = BUILTIN[year];
  return b ? { year, items: b.map(([d, name]) => ({ date: `${year}-${d.slice(0, 2)}-${d.slice(2)}`, name, off: true })), source: "builtin" } : { year, items: [], source: "none" };
}
