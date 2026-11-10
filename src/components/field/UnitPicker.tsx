"use client";

import { residentUnits, type Building } from "@/lib/buildings";

/** 戶別選擇：棟別 → 樓層 → 戶號（1F 店鋪另列） */
export default function UnitPicker({ building, value, onChange, className = "" }: { building: Building; value: string; onChange: (id: string) => void; className?: string }) {
  const units = residentUnits(building);
  const [tower, floor] = value ? value.split("-") : ["", ""];
  const towers = [
    { id: "A", label: "A 棟" },
    { id: "B", label: "B 棟" },
    { id: "S", label: "1F 店鋪" },
  ];
  const floors = [...new Set(units.filter((u) => u.tower === tower).map((u) => u.floor))].sort((a, b) => parseInt(b) - parseInt(a));
  const options = units.filter((u) => u.tower === tower && u.floor === floor);
  const sel = `rounded-md border border-cyan-500/30 bg-slate-950/60 px-2 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 ${className}`;
  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        className={sel}
        value={tower}
        onChange={(e) => {
          const t = e.target.value;
          const list = units.filter((u) => u.tower === t);
          onChange((t === "S" ? list[0] : list.find((u) => u.floor === "2F"))?.id ?? "");
        }}
        aria-label="棟別"
      >
        <option value="">棟別</option>
        {towers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <select className={sel} value={floor} disabled={!tower || tower === "S"} onChange={(e) => onChange(units.find((u) => u.tower === tower && u.floor === e.target.value)?.id ?? "")} aria-label="樓層">
        {tower === "S" ? <option value="1F">1F</option> : floors.map((f) => <option key={f}>{f}</option>)}
        {!tower && <option value="">樓層</option>}
      </select>
      <select className={sel} value={value} disabled={!tower} onChange={(e) => onChange(e.target.value)} aria-label="戶號">
        {!tower && <option value="">戶號</option>}
        {options.map((u) => (
          <option key={u.id} value={u.id}>
            {u.unit}
          </option>
        ))}
      </select>
    </div>
  );
}
