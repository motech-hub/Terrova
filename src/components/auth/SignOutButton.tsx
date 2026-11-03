"use client";

import { LogOut, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.localStorage.removeItem("terrova-generation-draft");
      window.sessionStorage.removeItem("terrova-generation-draft");
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--text-secondary)] hover:bg-white" disabled={loading} onClick={signOut} type="button">
      {loading ? <Loader2 className="animate-spin" size={16} /> : <LogOut size={16} />}
      Se déconnecter
    </button>
  );
}
