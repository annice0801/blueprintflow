"use client";

import { useEffect, useMemo, useState } from "react";
import { residentUnits, unitLabel, unitPing, type Building } from "@/lib/buildings";
import {
  CHANGE_TYPES,
  emptyHousehold,
  monthlyFee,
  OCCUPANCY,
  PAYERS,
  payerOf,
  SPACE_RIGHTS,
  VEHICLE_TYPES,
  type ChangeType,
  type FeeBill,
  type FeeSettings,
  type Household,
  type Occupancy,
  type ParkingSpace,
  type Person,
  type Vehicle,
} from "@/lib/households";
import { useCan } from "../auth/AuthProvider";
import { api, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, Select } from "../ui";

const OCC_TONE: Record<Occupancy, string> = { 自住: "text-emerald-300", 出租: "text-cyan-300", 空置: "text-slate-500" };
const uid = () => crypto.randomUUID();
const newPerson = (): Person => ({ id: uid(), name: "", phone: "", email: "", since: "", note: "" });
const today = () => new Date().toISOString().slice(0, 10);
const thisPeriod = () => today().slice(0, 7);
const unitType = (unitId: string) => unitId.split("-").pop()?.replace(/^B/, "A") ?? "";

/** 戶籍名冊：每戶所有權人、承租人、車輛、車位、管理費狀況；異動時同步調整 */
export default function RosterPanel({ building }: { building: Building }) {
  const can = useCan();
  const units = useMemo(() => residentUnits(building), [building]);
  const [rows, setRows] = useState<Map<string, Household>>(new Map());
  const [bills, setBills] = useState<FeeBill[]>([]);
  const [fee, setFee] = useState<FeeSettings | null>(null);
  const [error, setError] = useState("");
  const [tower, setTower] = useState<"全部" | "A" | "B" | "S">("全部");
  const [occ, setOcc] = useState<"" | Occupancy>("");
  const [onlyArrears, setOnlyArrears] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api<Household[]>("/api/residents").then(
      (list) => setRows(new Map(list.map((h) => [h.id, h]))),
      (e) => setError((e as Error).message),
    );
    if (can("fees")) {
      api<FeeBill[]>("/api/fees").then(setBills, () => {});
      api<FeeSettings>("/api/fees/settings").then(setFee, () => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arrears = useMemo(() => {
    const m = new Map<string, { months: number; amount: number }>();
    for (const b of bills)
      if (b.status === "未繳" || b.status === "部分繳") {
        const x = m.get(b.unitId) ?? { months: 0, amount: 0 };
        m.set(b.unitId, { months: x.months + 1, amount: x.amount + b.amount - b.paid });
      }
    return m;
  }, [bills]);
  const billNow = useMemo(() => new Map(bills.filter((b) => b.period === thisPeriod()).map((b) => [b.unitId, b])), [bills]);

  const needle = q.trim().toLowerCase();
  const shown = units.filter((u) => {
    const h = rows.get(u.id);
    if (tower !== "全部" && u.tower !== tower) return false;
    if (occ && (h?.occupancy ?? "自住") !== occ) return false;
    if (onlyArrears && !arrears.has(u.id)) return false;
    if (!needle) return true;
    const hay = [
      unitLabel(u.id),
      u.unit,
      ...(h ? [...h.owners, ...h.tenants].flatMap((p) => [p.name, p.phone, p.email]) : []),
      ...(h?.vehicles.map((v) => v.plate) ?? []),
      ...(h?.parking.map((p) => p.number) ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
  const filled = units.filter((u) => rows.get(u.id)?.owners.length).length;
  const count = (h: Household | undefined, t: Vehicle["type"]) => h?.parking.filter((p) => p.type === t).length ?? 0;

  if (error) return <ErrorText>{error}</ErrorText>;
  const cur = open ? (rows.get(open) ?? emptyHousehold(open, building.id)) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex overflow-hidden rounded-md border border-cyan-500/40">
          {(["全部", "A", "B", "S"] as const).map((t) => (
            <button key={t} onClick={() => setTower(t)} className={`px-3 py-1.5 ${tower === t ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400"}`}>
              {t === "全部" ? "全部" : t === "S" ? "1F 店鋪" : `${t} 棟`}
            </button>
          ))}
        </div>
        <select className={`${INPUT} max-w-28 py-1.5 text-xs`} value={occ} onChange={(e) => setOcc(e.target.value as Occupancy | "")} aria-label="居住狀態">
          <option value="">全部狀態</option>
          {OCCUPANCY.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        {can("fees") && (
          <label className="flex items-center gap-1 text-slate-300">
            <input type="checkbox" checked={onlyArrears} onChange={(e) => setOnlyArrears(e.target.checked)} className="accent-rose-400" />
            只看欠繳
          </label>
        )}
        <input className={`${INPUT} max-w-64 py-1.5 text-xs`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋戶別、姓名、電話、車號、車位" />
        <div className="flex-1" />
        <span className="text-slate-400">
          已登錄 {filled} / {units.length} 戶 · 出租 {[...rows.values()].filter((h) => h.occupancy === "出租").length} 戶{can("fees") && ` · 欠繳 ${arrears.size} 戶`}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-cyan-500/20">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="sticky top-0 z-10 bg-[#06142a] text-left text-xs text-cyan-300">
            <tr className="border-b border-cyan-500/30">
              <th className="px-3 py-2">戶別</th>
              <th className="px-3 py-2">戶型</th>
              <th className="px-3 py-2">狀態</th>
              <th className="px-3 py-2">所有權人</th>
              <th className="px-3 py-2">承租人</th>
              <th className="px-3 py-2">車位 汽 / 機 / 腳</th>
              <th className="px-3 py-2">車號</th>
              {can("fees") && <th className="px-3 py-2">本月管理費</th>}
              {can("fees") && <th className="px-3 py-2">欠繳</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => {
              const h = rows.get(u.id);
              const b = billNow.get(u.id);
              const ar = arrears.get(u.id);
              return (
                <tr key={u.id} onClick={() => setOpen(u.id)} className="cursor-pointer border-b border-cyan-500/10 hover:bg-cyan-400/5">
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-cyan-100">{unitLabel(u.id)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs text-slate-400">{u.tower === "S" ? "店鋪" : `${unitType(u.id)} · ${unitPing(u.id)} 坪`}</td>
                  <td className={`px-3 py-1.5 text-xs ${OCC_TONE[h?.occupancy ?? "自住"]}`}>{h ? h.occupancy : "—"}</td>
                  <td className="px-3 py-1.5">{h?.owners.map((p) => p.name).join("、") || <span className="text-slate-600">—</span>}</td>
                  <td className="px-3 py-1.5">{h?.tenants.map((p) => p.name).join("、") || <span className="text-slate-600">—</span>}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-slate-300">
                    {count(h, "汽車")} / {count(h, "機車")} / {count(h, "腳踏車")}
                  </td>
                  <td className="max-w-48 truncate px-3 py-1.5 font-mono text-xs text-slate-300">{h?.vehicles.map((v) => v.plate).join("、") || "—"}</td>
                  {can("fees") && (
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs">
                      {b ? (
                        <span className={b.status === "已繳" || b.status === "免繳" ? "text-emerald-300" : "text-amber-300"}>
                          {b.status} · ${b.amount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-500">{fee ? `未開單（$${monthlyFee(u.id, h, fee).toLocaleString()}）` : "—"}</span>
                      )}
                    </td>
                  )}
                  {can("fees") && (
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs">
                      {ar ? (
                        <span className="text-rose-300">
                          {ar.months} 期 · ${ar.amount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {cur && (
        <HouseholdDialog
          key={cur.id}
          h={cur}
          fee={fee}
          bills={bills.filter((b) => b.unitId === cur.id)}
          canEdit={can("residents", "edit")}
          onClose={() => setOpen(null)}
          onSaved={(h, refreshBills) => {
            setRows((m) => new Map(m).set(h.id, h));
            if (refreshBills && can("fees")) api<FeeBill[]>("/api/fees").then(setBills, () => {});
          }}
        />
      )}
    </div>
  );
}

function PeopleEditor({ label, list, onChange, disabled }: { label: string; list: Person[]; onChange: (l: Person[]) => void; disabled: boolean }) {
  const patch = (i: number, p: Partial<Person>) => onChange(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <section className="space-y-1.5">
      <div className="flex items-center">
        <h4 className="text-sm font-semibold text-cyan-100">{label}</h4>
        {!disabled && (
          <button type="button" onClick={() => onChange([...list, newPerson()])} className="ml-auto text-xs text-cyan-300 hover:underline">
            ＋ 新增
          </button>
        )}
      </div>
      {list.length === 0 && <p className="text-xs text-slate-500">無</p>}
      {list.map((p, i) => (
        <div key={p.id} className="grid grid-cols-[1fr_1fr_1.3fr_8.5rem_auto] gap-1.5">
          <input disabled={disabled} className={`${INPUT} py-1 text-xs`} value={p.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="姓名" aria-label="姓名" />
          <input disabled={disabled} className={`${INPUT} py-1 text-xs`} value={p.phone} onChange={(e) => patch(i, { phone: e.target.value })} placeholder="電話" aria-label="電話" />
          <input disabled={disabled} className={`${INPUT} py-1 text-xs`} value={p.email} onChange={(e) => patch(i, { email: e.target.value })} placeholder="Email（可開通帳號）" aria-label="Email" />
          <input
            disabled={disabled}
            type="date"
            className={`${INPUT} py-1 text-xs`}
            value={p.since}
            onChange={(e) => patch(i, { since: e.target.value })}
            aria-label="起始日"
            title="起始日（過戶 / 入住）"
          />
          {!disabled && (
            <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="px-1 text-slate-500 hover:text-rose-300" aria-label="移除">
              ✕
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

function HouseholdDialog({
  h,
  fee,
  bills,
  canEdit,
  onClose,
  onSaved,
}: {
  h: Household;
  fee: FeeSettings | null;
  bills: FeeBill[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (h: Household, refreshBills?: boolean) => void;
}) {
  const [tab, setTab] = useState<"people" | "vehicles" | "fees" | "history">("people");
  const [f, setF] = useState(h);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [change, setChange] = useState(false);
  const people = [...f.owners.map((p) => ({ ...p, role: "所有權人" })), ...f.tenants.map((p) => ({ ...p, role: "承租人" }))];

  async function save() {
    setBusy(true);
    setError("");
    try {
      const saved = await api<Household>(`/api/residents/${h.id}`, {
        method: "PUT",
        json: { occupancy: f.occupancy, owners: f.owners, tenants: f.tenants, vehicles: f.vehicles, parking: f.parking, payer: f.payer, feeOverride: f.feeOverride ?? null, note: f.note },
      });
      onSaved(saved, true);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const { name: payerName } = payerOf(f);
  const vPatch = (i: number, p: Partial<Vehicle>) => setF({ ...f, vehicles: f.vehicles.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const sPatch = (i: number, p: Partial<ParkingSpace>) => setF({ ...f, parking: f.parking.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const unpaid = bills.filter((b) => b.status === "未繳" || b.status === "部分繳");

  if (change)
    return (
      <ChangeDialog
        h={f}
        onClose={() => setChange(false)}
        onDone={(nh) => {
          onSaved(nh, true);
          setF(nh);
          setChange(false);
          setTab("history");
        }}
      />
    );

  return (
    <Modal
      wide
      title={`${unitLabel(h.id)}`}
      subtitle={`${h.id.startsWith("S-") ? "店鋪" : `${unitType(h.id)} 型 · 權狀 ${unitPing(h.id)} 坪`}${fee ? ` · 每月管理費 $${monthlyFee(h.id, f, fee).toLocaleString()}` : ""}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {canEdit && (
            <button type="button" onClick={() => setChange(true)} className={BTN_OUTLINE}>
              🔁 住戶異動（過戶 / 換租 / 退租）
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            關閉
          </button>
          {canEdit && (
            <button type="submit" disabled={busy} className={BTN_PRIMARY}>
              {busy ? "儲存中…" : "儲存"}
            </button>
          )}
        </>
      }
    >
      <div className="flex gap-1 text-xs">
        {(
          [
            ["people", "住戶"],
            ["vehicles", `車輛與車位（${f.vehicles.length} / ${f.parking.length}）`],
            ["fees", `管理費${unpaid.length ? `（欠 ${unpaid.length} 期）` : ""}`],
            ["history", `異動紀錄（${f.history.length}）`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-md px-2.5 py-1 ${tab === k ? "bg-cyan-400/20 text-cyan-50" : "text-slate-400 hover:text-cyan-200"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "people" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="居住狀態">
              <select disabled={!canEdit} className={INPUT} value={f.occupancy} onChange={(e) => setF({ ...f, occupancy: e.target.value as Occupancy })}>
                {OCCUPANCY.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="管理費繳費人">
              <select disabled={!canEdit} className={INPUT} value={f.payer} onChange={(e) => setF({ ...f, payer: e.target.value as Household["payer"] })}>
                {PAYERS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="特殊管理費（空白＝自動計算）">
              <input
                disabled={!canEdit}
                type="number"
                min={0}
                className={INPUT}
                value={f.feeOverride ?? ""}
                onChange={(e) => setF({ ...f, feeOverride: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </Field>
          </div>
          <PeopleEditor label="所有權人" list={f.owners} onChange={(owners) => setF({ ...f, owners })} disabled={!canEdit} />
          <PeopleEditor label="承租人" list={f.tenants} onChange={(tenants) => setF({ ...f, tenants })} disabled={!canEdit} />
          <p className="text-[11px] text-slate-500">目前繳費人：{payerName || "（未填）"}。修改繳費人後，本月起的未繳帳單會同步改為新繳費人。人員更換請用「住戶異動」，舊住戶會保留在異動紀錄。</p>
          <Field label="備註">
            <textarea disabled={!canEdit} rows={2} className={INPUT} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </Field>
        </div>
      )}

      {tab === "vehicles" && (
        <div className="space-y-4">
          <section className="space-y-1.5">
            <div className="flex items-center">
              <h4 className="text-sm font-semibold text-cyan-100">車位（屬於戶別，過戶時跟著戶別）</h4>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setF({ ...f, parking: [...f.parking, { id: uid(), type: "汽車", number: "", right: "產權", note: "" }] })}
                  className="ml-auto text-xs text-cyan-300 hover:underline"
                >
                  ＋ 新增車位
                </button>
              )}
            </div>
            {f.parking.length === 0 && <p className="text-xs text-slate-500">無</p>}
            {f.parking.map((p, i) => (
              <div key={p.id} className="grid grid-cols-[6rem_1fr_7rem_1.5fr_auto] gap-1.5">
                <select disabled={!canEdit} className={`${INPUT} py-1 text-xs`} value={p.type} onChange={(e) => sPatch(i, { type: e.target.value as ParkingSpace["type"] })} aria-label="車位類型">
                  {VEHICLE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input
                  disabled={!canEdit}
                  className={`${INPUT} py-1 text-xs`}
                  value={p.number}
                  onChange={(e) => sPatch(i, { number: e.target.value })}
                  placeholder="車位編號，例：B2-231"
                  aria-label="車位編號"
                />
                <select disabled={!canEdit} className={`${INPUT} py-1 text-xs`} value={p.right} onChange={(e) => sPatch(i, { right: e.target.value as ParkingSpace["right"] })} aria-label="權屬">
                  {SPACE_RIGHTS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input disabled={!canEdit} className={`${INPUT} py-1 text-xs`} value={p.note} onChange={(e) => sPatch(i, { note: e.target.value })} placeholder="備註" aria-label="備註" />
                {canEdit && (
                  <button type="button" onClick={() => setF({ ...f, parking: f.parking.filter((_, j) => j !== i) })} className="px-1 text-slate-500 hover:text-rose-300" aria-label="移除">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </section>
          <section className="space-y-1.5">
            <div className="flex items-center">
              <h4 className="text-sm font-semibold text-cyan-100">車輛（屬於住戶，換人時跟著人走）</h4>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setF({ ...f, vehicles: [...f.vehicles, { id: uid(), type: "汽車", plate: "", personId: people[0]?.id ?? "", note: "" }] })}
                  className="ml-auto text-xs text-cyan-300 hover:underline"
                >
                  ＋ 新增車輛
                </button>
              )}
            </div>
            {f.vehicles.length === 0 && <p className="text-xs text-slate-500">無</p>}
            {f.vehicles.map((v, i) => (
              <div key={v.id} className="grid grid-cols-[6rem_1fr_1.3fr_1.3fr_auto] gap-1.5">
                <select disabled={!canEdit} className={`${INPUT} py-1 text-xs`} value={v.type} onChange={(e) => vPatch(i, { type: e.target.value as Vehicle["type"] })} aria-label="車種">
                  {VEHICLE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input
                  disabled={!canEdit}
                  className={`${INPUT} py-1 font-mono text-xs uppercase`}
                  value={v.plate}
                  onChange={(e) => vPatch(i, { plate: e.target.value })}
                  placeholder="車號 / 腳踏車編號"
                  aria-label="車號"
                />
                <select disabled={!canEdit} className={`${INPUT} py-1 text-xs`} value={v.personId} onChange={(e) => vPatch(i, { personId: e.target.value })} aria-label="所屬住戶">
                  <option value="">（戶共用）</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.role} {p.name || "（未填）"}
                    </option>
                  ))}
                </select>
                <input
                  disabled={!canEdit}
                  className={`${INPUT} py-1 text-xs`}
                  value={v.note}
                  onChange={(e) => vPatch(i, { note: e.target.value })}
                  placeholder="廠牌 / 顏色 / eTag"
                  aria-label="備註"
                />
                {canEdit && (
                  <button type="button" onClick={() => setF({ ...f, vehicles: f.vehicles.filter((_, j) => j !== i) })} className="px-1 text-slate-500 hover:text-rose-300" aria-label="移除">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === "fees" &&
        (bills.length === 0 ? (
          <p className="text-sm text-slate-500">尚無帳單（到「管理費」產生每月帳單）</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-cyan-300">
              <tr className="border-b border-cyan-500/30">
                <th className="py-1.5">月份</th>
                <th>應繳</th>
                <th>已繳</th>
                <th>狀態</th>
                <th>繳費人</th>
                <th>繳費日</th>
              </tr>
            </thead>
            <tbody>
              {[...bills]
                .sort((a, b) => b.period.localeCompare(a.period))
                .map((b) => (
                  <tr key={b.id} className="border-b border-cyan-500/10">
                    <td className="py-1.5 font-mono text-xs">{b.period}</td>
                    <td className="font-mono text-xs">${b.amount.toLocaleString()}</td>
                    <td className="font-mono text-xs">${b.paid.toLocaleString()}</td>
                    <td className={`text-xs ${b.status === "已繳" || b.status === "免繳" ? "text-emerald-300" : "text-amber-300"}`}>{b.status}</td>
                    <td className="text-xs text-slate-300">
                      {b.payerRole} {b.payerName}
                    </td>
                    <td className="text-xs text-slate-400">{b.paidAt || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ))}

      {tab === "history" &&
        (f.history.length === 0 ? (
          <p className="text-sm text-slate-500">尚無異動紀錄</p>
        ) : (
          <ol className="space-y-2 border-l border-cyan-500/30 pl-3 text-sm">
            {[...f.history].reverse().map((e) => (
              <li key={e.id}>
                <p className="text-xs text-slate-400">
                  <span className="font-mono">{e.date}</span> · <span className={e.type === "修改" ? "text-slate-300" : "text-cyan-300"}>{e.type}</span> · {e.by}
                </p>
                <p className="text-slate-200">{e.text}</p>
                {e.removed && [...(e.removed.owners ?? []), ...(e.removed.tenants ?? [])].length > 0 && (
                  <p className="text-[11px] text-slate-500">
                    遷出：{[...(e.removed.owners ?? []), ...(e.removed.tenants ?? [])].map((p) => `${p.name}${p.phone ? ` ${p.phone}` : ""}${p.since ? `（${p.since} 起）` : ""}`).join("、")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        ))}
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}

/** 住戶異動精靈：選類型 → 新住戶 → 車輛保留 → 帳號同步 */
function ChangeDialog({ h, onClose, onDone }: { h: Household; onClose: () => void; onDone: (h: Household) => void }) {
  const [type, setType] = useState<ChangeType>(h.tenants.length ? "換租" : "過戶");
  const [date, setDate] = useState(today());
  const [people, setPeople] = useState<Person[]>([newPerson()]);
  const [occupancy, setOccupancy] = useState<Occupancy>(type === "過戶" ? h.occupancy : "自住");
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [newVehicles, setNewVehicles] = useState<Vehicle[]>([]);
  const [disableAccounts, setDisableAccounts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ household: Household; billsUpdated: number; accounts: { disabled: string[]; added: string[] } } | null>(null);

  const leaving = type === "過戶" ? h.owners : h.tenants;
  const leavingIds = new Set(leaving.map((p) => p.id));
  const theirVehicles = h.vehicles.filter((v) => leavingIds.has(v.personId));

  async function submit() {
    setBusy(true);
    setError("");
    try {
      setResult(
        await api(`/api/residents/${h.id}/change`, {
          method: "POST",
          json: { type, date, people: type === "退租" ? [] : people, occupancy, keepVehicles: [...keep], newVehicles: newVehicles.filter((v) => v.plate), disableAccounts },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (result)
    return (
      <Modal
        title="異動完成"
        subtitle={`${unitLabel(h.id)} · ${type}`}
        onClose={() => onDone(result.household)}
        footer={
          <>
            <div className="flex-1" />
            <button type="button" onClick={() => onDone(result.household)} className={BTN_PRIMARY}>
              完成
            </button>
          </>
        }
      >
        <ul className="space-y-1.5 text-sm text-slate-200">
          <li>✓ 住戶資料已更新，舊住戶保留在「異動紀錄」</li>
          <li>
            ✓ 車輛：{theirVehicles.length - keep.size > 0 ? `移除 ${theirVehicles.length - keep.size} 輛舊住戶車輛` : "無需移除"}
            {newVehicles.filter((v) => v.plate).length ? `，新增 ${newVehicles.filter((v) => v.plate).length} 輛` : ""}
          </li>
          <li>✓ 管理費：{result.billsUpdated ? `${result.billsUpdated} 張未繳帳單改由新繳費人負責` : "沒有需要調整的未繳帳單"}</li>
          <li>
            ✓ 帳號：{result.accounts.disabled.length ? `停用 ${result.accounts.disabled.join("、")}` : "無停用"}；
            {result.accounts.added.length ? `開通 ${result.accounts.added.join("、")}（已綁定戶別）` : "未開通新帳號（新住戶未填 Email）"}
          </li>
        </ul>
      </Modal>
    );

  return (
    <Modal
      wide
      title="住戶異動"
      subtitle={unitLabel(h.id)}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? "處理中…" : "確認異動"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Field label="異動類型">
          <Select
            value={type}
            options={CHANGE_TYPES}
            onChange={(t) => {
              setType(t);
              setKeep(new Set());
              setOccupancy(t === "換租" ? "出租" : t === "過戶" ? h.occupancy : "自住");
            }}
          />
        </Field>
        <Field label="異動日">
          <input type="date" required className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="異動後居住狀態">
          <select className={INPUT} value={occupancy} disabled={type === "換租"} onChange={(e) => setOccupancy(e.target.value as Occupancy)}>
            {OCCUPANCY.filter((o) => type !== "退租" || o !== "出租").map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="rounded-md bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
        {type === "過戶" ? "所有權人" : "承租人"}遷出：<b className="text-cyan-50">{leaving.map((p) => p.name).join("、") || "（無）"}</b>
        {type === "過戶" && "　產權車位跟著戶別轉給新所有權人。"}
      </p>
      {type !== "退租" && <PeopleEditor label={`新${type === "過戶" ? "所有權人" : "承租人"}`} list={people} onChange={setPeople} disabled={false} />}
      {theirVehicles.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-sm font-semibold text-cyan-100">舊住戶的車輛（預設移除，勾選保留）</h4>
          {theirVehicles.map((v) => (
            <label key={v.id} className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={keep.has(v.id)}
                onChange={() => setKeep((k) => (k.has(v.id) ? new Set([...k].filter((x) => x !== v.id)) : new Set([...k, v.id])))}
                className="accent-cyan-400"
              />
              {v.type} <span className="font-mono">{v.plate}</span>
            </label>
          ))}
        </section>
      )}
      {type !== "退租" && (
        <section className="space-y-1.5">
          <div className="flex items-center">
            <h4 className="text-sm font-semibold text-cyan-100">新住戶車輛</h4>
            <button
              type="button"
              onClick={() => setNewVehicles([...newVehicles, { id: uid(), type: "汽車", plate: "", personId: "", note: "" }])}
              className="ml-auto text-xs text-cyan-300 hover:underline"
            >
              ＋ 新增
            </button>
          </div>
          {newVehicles.map((v, i) => (
            <div key={v.id} className="grid grid-cols-[6rem_1fr_auto] gap-1.5">
              <select
                className={`${INPUT} py-1 text-xs`}
                value={v.type}
                onChange={(e) => setNewVehicles(newVehicles.map((x, j) => (j === i ? { ...x, type: e.target.value as Vehicle["type"] } : x)))}
                aria-label="車種"
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                className={`${INPUT} py-1 font-mono text-xs uppercase`}
                value={v.plate}
                onChange={(e) => setNewVehicles(newVehicles.map((x, j) => (j === i ? { ...x, plate: e.target.value } : x)))}
                placeholder="車號"
                aria-label="車號"
              />
              <button type="button" onClick={() => setNewVehicles(newVehicles.filter((_, j) => j !== i))} className="px-1 text-slate-500 hover:text-rose-300" aria-label="移除">
                ✕
              </button>
            </div>
          ))}
        </section>
      )}
      <label className="flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={disableAccounts} onChange={(e) => setDisableAccounts(e.target.checked)} className="mt-1 accent-cyan-400" />
        <span>
          停用舊住戶在本社區的系統帳號
          <span className="block text-[11px] text-slate-500">綁定此戶別的住戶帳號會停用；新住戶有填 Email 會自動開通帳號並綁定戶別。</span>
        </span>
      </label>
      <p className="text-[11px] text-slate-500">異動月份起的未繳管理費，會改由新的繳費人負責；之前月份的帳單保留原繳費人。</p>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
