"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { areaToEn, generateText, guessFromNotice, TEMPLATE_INFO } from "@/lib/announce";
import { ANN_STATUS, ANN_TEMPLATES, type Announcement, type AnnStatus, type AnnTemplate } from "@/lib/field";
import { googleCalendarUrl } from "@/lib/ics";
import { api, BTN_DANGER, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, ErrorText, Field, INPUT, Modal } from "../ui";
import { fmtDate, roleName, upsert, useMgmt } from "../manage/common";
import Poster from "./Poster";

const STATUS_CLS: Record<AnnStatus, string> = {
  草稿: "border-slate-500/60 text-slate-300",
  待審核: "border-amber-400/60 text-amber-200",
  退回修改: "border-rose-400/60 text-rose-200",
  已核准: "border-sky-400/60 text-sky-200",
  張貼中: "border-cyan-400/60 text-cyan-100",
  已張貼: "border-emerald-400/60 text-emerald-200",
  已撤下: "border-slate-600 text-slate-500",
};

export default function AnnouncementsTab({ focusId }: { focusId?: string }) {
  const params = useSearchParams();
  const { announcements } = useMgmt();
  const [openId, setOpenId] = useState<string | null>(focusId ?? null);
  const [intake, setIntake] = useState(params.get("new") === "1");
  const [status, setStatus] = useState<AnnStatus | "">("");
  const shown = announcements.filter((a) => !status || a.status === status);
  const open = announcements.find((a) => a.id === openId);

  if (open) return <Editor key={open.id} ann={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setIntake(true)} className={`${BTN_PRIMARY} py-2.5`}>
          📣 收到通知 → 製作公告
        </button>
        <div className="flex flex-wrap gap-1 text-xs">
          {(["", ...ANN_STATUS] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-2.5 py-1 ${status === s ? "border-cyan-300 bg-cyan-400/20 text-cyan-50" : "border-slate-600 text-slate-300"}`}>
              {s || "全部"} <span className="text-slate-500">{s ? announcements.filter((a) => a.status === s).length : announcements.length}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-max gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
        {shown.length === 0 && <p className="col-span-full py-12 text-center text-sm text-slate-500">尚無公告。收到建商、廠商或台電、自來水的通知時，按上方按鈕貼上內容即可產生中英文公告。</p>}
        {shown.map((a) => (
          <button key={a.id} onClick={() => setOpenId(a.id)} className="group space-y-2 rounded-lg border border-cyan-500/20 bg-white/[0.02] p-2 text-left hover:border-cyan-400/60">
            <div className="pointer-events-none mx-auto w-full max-w-[220px]">
              <Poster ann={a} />
            </div>
            <div className="flex items-center gap-2 px-1">
              <span className={`rounded border px-1.5 text-[11px] ${STATUS_CLS[a.status]}`}>{a.status}</span>
              <span className="truncate text-sm text-cyan-50">{a.zh.title}</span>
            </div>
            <p className="px-1 text-[11px] text-slate-400">
              {a.fields.start ? `${fmtDate(a.fields.start.slice(0, 10))}${a.fields.end ? ` → ${fmtDate(a.fields.end.slice(0, 10))}` : ""}` : fmtDate(a.createdAt.slice(0, 10))}
              {a.postings.length > 0 && ` · 張貼 ${a.postings.filter((p) => p.postedAt).length}/${a.postings.length}`}
            </p>
          </button>
        ))}
      </div>
      {intake && (
        <Intake
          onClose={() => setIntake(false)}
          onCreated={(a) => {
            setIntake(false);
            setOpenId(a.id);
          }}
        />
      )}
    </div>
  );
}

/* ── 收到通知 ── */

function Intake({ onClose, onCreated }: { onClose: () => void; onCreated: (a: Announcement) => void }) {
  const { building, setAnnouncements, roles } = useMgmt();
  const [text, setText] = useState("");
  const [template, setTemplate] = useState<AnnTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guess = guessFromNotice(text);
  const tpl = template ?? guess.template;

  async function create() {
    setBusy(true);
    try {
      const fields = {
        start: guess.start,
        end: guess.end,
        area: guess.area,
        areaEn: areaToEn(guess.area),
        contact: roles.get("gm")?.name ? `總幹事 ${roles.get("gm")!.name}` : "",
        issuer: "藍圖社區管理委員會",
        issuerEn: "Blueprint Residence Management Committee",
      };
      const gen = generateText({ template: tpl, fields, extraZh: "", extraEn: "" });
      const a = await api<Announcement>("/api/announcements", {
        method: "POST",
        json: { buildingId: building.id, template: tpl, ...gen, fields, source: text, layout: { lang: "both", fontScale: 1, photoLayout: "none", accent: "" }, removeBy: (guess.end || guess.start).slice(0, 10) },
      });
      setAnnouncements((all) => [a, ...all]);
      onCreated(a);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title="收到通知 → 製作公告"
      subtitle="貼上建商、廠商、台電或自來水公司的通知內容，系統會判斷類型、日期與範圍"
      onClose={onClose}
      onSubmit={create}
      footer={
        <>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? "建立中…" : "產生公告草稿 →"}
          </button>
        </>
      }
    >
      <textarea
        className={`${INPUT} min-h-32`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例：本公司訂於 11/10（一）9:00~17:00 進行 A 棟 2 號電梯年度保養，屆時該電梯暫停使用。—— 建商售服部"
        autoFocus
      />
      <div className="space-y-1.5">
        <span className="text-xs text-cyan-300">公告類型（可改）</span>
        <div className="flex flex-wrap gap-1.5">
          {ANN_TEMPLATES.map((t) => (
            <button key={t} type="button" onClick={() => setTemplate(t)} className={`rounded-full border px-3 py-1 text-sm ${tpl === t ? "border-cyan-300 bg-cyan-400/20 text-cyan-50" : "border-slate-600 text-slate-300"}`}>
              {TEMPLATE_INFO[t].icon} {TEMPLATE_INFO[t].zh.replace("公告", "") || "一般"}
            </button>
          ))}
        </div>
      </div>
      {text && (
        <p className="rounded-md bg-white/5 px-3 py-2 text-xs text-slate-300">
          偵測：{TEMPLATE_INFO[tpl].zh}
          {guess.start && ` · 期間 ${guess.start.replace("T", " ")}${guess.end ? ` → ${guess.end.replace("T", " ")}` : ""}`}
          {guess.area && ` · 範圍 ${guess.area}`}
          {!guess.start && " · 未偵測到日期，可在下一步填寫"}
        </p>
      )}
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}

/* ── 編輯與流程 ── */

function Editor({ ann, onBack }: { ann: Announcement; onBack: () => void }) {
  const { setAnnouncements, settings, roles } = useMgmt();
  const [a, setA] = useState(ann);
  const [extra, setExtra] = useState({ zh: "", en: "" });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<"reject" | "assign" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editable = ["草稿", "退回修改", "待審核", "已核准"].includes(a.status);

  const patch = (p: Partial<Announcement>) => {
    setA((x) => ({ ...x, ...p }));
    setDirty(true);
  };
  const setFields = (p: Partial<Announcement["fields"]>) => patch({ fields: { ...a.fields, ...p } });

  // 自動儲存（停止輸入 1 秒後）
  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const saved = await api<Announcement>(`/api/announcements/${a.id}`, { method: "PATCH", json: { template: a.template, zh: a.zh, en: a.en, fields: a.fields, photos: a.photos, layout: a.layout, removeBy: a.removeBy, by: "總幹事" } });
        setAnnouncements((all) => upsert(all, saved));
        setA((x) => ({ ...x, status: saved.status, review: saved.review }));
        setDirty(false);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [a, dirty, setAnnouncements]);

  function regenerate() {
    if (!confirm("依目前欄位重新產生中英文標題與內文？手動修改過的文字會被取代。")) return;
    patch(generateText({ template: a.template, fields: a.fields, extraZh: extra.zh, extraEn: extra.en }));
  }

  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      const saved = await api<Announcement>(`/api/announcements/${a.id}`, { method: "PATCH", json: { action, ...body } });
      setAnnouncements((all) => upsert(all, saved));
      setA(saved);
      setDialog(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    return (await api<{ name: string }>("/api/uploads", { method: "POST", body: fd })).name;
  }

  async function remove() {
    if (!confirm("刪除這份公告？")) return;
    await api(`/api/announcements/${a.id}`, { method: "DELETE" });
    setAnnouncements((all) => all.filter((x) => x.id !== a.id));
    onBack();
  }

  const reviewer = roleName("chair", roles, false);
  const inp = `${INPUT} py-1.5 text-sm`;

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
      <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onBack} className="text-sm text-cyan-300 hover:underline">
            ← 公告列表
          </button>
          <span className={`rounded border px-1.5 text-xs ${STATUS_CLS[a.status]}`}>{a.status}</span>
          <span className="text-xs text-slate-500">{dirty ? "儲存中…" : "已自動儲存"}</span>
          <div className="flex-1" />
          <button onClick={remove} className={`${BTN_DANGER} py-1 text-xs`}>
            刪除
          </button>
        </div>

        <Workflow a={a} busy={busy} reviewer={reviewer} onAct={act} onReject={() => setDialog("reject")} onAssign={() => setDialog("assign")} onUpload={upload} />
        <ErrorText>{error}</ErrorText>

        {a.source && (
          <details className="rounded-md bg-white/5 px-3 py-2 text-xs text-slate-300">
            <summary className="cursor-pointer text-slate-400">收到的原始通知</summary>
            <p className="mt-1 whitespace-pre-wrap">{a.source}</p>
          </details>
        )}

        <fieldset disabled={!editable} className="space-y-4 disabled:opacity-60">
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-cyan-100">1. 背景模板</h4>
            <div className="flex flex-wrap gap-1.5">
              {ANN_TEMPLATES.map((t) => (
                <button key={t} type="button" onClick={() => patch({ template: t, layout: { ...a.layout, accent: "" } })} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${a.template === t ? "border-cyan-300 bg-cyan-400/20 text-cyan-50" : "border-slate-600 text-slate-300"}`}>
                  <span className="h-3 w-3 rounded-full" style={{ background: TEMPLATE_INFO[t].accent }} />
                  {TEMPLATE_INFO[t].zh}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-cyan-100">2. 內容欄位</h4>
            <div className="grid grid-cols-2 gap-2">
              <Field label="開始">
                <input type="datetime-local" className={inp} value={a.fields.start.length === 10 ? `${a.fields.start}T00:00` : a.fields.start} onChange={(e) => setFields({ start: e.target.value })} />
              </Field>
              <Field label="結束">
                <input type="datetime-local" className={inp} value={a.fields.end.length === 10 ? `${a.fields.end}T00:00` : a.fields.end} onChange={(e) => setFields({ end: e.target.value })} />
              </Field>
              <Field label="範圍（中文）">
                <input className={inp} value={a.fields.area} onChange={(e) => setFields({ area: e.target.value, areaEn: areaToEn(e.target.value) })} placeholder="例：A 棟 2 號電梯" />
              </Field>
              <Field label="範圍（英文，自動帶入可修改）">
                <input className={inp} value={a.fields.areaEn} onChange={(e) => setFields({ areaEn: e.target.value })} />
              </Field>
              <Field label="聯絡窗口">
                <input className={inp} value={a.fields.contact} onChange={(e) => setFields({ contact: e.target.value })} placeholder="例：管理中心 02-xxxx-xxxx" />
              </Field>
              <Field label="預計撤下日">
                <input type="date" className={inp} value={a.removeBy} onChange={(e) => patch({ removeBy: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="補充說明（中文）">
                <textarea className={`${INPUT} min-h-16 text-sm`} value={extra.zh} onChange={(e) => setExtra({ ...extra, zh: e.target.value })} placeholder="例：施工期間請改搭 1 號電梯，搬運大型物品請洽管理室" />
              </Field>
              <Field label="補充說明（英文，需手動輸入）">
                <textarea className={`${INPUT} min-h-16 text-sm`} value={extra.en} onChange={(e) => setExtra({ ...extra, en: e.target.value })} placeholder="e.g. Please use Elevator No.1 during the work." />
              </Field>
            </div>
            <button type="button" onClick={regenerate} className={`${BTN_OUTLINE} w-full`}>
              ↻ 依欄位產生中文 / 英文版
            </button>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-cyan-100">3. 手動調整文字</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <input className={inp} value={a.zh.title} onChange={(e) => patch({ zh: { ...a.zh, title: e.target.value } })} aria-label="中文標題" />
                <textarea className={`${INPUT} min-h-40 text-sm`} value={a.zh.body} onChange={(e) => patch({ zh: { ...a.zh, body: e.target.value } })} aria-label="中文內文" />
              </div>
              <div className="space-y-1.5">
                <input className={inp} value={a.en.title} onChange={(e) => patch({ en: { ...a.en, title: e.target.value } })} aria-label="英文標題" />
                <textarea className={`${INPUT} min-h-40 text-sm`} value={a.en.body} onChange={(e) => patch({ en: { ...a.en, body: e.target.value } })} aria-label="英文內文" />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-cyan-100">4. 照片與版面</h4>
            <div className="flex flex-wrap items-center gap-2">
              {a.photos.map((p) => (
                <button key={p} type="button" onClick={() => patch({ photos: a.photos.filter((x) => x !== p) })} className="relative" title="移除">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/uploads/${p}`} alt="" className="h-16 w-16 rounded object-cover" />
                  <span className="absolute right-0.5 top-0.5 rounded-full bg-black/70 px-1 text-[10px] text-white">✕</span>
                </button>
              ))}
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded border border-dashed border-cyan-500/50 text-xl text-cyan-300">
                ＋
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const name = await upload(file);
                    patch({ photos: [...a.photos, name], layout: { ...a.layout, photoLayout: a.layout.photoLayout === "none" ? "top" : a.layout.photoLayout } });
                  }}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="語言">
                <select className={inp} value={a.layout.lang} onChange={(e) => patch({ layout: { ...a.layout, lang: e.target.value as "both" } })}>
                  <option value="both">中英對照</option>
                  <option value="zh">只有中文</option>
                  <option value="en">只有英文</option>
                </select>
              </Field>
              <Field label="照片位置">
                <select className={inp} value={a.layout.photoLayout} onChange={(e) => patch({ layout: { ...a.layout, photoLayout: e.target.value as "top" } })}>
                  <option value="none">不顯示</option>
                  <option value="top">內文上方</option>
                  <option value="side">內文右側</option>
                  <option value="bottom">內文下方</option>
                </select>
              </Field>
              <Field label={`字級 ${Math.round(a.layout.fontScale * 100)}%`}>
                <input type="range" min={0.6} max={1.6} step={0.05} value={a.layout.fontScale} onChange={(e) => patch({ layout: { ...a.layout, fontScale: Number(e.target.value) } })} className="w-full accent-cyan-400" />
              </Field>
              <Field label="主色">
                <input type="color" className="h-9 w-full cursor-pointer rounded border border-cyan-500/30 bg-transparent" value={a.layout.accent || TEMPLATE_INFO[a.template].accent} onChange={(e) => patch({ layout: { ...a.layout, accent: e.target.value } })} />
              </Field>
            </div>
          </section>
        </fieldset>

        <section className="space-y-1">
          <h4 className="text-sm font-semibold text-cyan-100">流程紀錄</h4>
          <ol className="space-y-0.5 border-l border-cyan-500/30 pl-3 text-xs text-slate-300">
            {[...a.review].reverse().map((r, i) => (
              <li key={i}>
                <span className="mr-2 font-mono text-slate-500">{r.at.slice(0, 16).replace("T", " ")}</span>
                {r.by && <span className="mr-1 text-cyan-200">{r.by}</span>}
                {r.action}
                {r.comment && <span className="text-amber-200">：{r.comment}</span>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className={BTN_PRIMARY}>
            🖨 列印 / 存成 PDF
          </button>
          {a.fields.start && (
            <a href={googleCalendarUrl({ uid: a.id, title: `📢 ${a.zh.title}`, start: a.fields.start, end: a.fields.end || undefined, location: a.fields.area })} target="_blank" rel="noreferrer" className={BTN_OUTLINE}>
              📅 加入 Google 日曆
            </a>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-slate-700/40 p-4">
          <div className="mx-auto max-w-[520px]">
            <Poster ann={a} printable />
          </div>
        </div>
      </div>

      {dialog === "reject" && <RejectDialog onClose={() => setDialog(null)} onSubmit={(comment, by) => act("reject", { comment, by })} />}
      {dialog === "assign" && settings && (
        <AssignDialog spots={settings.postingSpots} current={a.postings.map((p) => p.spotId)} onClose={() => setDialog(null)} onSubmit={(spots) => act("assign", { spots, by: "總幹事" })} />
      )}
    </div>
  );
}

function Workflow({
  a,
  busy,
  reviewer,
  onAct,
  onReject,
  onAssign,
  onUpload,
}: {
  a: Announcement;
  busy: boolean;
  reviewer: string;
  onAct: (action: string, body?: Record<string, unknown>) => void;
  onReject: () => void;
  onAssign: () => void;
  onUpload: (f: File) => Promise<string>;
}) {
  const steps: { s: AnnStatus[]; label: string }[] = [
    { s: ["草稿", "退回修改"], label: "物業擬稿" },
    { s: ["待審核"], label: "管委會審核" },
    { s: ["已核准", "張貼中"], label: "張貼" },
    { s: ["已張貼"], label: "已張貼" },
    { s: ["已撤下"], label: "撤下歸檔" },
  ];
  const cur = steps.findIndex((x) => x.s.includes(a.status));
  const [by, setBy] = useState("保全");

  return (
    <section className="space-y-3 rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-3">
      <ol className="flex items-center gap-1 text-xs">
        {steps.map((x, i) => (
          <li key={x.label} className="flex flex-1 items-center gap-1">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${i < cur ? "border-emerald-400 bg-emerald-500/30 text-emerald-100" : i === cur ? "border-cyan-300 bg-cyan-400/30 text-white" : "border-slate-600 text-slate-500"}`}>
              {i < cur ? "✓" : i + 1}
            </span>
            <span className={i === cur ? "text-cyan-50" : "text-slate-400"}>{x.label}</span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-slate-700" />}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        {(a.status === "草稿" || a.status === "退回修改") && (
          <button disabled={busy} onClick={() => onAct("submit", { by: "總幹事" })} className={BTN_PRIMARY}>
            送管委會審核 →
          </button>
        )}
        {a.status === "待審核" && (
          <>
            <span className="text-xs text-slate-300">審核人：{reviewer}</span>
            <button disabled={busy} onClick={() => onAct("approve", { by: reviewer })} className={BTN_PRIMARY}>
              ✓ 核准
            </button>
            <button disabled={busy} onClick={onReject} className={`${BTN_OUTLINE} border-rose-400/60 text-rose-200`}>
              退回修改
            </button>
          </>
        )}
        {(a.status === "已核准" || a.status === "張貼中" || a.status === "已張貼") && (
          <button disabled={busy} onClick={onAssign} className={a.status === "已核准" ? BTN_PRIMARY : BTN_OUTLINE}>
            {a.status === "已核准" ? "指派張貼位置 →" : "調整張貼位置"}
          </button>
        )}
        {(a.status === "張貼中" || a.status === "已張貼") && (
          <button disabled={busy} onClick={() => confirm("確認公告已撤下？") && onAct("remove", { by: "保全" })} className={BTN_OUTLINE}>
            撤下歸檔
          </button>
        )}
        {a.status === "退回修改" && <span className="text-xs text-rose-200">退回原因：{[...a.review].reverse().find((r) => r.action === "退回修改")?.comment}</span>}
      </div>
      {a.postings.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            張貼人
            <select className="rounded border border-cyan-500/30 bg-slate-950/60 px-1.5 py-0.5 text-xs" value={by} onChange={(e) => setBy(e.target.value)}>
              {["保全", "秘書", "總幹事"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <span className="text-slate-500">每個位置拍照即完成打勾</span>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {a.postings.map((p) => (
              <li key={p.spotId} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${p.postedAt ? "border-emerald-400/40 bg-emerald-500/10" : "border-slate-600"}`}>
                <span className={p.postedAt ? "text-emerald-300" : "text-slate-500"}>{p.postedAt ? "✓" : "○"}</span>
                <span className="flex-1 text-slate-100">{p.label}</span>
                {p.photo && (
                  <a href={`/api/uploads/${p.photo}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/uploads/${p.photo}`} alt="" className="h-8 w-8 rounded object-cover" />
                  </a>
                )}
                {p.postedAt ? (
                  <span className="text-[10px] text-slate-400">
                    {p.by} {p.postedAt.slice(5, 16).replace("T", " ")}
                  </span>
                ) : (
                  <label className="cursor-pointer rounded border border-cyan-400/50 px-2 py-0.5 text-cyan-100">
                    📷 拍照完成
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        onAct("post", { spotId: p.spotId, by, photo: file ? await onUpload(file) : "" });
                      }}
                    />
                  </label>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RejectDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (comment: string, by: string) => void }) {
  const { roles } = useMgmt();
  const [comment, setComment] = useState("");
  const [by, setBy] = useState(roleName("chair", roles, false));
  return (
    <Modal
      title="退回修改"
      onClose={onClose}
      onSubmit={() => comment.trim() && onSubmit(comment, by)}
      footer={
        <>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={!comment.trim()} className={BTN_PRIMARY}>
            退回
          </button>
        </>
      }
    >
      <Field label="審核人">
        <input className={INPUT} value={by} onChange={(e) => setBy(e.target.value)} />
      </Field>
      <Field label="修改意見 *">
        <textarea className={`${INPUT} min-h-24`} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus placeholder="例：請補上施工期間的替代電梯說明" />
      </Field>
    </Modal>
  );
}

function AssignDialog({ spots, current, onClose, onSubmit }: { spots: { id: string; label: string }[]; current: string[]; onClose: () => void; onSubmit: (s: { spotId: string; label: string }[]) => void }) {
  const [sel, setSel] = useState<string[]>(current.length ? current : spots.slice(0, 2).map((s) => s.id));
  return (
    <Modal
      title="指派張貼位置"
      subtitle="保全 / 秘書張貼後在各位置拍照打勾"
      onClose={onClose}
      onSubmit={() => onSubmit(spots.filter((s) => sel.includes(s.id)).map((s) => ({ spotId: s.id, label: s.label })))}
      footer={
        <>
          <span className="text-xs text-slate-400">已選 {sel.length} 處</span>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={!sel.length} className={BTN_PRIMARY}>
            指派
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-1.5">
        {spots.map((s) => (
          <label key={s.id} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm ${sel.includes(s.id) ? "border-cyan-300 bg-cyan-400/10 text-cyan-50" : "border-slate-600 text-slate-300"}`}>
            <input type="checkbox" checked={sel.includes(s.id)} onChange={(e) => setSel((x) => (e.target.checked ? [...x, s.id] : x.filter((y) => y !== s.id)))} className="accent-cyan-400" />
            {s.label}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">張貼位置可在「現場 → 預約設定」最下方調整。</p>
    </Modal>
  );
}
