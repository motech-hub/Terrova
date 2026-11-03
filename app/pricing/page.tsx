import Link from "next/link";
import { Check } from "lucide-react";
import { BrandLogo } from "@/src/components/shared/BrandLogo";
import { billingPlans, creditPacks } from "@/src/config/billing";
import { PaydunyaPaymentNotice, PaydunyaPurchaseButton } from "@/src/components/billing/PaydunyaPurchaseButton";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-6 sm:px-8">
      <nav className="mx-auto flex max-w-[1760px] items-center justify-between">
        <BrandLogo />
        <Link className="btn-primary" href="/create">Commencer</Link>
      </nav>
      <section className="mx-auto max-w-5xl py-16 text-center">
        <h1 className="text-4xl font-black sm:text-6xl">Des tarifs simples pour lancer vos vidéos.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--text-secondary)]">
          Choisissez une offre ou ajoutez des crédits selon votre volume. Les paiements locaux sont traités par PayDunya en FCFA.
        </p>
        <PaydunyaPaymentNotice />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {billingPlans.map((plan) => (
            <article className="rounded-2xl border border-[var(--border)] bg-white p-6 text-left shadow-soft" key={plan.name}>
              <h2 className="text-2xl font-black">{plan.name}</h2>
              <p className="mt-4 text-3xl font-black text-[var(--primary)]">{plan.priceLabel}</p>
              <p className="mt-2 text-[var(--text-secondary)]">{plan.credits ? `${plan.credits} crédits par mois` : "Volumes élevés"}</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{plan.description}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {["Vidéos immobilières IA", "Stockage temporaire 24 h", "Formats réseaux sociaux"].map((item) => (
                  <li className="flex items-center gap-2" key={item}><Check size={16} className="text-[var(--success)]" /> {item}</li>
                ))}
              </ul>
              {plan.priceXof === null ? (
                <Link className="btn-primary mt-6 w-full justify-center" href="/create">{plan.cta}</Link>
              ) : (
                <PaydunyaPurchaseButton productType="plan" productId={plan.id} label={plan.cta} />
              )}
            </article>
          ))}
        </div>
        <div className="mt-10 rounded-2xl border border-[var(--border)] bg-white p-6 text-left shadow-soft">
          <h2 className="text-2xl font-black">Packs de crédits supplémentaires</h2>
          <p className="mt-2 text-[var(--text-secondary)]">Paiement ponctuel sécurisé par PayDunya.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {creditPacks.map((pack) => (
              <div className="rounded-xl border border-[var(--border)] p-4" key={pack.id}>
                <strong>{pack.name}</strong>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{pack.credits} crédits · {pack.priceLabel}</p>
                <PaydunyaPurchaseButton productType="pack" productId={pack.id} label={`Acheter ${pack.name}`} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
