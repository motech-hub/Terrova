"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

export function PaydunyaPurchaseButton({
  productType,
  productId,
  label,
  returnTo,
}: {
  productType: "plan" | "pack";
  productId: string;
  label: string;
  returnTo?: string;
}) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoResumeStartedRef = useRef(false);
  const autoResume = searchParams.get("resumePayment") === "1" &&
    searchParams.get("productType") === productType &&
    searchParams.get("productId") === productId;

  const startPayment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const requestedReturnTo = returnTo ?? searchParams.get("returnTo");
      const safeReturnTo = requestedReturnTo && requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") && !requestedReturnTo.includes("\\") ? requestedReturnTo : null;
      const response = await fetch("/api/payments/paydunya/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productType,
          productId,
          sessionId: getSessionId(),
          ...(safeReturnTo ? { returnTo: safeReturnTo } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { checkoutUrl?: string; error?: string; diagnostic?: string } | null;
      if (response.status === 401) {
        const pricingParams = new URLSearchParams({
          productType,
          productId,
          resumePayment: "1",
        });
        if (safeReturnTo) pricingParams.set("returnTo", safeReturnTo);
        const pricingPath = `/pricing?${pricingParams.toString()}`;
        window.location.assign(`/login?next=${encodeURIComponent(pricingPath)}`);
        return;
      }
      if (!response.ok || !payload?.checkoutUrl) throw new Error(payload?.diagnostic ?? payload?.error ?? "Le paiement n'est pas disponible.");
      window.location.assign(payload.checkoutUrl);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Le paiement n'est pas disponible.");
      setLoading(false);
    }
  }, [productId, productType, returnTo, searchParams]);

  useEffect(() => {
    if (!autoResume || autoResumeStartedRef.current) return;
    autoResumeStartedRef.current = true;
    void startPayment();
  }, [autoResume, startPayment]);

  return (
    <div>
      <button className="btn-primary mt-6 w-full justify-center" disabled={loading} onClick={() => void startPayment()} type="button">
        {loading ? "Ouverture du paiement…" : label}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

function getSessionId() {
  const key = "terrova-session-id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
}

export function PaydunyaPaymentNotice() {
  const status = useSyncExternalStore(subscribeToLocation, readPaymentStatus, () => null);

  if (!status) return null;

  const messages: Record<string, string> = {
    completed: "Paiement confirmé. Vos crédits ont été ajoutés à votre portefeuille.",
    pending: "Paiement en attente. Vos crédits seront ajoutés dès confirmation par PayDunya.",
    cancelled: "Le paiement a été annulé. Aucun crédit n'a été débité.",
    failed: "Le paiement a échoué. Vous pouvez réessayer.",
    error: "La confirmation du paiement est temporairement indisponible. Consultez votre solde dans quelques instants.",
    invalid: "Le lien de retour PayDunya est invalide.",
  };
  const message = messages[status] ?? messages.error;

  return <p className="mb-8 rounded-xl border border-[var(--border)] bg-white p-4 text-center text-sm font-semibold" role="status">{message}</p>;
}

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function readPaymentStatus() {
  return new URLSearchParams(window.location.search).get("payment");
}
