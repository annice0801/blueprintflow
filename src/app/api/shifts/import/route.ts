import { getSettings } from "@/lib/field-server";
import { SHIFT_ROLES, type Shift } from "@/lib/field";
import { termAt, type Term } from "@/lib/mgmt";
import { requireBuildingId } from "@/lib/mgmt-forms";
import { mutateCollection } from "@/lib/store";
import { errorResponse, jsonBody, ValidationError } from "@/lib/validate";

type Row = { name: string; roleId: Shift["roleId"]; cells: string[] };

/**
 * 匯入整月班表：rows 的每格代號依設定換算時段（休假不建立）。
 * replace：先刪除這些人當月原有班；addMembers：不在當期物業名單的人自動加入。
 */
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const buildingId = requireBuildingId(body);
    const year = Number(body.year);
    const month = Number(body.month);
    if (!(year > 2000 && month >= 1 && month <= 12)) throw new ValidationError("年月不正確");
    const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 200) as Row[];
    if (!rows.length) throw new ValidationError("沒有可匯入的人員");
    const map = (body.codeMap ?? {}) as Record<string, string>; // 未知代號 → 既有代號
    const settings = await getSettings(buildingId);
    const codes = new Map(settings.shiftCodes.map((c) => [c.code, c]));
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const now = new Date().toISOString();
    const source = String(body.source ?? "匯入").slice(0, 120);
    const skipped = new Set<string>();
    const created: Shift[] = [];

    for (const r of rows) {
      const name = String(r.name ?? "").trim().slice(0, 40);
      const roleId = SHIFT_ROLES.includes(r.roleId) ? r.roleId : "guard";
      if (!name) continue;
      (r.cells ?? []).forEach((raw, i) => {
        const code = map[raw] ?? raw;
        if (!code) return;
        const def = codes.get(code);
        if (!def) return void skipped.add(raw);
        if (def.off) return;
        created.push({ id: crypto.randomUUID(), buildingId, date: `${prefix}-${String(i + 1).padStart(2, "0")}`, name, roleId, code, start: def.start, end: def.end, post: "", note: "", source, updatedAt: now });
      });
    }
    const names = new Set(rows.map((r) => String(r.name).trim()));
    await mutateCollection<Shift, void>("shifts", (all) => {
      if (body.replace !== false) for (let i = all.length - 1; i >= 0; i--) if (all[i].buildingId === buildingId && all[i].date.startsWith(prefix) && names.has(all[i].name)) all.splice(i, 1);
      all.push(...created);
    });

    let added = 0;
    let term: Term | undefined;
    if (body.addMembers) {
      term = await mutateCollection<Term, Term>("terms", (all) => {
        let t = termAt(all.filter((x) => x.buildingId === buildingId), "property", `${prefix}-01`);
        if (!t) {
          t = { id: crypto.randomUUID(), buildingId, kind: "property", name: "現任物業團隊", start: `${prefix}-01`, end: "", note: "由班表匯入建立，請連結物業公司", members: [], createdAt: now, updatedAt: now };
          all.push(t);
        }
        for (const r of rows) {
          const name = String(r.name).trim();
          if (!name || t.members.some((m) => m.name === name)) continue;
          t.members.push({ id: crypto.randomUUID(), roleId: SHIFT_ROLES.includes(r.roleId) ? r.roleId : "guard", name, phone: "", email: "", note: "", start: "", end: "" });
          added++;
        }
        t.updatedAt = now;
        return t;
      });
    }
    return Response.json({ created: created.length, skipped: [...skipped], added, term }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
