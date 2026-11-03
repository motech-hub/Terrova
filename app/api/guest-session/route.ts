import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/supabase/server";
import { createGuestSessionToken, getVerifiedGuestSessionId, guestSessionCookieName } from "@/src/lib/guest-session";

export async function POST(request: Request) {
  if (await getCurrentUser()) {
    return NextResponse.json({ error: "Une session invitée n'est pas nécessaire pour un compte connecté." }, { status: 409 });
  }

  const sessionId = (await getVerifiedGuestSessionId(request)) ?? crypto.randomUUID();
  const response = NextResponse.json({ sessionId });
  response.cookies.set(guestSessionCookieName, await createGuestSessionToken(sessionId), {
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
