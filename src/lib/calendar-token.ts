import "server-only";

/** 行事曆訂閱網址的 token：HMAC(SESSION_SECRET, 社區 id)；換 SESSION_SECRET 即全部失效 */
export async function calendarToken(buildingId: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(process.env.SESSION_SECRET ?? ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`calendar:${buildingId}`)));
  return Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function calendarTokenOk(q: URLSearchParams) {
  const token = q.get("token");
  if (!token || !process.env.SESSION_SECRET) return false;
  const expected = await calendarToken(q.get("buildingId") ?? "blueprint");
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
