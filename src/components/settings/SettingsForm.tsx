"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, LockKeyhole, Mail, Save, Sparkles, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";
import { NotificationToast } from "@/src/components/shared/NotificationToast";
import { SelectField } from "@/src/components/shared/SelectField";
import {
  defaultTerrovaSettings,
  readTerrovaSettings,
  saveTerrovaSettings,
  type TerrovaDuration,
  type TerrovaRatio,
  type TerrovaSettings,
  type TerrovaStyle,
} from "@/src/lib/settings";

type SettingsFormProps = {
  initialName: string;
  email: string;
  isDemo: boolean;
};

export function SettingsForm({ initialName, email, isDemo }: SettingsFormProps) {
  const [name, setName] = useState(initialName);
  const [settings, setSettings] = useState<TerrovaSettings>(defaultTerrovaSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Les préférences sont une synchronisation explicite avec le stockage local du navigateur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(readTerrovaSettings());
  }, []);

  const initials = useMemo(() => {
    const label = name.trim() || "Mon compte";
    return label
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [name]);

  function updateSetting<Key extends keyof TerrovaSettings>(key: Key, value: TerrovaSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      saveTerrovaSettings(settings);

      if (!isDemo) {
        const supabase = createSupabaseBrowserClient();
        const { error: updateError } = await supabase.auth.updateUser({
          data: { full_name: name.trim() },
        });
        if (updateError) throw updateError;
      }

      setMessage("Vos paramètres sont enregistrés.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Les paramètres n'ont pas pu être enregistrés.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="settings-eyebrow">Votre espace</p>
            <h2 className="settings-title">Profil et compte</h2>
            <p className="settings-description">Ces informations servent à personnaliser votre espace Terrova.</p>
          </div>
          <span className="settings-heading-icon"><UserRound aria-hidden="true" size={19} /></span>
        </div>

        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-[var(--surface-secondary)] p-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#424938] font-black text-white">{initials || "T"}</span>
          <div className="min-w-0">
            <p className="font-bold">{name.trim() || "Mon compte"}</p>
            <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">{email || "Mode démo local"}</p>
          </div>
          <span className="ml-auto hidden rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-bold text-[var(--success)] sm:inline-flex">
            {isDemo ? "Mode démo" : "Compte actif"}
          </span>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="field">
            <span>Nom affiché</span>
            <input autoComplete="name" onChange={(event) => { setName(event.target.value); setMessage(null); }} placeholder="Votre nom ou celui de votre agence" type="text" value={name} />
          </label>
          <div className="field">
            <span>Email de connexion</span>
            <div className="relative">
              <Mail aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={17} />
              <input aria-describedby="email-help" className="pl-11 opacity-75" disabled type="email" value={email || "Non connecté"} />
            </div>
            <small id="email-help">L’adresse est gérée par votre méthode de connexion.</small>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="settings-eyebrow">À chaque nouveau projet</p>
            <h2 className="settings-title">Préférences de création</h2>
            <p className="settings-description">Terrova utilisera ces choix comme point de départ dans le créateur vidéo.</p>
          </div>
          <span className="settings-heading-icon"><Sparkles aria-hidden="true" size={19} /></span>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <SelectField
            id="default-style"
            label="Style par défaut"
            onValueChange={(value) => updateSetting("defaultStyle", value as TerrovaStyle)}
            options={[
              { value: "elegant", label: "Élégant" },
              { value: "dynamic", label: "Dynamique" },
            ]}
            value={settings.defaultStyle}
          />
          <SelectField
            id="default-ratio"
            label="Format par défaut"
            onValueChange={(value) => updateSetting("defaultRatio", value as TerrovaRatio)}
            options={[
              { value: "9:16", label: "9:16 · Reels et TikTok" },
              { value: "16:9", label: "16:9 · YouTube et site web" },
            ]}
            value={settings.defaultRatio}
          />
          <SelectField
            id="default-duration"
            label="Durée par défaut"
            onValueChange={(value) => updateSetting("defaultDuration", Number(value) as TerrovaDuration)}
            options={[
              { value: "10", label: "10 secondes" },
              { value: "15", label: "15 secondes" },
            ]}
            value={String(settings.defaultDuration)}
          />
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="settings-eyebrow">Rester informé</p>
            <h2 className="settings-title">Notifications</h2>
            <p className="settings-description">Choisissez les messages utiles à votre activité, sans bruit inutile.</p>
          </div>
          <span className="settings-heading-icon"><Mail aria-hidden="true" size={19} /></span>
        </div>

        <div className="mt-6 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
          <div className="settings-toggle-row">
            <label htmlFor="email-notifications"><strong>Suivi des générations</strong><small>Recevoir un email quand une vidéo est prête.</small></label>
            <input checked={settings.emailNotifications} id="email-notifications" onChange={(event) => updateSetting("emailNotifications", event.target.checked)} type="checkbox" />
          </div>
          <div className="settings-toggle-row">
            <label htmlFor="product-updates"><strong>Nouveautés Terrova</strong><small>Recevoir les améliorations et conseils de création.</small></label>
            <input checked={settings.productUpdates} id="product-updates" onChange={(event) => updateSetting("productUpdates", event.target.checked)} type="checkbox" />
          </div>
        </div>
      </section>

      <section className="settings-card flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-[var(--primary)]"><LockKeyhole aria-hidden="true" size={19} /></span>
          <div>
            <h2 className="font-black">Données et confidentialité</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Vos photos et vidéos restent temporaires. Consultez les détails dans notre page Confidentialité.</p>
          </div>
        </div>
        <a className="shrink-0 text-sm font-bold text-[var(--primary)] underline-offset-4 hover:underline" href="/privacy">Voir la confidentialité</a>
      </section>

      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-end">
        <div className="min-h-6 flex-1" />
        <button aria-busy={saving} className="btn-primary min-h-12 sm:min-w-48" disabled={saving} onClick={saveSettings} type="button">
          {saving ? <Loader2 aria-hidden="true" className="animate-spin" size={17} /> : <Save aria-hidden="true" size={17} />}
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      <NotificationToast message={message} onClose={() => setMessage(null)} />
      <NotificationToast message={error} onClose={() => setError(null)} type="error" />
    </div>
  );
}
