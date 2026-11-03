"use client";

import { FormEvent, useState } from "react";
import { Mail, Loader2, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";
import { NotificationToast } from "@/src/components/shared/NotificationToast";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18">
      <path d="M21.35 12.27c0-.78-.07-1.54-.22-2.27H12v4.3h5.23a4.47 4.47 0 0 1-1.94 2.93v2.4h3.14c1.84-1.7 2.92-4.2 2.92-7.36Z" fill="#4285F4" />
      <path d="M12 21.5c2.63 0 4.84-.87 6.45-2.37l-3.14-2.4c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.48A9.74 9.74 0 0 0 12 21.5Z" fill="#34A853" />
      <path d="M6.53 13.62a5.85 5.85 0 0 1 0-3.24V7.9H3.28a9.5 9.5 0 0 0 0 8.2l3.25-2.48Z" fill="#FBBC05" />
      <path d="M12 6.35c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.45 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.72 5.4l3.25 2.48C7.3 8.07 9.46 6.35 12 6.35Z" fill="#EA4335" />
    </svg>
  );
}

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"google" | "email" | null>(null);

  const next = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/dashboard";

  async function signInWithGoogle() {
    setError(null);
    setMessage(null);
    setLoading("google");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (authError) throw authError;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Connexion Google impossible.");
      setLoading(null);
    }
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading("email");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (authError) throw authError;
      setMessage("Le lien de connexion vient d'être envoyé. Consultez votre boîte email.");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Envoi du lien impossible.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="w-full max-w-md rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-soft sm:p-9">
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <LogIn size={24} />
        </span>
        <h1 className="mt-5 text-3xl font-black">Bienvenue sur Terrova</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Créez votre compte ou connectez-vous pour lancer et retrouver vos vidéos immobilières.
        </p>
      </div>

      <button aria-busy={loading === "google"} className="btn-secondary mt-8 min-h-12 w-full justify-center" disabled={loading !== null} onClick={signInWithGoogle} type="button">
        {loading === "google" ? <Loader2 className="animate-spin" size={17} /> : <GoogleIcon />}
        Continuer avec Google
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
        <span className="h-px flex-1 bg-[var(--border)]" /> ou <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <form className="space-y-3" noValidate onSubmit={sendMagicLink}>
        <label className="block w-full text-sm font-normal" htmlFor="email">Email</label>
        <div className="relative">
          <input className="min-h-12 w-full rounded-[0.85rem] border border-[var(--border)] bg-white px-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none" id="email" onChange={(event) => setEmail(event.target.value)} placeholder="Saisissez votre email" required type="email" value={email} />
        </div>
        <button aria-busy={loading === "email"} className="btn-primary min-h-12 w-full justify-center" disabled={loading !== null} type="submit">
          {loading === "email" ? <Loader2 className="animate-spin" size={17} /> : <Mail size={17} />}
          Recevoir le lien de connexion
        </button>
      </form>

      <button className="mt-6 block w-full text-center text-sm font-semibold text-[var(--text-secondary)] underline-offset-4 hover:underline" onClick={() => router.push("/")} type="button">
        Retour à l'accueil
      </button>
      <NotificationToast message={message} onClose={() => setMessage(null)} />
      <NotificationToast message={error} onClose={() => setError(null)} type="error" />
    </div>
  );
}
