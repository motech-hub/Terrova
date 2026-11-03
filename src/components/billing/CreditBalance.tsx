"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";

type Wallet = { planId: string; balance: number; reserved: number; available: number };

export function CreditBalance({ variant = "card" }: { variant?: "card" | "metric" }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    fetch("/api/credits")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        const value = payload as { wallet?: Wallet } | null;
        if (value?.wallet) setWallet(value.wallet);
      })
      .catch(() => undefined);
  }, []);

  if (variant === "metric") {
    return (
      <div className="metric-card">
        <Coins className="text-[var(--primary)]" />
        <span>Crédits disponibles</span>
        <strong>{wallet ? wallet.available : "—"}</strong>
      </div>
    );
  }

  return (
    <div className="mt-20 rounded-xl bg-[#f1efe7] p-4 text-sm">
      <strong className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-full bg-[var(--primary-soft)] text-xs text-[var(--primary)]">C</span>
        {wallet ? `${wallet.available} crédits disponibles` : "Chargement des crédits…"}
      </strong>
      <p className="mt-2 text-[var(--text-secondary)]">Plan Starter</p>
      <div className="mt-4 h-px bg-[var(--border)]" />
      <a className="mt-3 flex justify-center rounded-lg bg-white px-3 py-2 font-semibold" href="/pricing">
        Gérer mon offre
      </a>
    </div>
  );
}
