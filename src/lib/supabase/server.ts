import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/src/lib/env";

export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies; middleware refreshes them.
        }
      },
    },
  });
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function requireCurrentUser(returnTo = "/dashboard") {
  const user = await getCurrentUser();
  if (user) return user;

  redirect(`/login?next=${encodeURIComponent(returnTo)}`);
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  return user;
}

export async function getUserIdForRequest(
  fallbackSessionId: unknown,
  options?: { allowGuest?: boolean },
) {
  const config = getSupabaseConfig();
  if (!config) {
    return typeof fallbackSessionId === "string" ? fallbackSessionId : null;
  }

  const user = await getCurrentUser();
  if (user) return user.id;
  return options?.allowGuest && typeof fallbackSessionId === "string" ? fallbackSessionId : null;
}
