/**
 * Signed, tamper-evident tokens (session + password-reset), built on the
 * Web Crypto API (`crypto.subtle`) rather than `node:crypto` so the exact
 * same code verifies tokens in both the Node route handlers and the Edge
 * middleware that guards every protected route. Nothing in this file may
 * import `node:crypto` or anything that does — that's what password.ts
 * is for, and it must stay out of the middleware's dependency graph.
 *
 * Format: base64url(payload JSON) + "." + base64url(HMAC-SHA256 signature).
 * This is intentionally simple rather than pulling in a JWT library — there
 * is no need for headers, multiple algorithms, or third-party
 * interoperability here, only integrity + expiry.
 */

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of buf) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const str = atob(padded);
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
  return buf.buffer;
}

async function getHmacKey(): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(SESSION_SECRET);
  return crypto.subtle.importKey("raw", encoded, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signToken(payload: Record<string, unknown>): Promise<string> {
  const key = await getHmacKey();
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${toBase64Url(signature)}`;
}

export async function verifyToken<T = Record<string, unknown>>(token: string | undefined | null): Promise<T | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const key = await getHmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(body)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as T & { exp?: number };
    if (typeof payload.exp === "number" && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
