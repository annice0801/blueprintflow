"use client";

import { useState } from "react";
import type { Rect } from "@/lib/buildings";
import { SHOP_STATUS, type Shop } from "@/lib/records";
import { api, BTN_GHOST, BTN_PRIMARY, ErrorText, Field, INPUT, Modal, Select } from "./ui";

type Props = {
  buildingId: string;
  zone: Rect;
  shop?: Shop;
  onClose: () => void;
  onSaved: (shop: Shop) => void;
};

export default function ShopDialog({ buildingId, zone, shop, onClose, onSaved }: Props) {
  const [f, setF] = useState({
    shopName: shop?.shopName ?? "",
    business: shop?.business ?? "",
    status: shop?.status ?? ("營業中" as Shop["status"]),
    hours: shop?.hours ?? "",
    phone: shop?.phone ?? "",
    contact: shop?.contact ?? "",
    note: shop?.note ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    setError("");
    try {
      onSaved(await api<Shop>(`/api/shops/${zone.id}`, { method: "PUT", json: { ...f, buildingId } }));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`${zone.label} · 店鋪經營`}
      subtitle={shop?.updatedAt ? `最後更新 ${new Date(shop.updatedAt).toLocaleString("zh-TW", { hour12: false })}` : "尚未登錄"}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <p className="text-[11px] text-slate-500">所有權人 / 承租人電話請由「管理員」查看</p>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            取消
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? "儲存中…" : "儲存"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="店名">
          <input className={INPUT} value={f.shopName} onChange={(e) => set("shopName", e.target.value)} placeholder="例：藍圖咖啡" maxLength={60} autoFocus />
        </Field>
        <Field label="業種">
          <input className={INPUT} value={f.business} onChange={(e) => set("business", e.target.value)} placeholder="例：餐飲、便利商店" maxLength={60} />
        </Field>
        <Field label="經營狀態">
          <Select value={f.status} options={SHOP_STATUS} onChange={(v) => set("status", v)} />
        </Field>
        <Field label="營業時間">
          <input className={INPUT} value={f.hours} onChange={(e) => set("hours", e.target.value)} placeholder="例：週一至週六 08:00–21:00" maxLength={60} />
        </Field>
        <Field label="店家電話">
          <input className={INPUT} type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} />
        </Field>
        <Field label="聯絡人">
          <input className={INPUT} value={f.contact} onChange={(e) => set("contact", e.target.value)} maxLength={40} />
        </Field>
      </div>
      <Field label="備註">
        <textarea className={`${INPUT} min-h-20`} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="租約、裝潢、營運異動…" maxLength={1000} />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
