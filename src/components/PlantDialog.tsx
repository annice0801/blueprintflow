"use client";

import { useState } from "react";
import { PLANT_EVENT_TYPES, PLANT_HEALTH, PLANT_TYPES, type Plant, type PlantEvent } from "@/lib/records";
import { api, BTN_DANGER, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, nowLocal, PhotoField, Select, Thumb, usePhotos } from "./ui";

export type PlantDraft = { buildingId: string; areaId: string; x: number; y: number; bed: string };

type Props = {
  plant?: Plant;
  draft?: PlantDraft;
  onClose: () => void;
  onChange: (plant: Plant) => void;
  onDeleted: (id: string) => void;
};

const EVENT_TONE: Partial<Record<PlantEvent["type"], string>> = {
  颱風倒伏: "bg-rose-500/20 text-rose-200 border-rose-400/50",
  颱風損傷: "bg-amber-500/20 text-amber-200 border-amber-400/50",
  病蟲害: "bg-amber-500/20 text-amber-200 border-amber-400/50",
};

export default function PlantDialog({ plant, draft, onClose, onChange, onDeleted }: Props) {
  const [tab, setTab] = useState<"intro" | "events">("intro");
  const [form, setForm] = useState({
    name: plant?.name ?? "",
    species: plant?.species ?? "",
    bed: plant?.bed ?? draft?.bed ?? "",
    type: plant?.type ?? ("喬木" as Plant["type"]),
    health: plant?.health ?? ("良好" as Plant["health"]),
    plantedAt: plant?.plantedAt ?? "",
    height: plant?.height ?? "",
    description: plant?.description ?? "",
  });
  const photos = usePhotos(plant?.photos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name.trim()) return setError("請填寫植栽名稱");
    setBusy(true);
    setError("");
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.set(k, v);
    photos.appendTo(fd, plant?.photos);
    if (!plant && draft) for (const [k, v] of Object.entries(draft)) if (k !== "bed") fd.set(k, String(v));
    try {
      const saved = await api<Plant>(plant ? `/api/plants/${plant.id}` : "/api/plants", { method: plant ? "PATCH" : "POST", body: fd });
      photos.reset(saved.photos);
      onChange(saved);
      if (!plant) setTab("events"); // 新增後直接可登錄事件
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!plant || !confirm(`確定刪除「${plant.name}」？所有事件紀錄與照片會一併刪除。`)) return;
    setBusy(true);
    try {
      await api(`/api/plants/${plant.id}`, { method: "DELETE" });
      onDeleted(plant.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const where = plant ?? draft!;

  return (
    <Modal
      wide
      title={plant ? plant.name : "新增植栽"}
      subtitle={`${plant?.bed ?? draft?.bed} · 座標 (${where.x}, ${where.y}) m`}
      onClose={onClose}
      onSubmit={tab === "intro" ? save : undefined}
      footer={
        tab === "intro" ? (
          <>
            {plant && (
              <button type="button" onClick={remove} disabled={busy} className={BTN_DANGER}>
                刪除植栽
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose} className={BTN_GHOST}>
              關閉
            </button>
            <button type="submit" disabled={busy} className={BTN_PRIMARY}>
              {busy ? "儲存中…" : plant ? "儲存介紹" : "新增植栽"}
            </button>
          </>
        ) : undefined
      }
    >
      {plant && (
        <div className="-mt-1 flex gap-1 border-b border-cyan-500/20">
          {(
            [
              ["intro", "介紹"],
              ["events", `事件紀錄（${plant.events.length}）`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${tab === k ? "border-cyan-400 text-cyan-100" : "border-transparent text-slate-400 hover:text-cyan-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "intro" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="名稱 *">
              <input className={INPUT} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="例：樟樹 #3" maxLength={60} autoFocus={!plant} />
            </Field>
            <Field label="樹種 / 學名">
              <input className={INPUT} value={form.species} onChange={(e) => set("species", e.target.value)} placeholder="例：樟樹 Cinnamomum camphora" maxLength={60} />
            </Field>
            <Field label="類型">
              <Select value={form.type} options={PLANT_TYPES} onChange={(v) => set("type", v)} />
            </Field>
            <Field label="目前狀態">
              <Select value={form.health} options={PLANT_HEALTH} onChange={(v) => set("health", v)} />
            </Field>
            <Field label="種植日期">
              <input type="date" className={INPUT} value={form.plantedAt} onChange={(e) => set("plantedAt", e.target.value)} />
            </Field>
            <Field label="高度 / 規格">
              <input className={INPUT} value={form.height} onChange={(e) => set("height", e.target.value)} placeholder="例：4.5 m、米徑 15 cm" maxLength={20} />
            </Field>
          </div>
          <Field label="所在花圃">
            <input className={INPUT} value={form.bed} onChange={(e) => set("bed", e.target.value)} maxLength={40} />
          </Field>
          <Field label="介紹">
            <textarea className={`${INPUT} min-h-24`} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="來源、特色、養護注意事項…" maxLength={2000} />
          </Field>
          <PhotoField photos={photos} />
          <ErrorText>{error}</ErrorText>
        </>
      ) : (
        plant && <EventTimeline plant={plant} onChange={onChange} />
      )}
    </Modal>
  );
}

function EventTimeline({ plant, onChange }: { plant: Plant; onChange: (p: Plant) => void }) {
  const [editing, setEditing] = useState<string | "new" | null>(plant.events.length ? null : "new");
  const done = (p: Plant | null) => {
    if (p) onChange(p);
    setEditing(null);
  };
  const events = [...plant.events].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  async function remove(ev: PlantEvent) {
    if (!confirm(`刪除 ${ev.date} 的「${ev.type}」紀錄？`)) return;
    onChange(await api<Plant>(`/api/plants/${plant.id}/events/${ev.id}`, { method: "DELETE" }));
  }

  return (
    <div className="space-y-3">
      {editing === "new" ? (
        <EventForm plantId={plant.id} onDone={done} />
      ) : (
        <button type="button" onClick={() => setEditing("new")} className={`${BTN_OUTLINE} w-full py-2`}>
          ＋ 新增事件紀錄（颱風、修剪、病蟲害…）
        </button>
      )}

      {events.length === 0 && editing !== "new" && <p className="py-4 text-center text-xs text-slate-500">尚無紀錄</p>}

      <ol className="relative space-y-3 border-l border-cyan-500/30 pl-4">
        {events.map((ev) =>
          editing === ev.id ? (
            <li key={ev.id}>
              <EventForm plantId={plant.id} event={ev} onDone={done} />
            </li>
          ) : (
            <li key={ev.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-cyan-300 bg-[#06142a]" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-cyan-100">{ev.date}</span>
                <span className={`rounded border px-1.5 py-0.5 text-[11px] ${EVENT_TONE[ev.type] ?? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"}`}>{ev.type}</span>
                {ev.typhoon && <span className="text-xs text-amber-200">🌀 {ev.typhoon}颱風</span>}
                <div className="flex-1" />
                <button type="button" onClick={() => setEditing(ev.id)} className="text-xs text-cyan-300 hover:underline">
                  編輯
                </button>
                <button type="button" onClick={() => remove(ev)} className="text-xs text-rose-300 hover:underline">
                  刪除
                </button>
              </div>
              {ev.description && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                  <span className="text-slate-500">狀況：</span>
                  {ev.description}
                </p>
              )}
              {ev.handling && (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-300">
                  <span className="text-slate-500">處理：</span>
                  {ev.handling}
                </p>
              )}
              {ev.handler && <p className="mt-0.5 text-xs text-slate-400">處理人：{ev.handler}</p>}
              {ev.photos.length > 0 && (
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {ev.photos.map((p) => (
                    <Thumb key={p} src={`/api/uploads/${p}`} />
                  ))}
                </div>
              )}
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

/** 事件表單（位於 Modal 的 form 內，所以不用 <form>） */
function EventForm({ plantId, event, onDone }: { plantId: string; event?: PlantEvent; onDone: (p: Plant | null) => void }) {
  const [f, setF] = useState({
    date: event?.date ?? nowLocal().slice(0, 10),
    type: event?.type ?? ("颱風倒伏" as PlantEvent["type"]),
    typhoon: event?.typhoon ?? "",
    description: event?.description ?? "",
    handling: event?.handling ?? "",
    handler: event?.handler ?? "",
  });
  const photos = usePhotos(event?.photos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const isTyphoon = f.type.startsWith("颱風");

  async function save() {
    if (!f.date) return setError("請填寫日期");
    setBusy(true);
    setError("");
    const fd = new FormData();
    for (const [k, v] of Object.entries(f)) fd.set(k, k === "typhoon" && !isTyphoon ? "" : v);
    photos.appendTo(fd, event?.photos);
    try {
      onDone(await api<Plant>(`/api/plants/${plantId}/events${event ? `/${event.id}` : ""}`, { method: event ? "PATCH" : "POST", body: fd }));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-cyan-400/40 bg-cyan-400/5 p-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="日期 *">
          <input type="date" className={INPUT} value={f.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="事件類型">
          <Select value={f.type} options={PLANT_EVENT_TYPES} onChange={(v) => set("type", v)} />
        </Field>
        {isTyphoon && (
          <Field label="颱風名稱">
            <input className={INPUT} value={f.typhoon} onChange={(e) => set("typhoon", e.target.value)} placeholder="例：杜蘇芮" maxLength={40} />
          </Field>
        )}
      </div>
      <Field label="當時狀況">
        <textarea className={`${INPUT} min-h-16`} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="例：強風吹倒，主幹傾斜約 45 度，壓到步道" maxLength={2000} />
      </Field>
      <Field label="處理方式">
        <textarea className={`${INPUT} min-h-16`} value={f.handling} onChange={(e) => set("handling", e.target.value)} placeholder="例：隔日請園藝廠商扶正、加支架、修剪斷枝" maxLength={2000} />
      </Field>
      <Field label="處理人 / 廠商">
        <input className={INPUT} value={f.handler} onChange={(e) => set("handler", e.target.value)} maxLength={60} />
      </Field>
      <PhotoField photos={photos} />
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onDone(null)} className={BTN_GHOST}>
          取消
        </button>
        <button type="button" onClick={save} disabled={busy} className={BTN_PRIMARY}>
          {busy ? "儲存中…" : event ? "更新紀錄" : "新增紀錄"}
        </button>
      </div>
    </div>
  );
}
