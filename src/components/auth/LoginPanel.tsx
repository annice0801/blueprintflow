"use client";

import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildingOfPath, STATUS_LABEL, type Me } from "@/lib/perms";

type GoogleId = {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

/** 只允許站內相對路徑，避免登入後被導到外部網站 */
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

type Community = { id: string; name: string; address: string };

export default function LoginPanel({ clientId, communities }: { clientId: string; communities: Community[] }) {
  const params = useSearchParams();
  const btn = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "pending" | "disabled">(() => (params.get("status") === "pending" ? "pending" : params.get("status") === "disabled" ? "disabled" : "idle"));
  const [error, setError] = useState(params.get("denied") ? "你的帳號沒有這個頁面的權限，請洽管理員。" : "");

  const onCredential = useCallback(
    async ({ credential }: { credential: string }) => {
      setState("busy");
      setError("");
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, community: buildingOfPath(safeNext(params.get("next"))) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "登入失敗");
        return setState("idle");
      }
      // 已核准 → 原本要去的頁面；尚未核准 → 先進入示範模式瀏覽
      if (data.status === "disabled") setState("disabled");
      else window.location.href = safeNext(params.get("next"));
    },
    [params],
  );

  useEffect(() => {
    if (!ready || !clientId || !btn.current || !window.google) return;
    window.google.accounts.id.initialize({ client_id: clientId, callback: onCredential });
    window.google.accounts.id.renderButton(btn.current, { theme: "filled_black", size: "large", shape: "pill", text: "signin_with", locale: "zh-TW", width: 280 });
  }, [ready, clientId, onCredential, state]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-cyan-400/30 bg-[#04122a]/90 p-8 text-center shadow-[0_0_40px_rgba(76,201,255,0.15)]">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} />
      <p className="font-mono text-sm font-bold tracking-[0.4em] text-cyan-300">BLUEPRINTFLOW</p>
      <h1 className="mt-3 text-xl font-semibold text-cyan-50">社區管理系統</h1>

      {state === "pending" || state === "disabled" ? (
        <Waiting disabled={state === "disabled"} communities={communities} onLogout={logout} />
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-400">請使用 Google 帳號登入</p>
          <div className="mt-6 flex min-h-11 justify-center">{state === "busy" ? <p className="text-sm text-cyan-300">登入中…</p> : <div ref={btn} />}</div>
          {!clientId && <p className="mt-4 text-xs text-rose-300">尚未設定 GOOGLE_CLIENT_ID</p>}
          <p className="mt-6 text-[11px] text-slate-500">登入後可先瀏覽示範內容（假名資料）；住戶、委員、物業人員經管理員核准後，依身分開放完整功能。</p>
        </>
      )}
      {error && <p className="mt-4 rounded-md bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
    </div>
  );
}

/** 待核准：顯示已申請的社區，或選擇要加入的社區 */
function Waiting({ disabled, communities, onLogout }: { disabled: boolean; communities: Community[]; onLogout: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => {});
  }, []);
  useEffect(load, [load]);
  async function join(id: string) {
    setBusy(id);
    setError("");
    const res = await fetch("/api/auth/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buildingId: id }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "申請失敗");
    setBusy("");
    load();
  }
  const mine = me?.communities ?? [];
  const others = communities.filter((c) => !mine.some((m) => m.id === c.id));
  return (
    <div className="mt-6 space-y-4 text-left">
      {disabled ? (
        <p className="rounded-md bg-rose-500/15 px-3 py-3 text-sm text-rose-200">此帳號在所屬社區已停用，請洽社區管理員。</p>
      ) : mine.length ? (
        <p className="rounded-md bg-amber-500/15 px-3 py-3 text-sm text-amber-100">已送出加入申請，請等待社區管理員核准並設定身分後，再按「重新檢查」。</p>
      ) : (
        <p className="rounded-md bg-cyan-500/10 px-3 py-3 text-sm text-cyan-100">請選擇你要加入的社區，送出後由該社區管理員核准。</p>
      )}
      {mine.length > 0 && (
        <ul className="space-y-1 text-sm">
          {mine.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-md border border-cyan-500/20 px-3 py-2">
              <span className="text-cyan-50">{m.name}</span>
              <span className={m.status === "pending" ? "text-xs text-amber-300" : "text-xs text-slate-400"}>{STATUS_LABEL[m.status]}</span>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-slate-500">{mine.length ? "申請加入其他社區" : "社區"}</p>
          {others.map((c) => (
            <button
              key={c.id}
              onClick={() => join(c.id)}
              disabled={!!busy}
              className="flex w-full items-center justify-between rounded-md border border-cyan-500/30 px-3 py-2 text-left hover:bg-cyan-400/10"
            >
              <span>
                <span className="block text-sm text-cyan-50">{c.name}</span>
                <span className="block text-[11px] text-slate-500">{c.address}</span>
              </span>
              <span className="text-xs text-cyan-300">{busy === c.id ? "送出中…" : "申請加入"}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <div className="flex justify-center gap-2 text-sm">
        <button onClick={() => window.location.replace("/")} className="rounded-md border border-cyan-500/40 px-3 py-1.5 text-cyan-200 hover:bg-cyan-400/10">
          重新檢查
        </button>
        <button onClick={onLogout} className="rounded-md px-3 py-1.5 text-slate-400 hover:bg-white/5">
          換一個帳號
        </button>
      </div>
    </div>
  );
}
