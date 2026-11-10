"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { overallStatus } from "@/lib/perms";
import { useMe } from "./AuthProvider";

/** 使用紀錄：登入者每次開頁 / 切換分頁回報一次（後台「使用統計」用） */
export default function Tracker() {
  const me = useMe();
  const path = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "";
  const active = !!me && overallStatus(me.user) === "active";
  useEffect(() => {
    if (!active || path === "/login") return;
    const body = JSON.stringify({ path, search: tab ? `?tab=${tab}` : "" });
    if (!navigator.sendBeacon?.("/api/auth/track", new Blob([body], { type: "application/json" })))
      fetch("/api/auth/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }, [active, path, tab]);
  return null;
}
