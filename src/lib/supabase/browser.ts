"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/src/lib/env";

export function createSupabaseBrowserClient() {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase n'est pas configuré. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return createBrowserClient(config.url, config.publishableKey);
}
