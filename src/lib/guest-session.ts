import { getEnv } from "@/src/lib/env";

export const guestSessionCookieName = "terrova-guest-session";

function guestSessionSecret() {
  const env = getEnv();
  if (env.GUEST_SESSION_SECRET) return env.GUEST_SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("GUEST_SESSION_SECRET est requis en production lorsque Supabase est configuré.");
  }
  return env.SUPABASE_SECRET_KEY || env.OPENROUTER_API_KEY || "terrova-development-guest-secret";
}

function toBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(guestSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function readGuestSession(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${guestSessionCookieName}=`))
    ?.slice(guestSessionCookieName.length + 1);
  if (!token) return null;

  try {
    const decoded = decodeURIComponent(token);
    const separator = decoded.lastIndexOf(".");
    const sessionId = separator > 0 ? decoded.slice(0, separator) : "";
    return /^[0-9a-f-]{36}$/i.test(sessionId) ? { sessionId, token: decoded } : null;
  } catch {
    return null;
  }
}

export async function createGuestSessionToken(sessionId: string) {
  const key = await signingKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sessionId));
  return `${sessionId}.${toBase64Url(signature)}`;
}

export async function verifyGuestSessionToken(token: string | undefined, sessionId: string) {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator < 1 || token.slice(0, separator) !== sessionId) return false;
  try {
    return await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      fromBase64Url(token.slice(separator + 1)),
      new TextEncoder().encode(sessionId),
    );
  } catch {
    return false;
  }
}

export async function verifyGuestSessionCookie(request: Request, sessionId: string) {
  const guestSession = readGuestSession(request);
  return guestSession?.sessionId === sessionId && verifyGuestSessionToken(guestSession.token, sessionId);
}

export async function getVerifiedGuestSessionId(request: Request) {
  const guestSession = readGuestSession(request);
  if (!guestSession || !(await verifyGuestSessionToken(guestSession.token, guestSession.sessionId))) return null;
  return guestSession.sessionId;
}
