import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/src/lib/env";

const protectedPrefixes = ["/dashboard", "/videos", "/api"];
const guestCreationApiPaths = new Set([
  "/api/guest-session",
  "/api/uploads/presign",
  "/api/generation-plan",
  "/api/generations/estimate",
]);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isPublicWebhook = pathname.startsWith("/api/webhooks/") ||
    pathname === "/api/payments/paydunya/ipn" ||
    pathname === "/api/payments/paydunya/return";
  const isGuestCreationApi = guestCreationApiPaths.has(pathname);
  if (!isProtected || isPublicWebhook) return NextResponse.next();

  const config = getSupabaseConfig();
  if (!config) {
    // Keep the local demo usable until Supabase credentials are configured.
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (data.user) return response;

  if (isGuestCreationApi) return response;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(`${pathname}${request.nextUrl.search}`)}`;
  return NextResponse.redirect(loginUrl);
}

export const proxyConfig = {
  matcher: ["/dashboard/:path*", "/videos/:path*", "/api/:path*"],
};
