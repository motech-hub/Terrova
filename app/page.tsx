import Link from "next/link";
import {
  ArrowRight,
  Check,
  Download,
  Home,
  Play,
  ShieldCheck,
  Smartphone,
  Timer,
} from "lucide-react";
import { BrandLogo } from "@/src/components/shared/BrandLogo";
import { demoVideos } from "@/src/config/demo-data";

const footerColumns = [
  {
    title: "Produit",
    links: [
      { label: "Créer une vidéo", href: "/create" },
      { label: "Mes vidéos", href: "/videos" },
      { label: "Modèles", href: "/templates" },
      { label: "Tarifs", href: "/pricing" },
    ],
  },
  {
    title: "Découvrir",
    links: [
      { label: "Fonctionnalités", href: "#fonctionnalites" },
      { label: "Exemple de projet", href: "#exemples" },
      { label: "Se connecter", href: "/login" },
      { label: "Nous contacter", href: "mailto:bonjour@terrova.app" },
    ],
  },
  {
    title: "Informations",
    links: [
      { label: "Confidentialité", href: "/privacy" },
      { label: "Conditions d'utilisation", href: "/terms" },
      { label: "Accueil", href: "#accueil" },
    ],
  },
];

const navigationLinks = [
  { label: "Accueil", href: "#accueil" },
  { label: "Fonctionnalités", href: "#fonctionnalites" },
  { label: "Exemples", href: "#exemples" },
  { label: "Tarifs", href: "/pricing" },
  { label: "Contact", href: "mailto:bonjour@terrova.app" },
];

const features = [
  {
    icon: Home,
    title: "Spécialisé immobilier",
    text: "Appartements, maisons, villas, terrains.",
  },
  {
    icon: Timer,
    title: "Rapide & simple",
    text: "Quelques photos, une idée, une vidéo prête.",
  },
  {
    icon: Smartphone,
    title: "Pensé pour l'Afrique",
    text: "Idéal pour agences, promoteurs et propriétaires.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]" id="accueil">
      <nav className="mx-auto flex max-w-[1760px] items-center justify-between px-5 py-6 sm:px-8 xl:px-10">
        <BrandLogo />
        <div className="hidden items-center gap-8 text-sm font-medium lg:flex">
          {navigationLinks.map(
            (item, index) => (
              <Link
                className={`nav-link ${index === 0 ? "nav-link-active" : ""}`}
                href={item.href}
                key={item.label}
              >
                {item.label}
              </Link>
            ),
          )}
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Link className="hidden px-3 py-2 sm:inline-flex" href="/login">
            Se connecter
          </Link>
          <Link className="btn-primary" href="/create">
            Commencer
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-[1760px] gap-10 px-5 pb-8 pt-8 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pb-10 lg:pt-12 xl:px-10" id="fonctionnalites">
        <div>
          <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-normal sm:text-6xl lg:text-7xl">
            Vos biens.
            <span className="mt-2 block text-[var(--primary)]">
              En vidéo. Envie d'acheteurs.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[var(--text-primary)] sm:text-xl">
            Terrova transforme vos photos d'appartements et de maisons en vidéos
            immobilières professionnelles avec l'IA. Rapide, simple, efficace.
          </p>

          <div className="mt-9 grid gap-5 sm:grid-cols-3">
            {features.map((feature) => (
              <div className="flex gap-4" key={feature.title}>
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <feature.icon aria-hidden="true" size={23} />
                </span>
                <span>
                  <strong className="block text-sm">{feature.title}</strong>
                  <span className="mt-2 block text-sm leading-6">{feature.text}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link className="btn-primary min-h-14 px-7 text-base" href="/create">
              Créer ma première vidéo
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link className="btn-secondary min-h-14 px-7 text-base" href="/videos">
              <Play aria-hidden="true" size={16} fill="currentColor" />
              Voir un exemple
            </Link>
          </div>

          <p className="mt-5 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <ShieldCheck aria-hidden="true" size={17} />
            Vos photos sont sécurisées et supprimées automatiquement après 24 h.
          </p>
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-[28px] border border-white/70 bg-[var(--surface-secondary)] shadow-[0_24px_70px_rgba(25,36,28,0.16)] lg:min-h-[430px]">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(250,249,245,0.08),rgba(24,92,55,0.08)),url('/images/terrova-hero-villa-dakar.png')] bg-cover bg-center" />
          <div className="absolute right-6 top-6 flex max-w-[310px] items-center gap-4 rounded-2xl bg-white/88 p-5 shadow-soft backdrop-blur">
            <span className="text-5xl leading-none text-[#8aa37e]">▰</span>
            <span>
              <strong className="block">Fait pour l'Afrique</strong>
              <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">
                D'abord le Sénégal, l'Afrique de l'Ouest et l'Afrique.
              </span>
            </span>
          </div>
          <div className="absolute bottom-6 left-1/2 w-[88%] -translate-x-1/2 rounded-2xl bg-white/92 p-4 shadow-soft backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex gap-2">
                {demoVideos.slice(0, 3).map((video) => (
                  <span
                    className="h-20 w-24 rounded-xl bg-cover bg-center"
                    key={video.title}
                    style={{
                      backgroundImage: `url('${video.thumbnail}')`,
                    }}
                  />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <strong>Vidéo générée</strong>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Maison moderne à Dakar
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm font-medium text-[var(--success)]">
                  <Check aria-hidden="true" size={15} /> Prête à télécharger
                </p>
              </div>
              <Link
                aria-label="Télécharger l'exemple"
                className="grid size-12 place-items-center rounded-full bg-white shadow-soft"
                href="/videos"
              >
                <Download aria-hidden="true" size={20} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1760px] px-5 pb-16 sm:px-8 xl:px-10" id="exemples">
        <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-soft">
          <div className="grid min-h-[420px] lg:grid-cols-[260px_1fr]">
            <aside className="hidden border-r border-[var(--border)] bg-[var(--surface-secondary)]/65 p-6 lg:block">
              <BrandLogo />
              <div className="mt-8 space-y-2 text-sm">
                {["Tableau de bord", "Nouveau projet", "Mes vidéos", "Modèles", "Facturation", "Paramètres"].map(
                  (item, index) => (
                    <div
                      className={`rounded-xl px-4 py-3 ${index === 0 ? "bg-[#ece9df]" : ""}`}
                      key={item}
                    >
                      {item}
                    </div>
                  ),
                )}
              </div>
              <div className="mt-14 rounded-xl bg-[#f1efe7] p-4 text-sm">
                <strong>120 crédits restants</strong>
                <p className="mt-2 text-[var(--text-secondary)]">Plan Starter</p>
                <div className="mt-3 h-px bg-[var(--border)]" />
                <Link className="mt-3 block w-full rounded-lg bg-white px-3 py-2 text-center font-semibold" href="/pricing">
                  Mettre à niveau
                </Link>
              </div>
            </aside>
            <div>
              <div className="border-b border-[var(--border)] px-6 py-5">
                <h2 className="text-2xl font-bold">Nouveau projet</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Créez une vidéo immobilière en quelques étapes.
                </p>
              </div>
              <div className="p-6">
                <div className="grid gap-4 md:grid-cols-4">
                  {["Photos", "Description", "Style & format", "Génération"].map(
                    (step, index) => (
                      <div className="flex items-center gap-3" key={step}>
                        <span
                          className={`grid size-8 place-items-center rounded-full text-sm font-semibold ${
                            index === 0
                              ? "bg-[#7ca365] text-white"
                              : "bg-[#dedbd2] text-[var(--text-primary)]"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span>
                          <strong className="block text-sm">{step}</strong>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {index === 0 ? "Ajoutez vos photos" : "Préparez la vidéo"}
                          </span>
                        </span>
                      </div>
                    ),
                  )}
                </div>
                <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_340px]">
                  <div className="rounded-2xl border border-[var(--border)] p-5">
                    <h3 className="font-bold">1. Ajoutez vos photos</h3>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Glissez-déposez ou sélectionnez jusqu'à 10 photos.
                    </p>
                    <div className="mt-5 grid gap-4 md:grid-cols-[240px_1fr]">
                      <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-[#d2cec2] text-center">
                        <div>
                          <Home className="mx-auto text-[var(--primary)]" />
                          <p className="mt-2">Glissez vos photos ici</p>
                          <Link className="mt-3 inline-flex rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" href="/create">
                            Sélectionner des photos
                          </Link>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {demoVideos.map((video, index) => (
                          <span
                            className="min-h-28 rounded-xl bg-cover bg-center"
                            key={video.title}
                            style={{
                              backgroundImage: `url('${video.thumbnail}')`,
                            }}
                          >
                            {index === 3 ? (
                              <span className="grid h-full place-items-center rounded-xl bg-black/35 text-2xl font-bold text-white">
                                +6
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] p-5">
                    <h3 className="font-bold">Aperçu du projet</h3>
                    <div className="mt-4 grid min-h-44 place-items-center rounded-xl bg-[var(--surface-secondary)] text-center">
                      <div>
                        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#d9d4c8] text-white">
                          <Play fill="currentColor" />
                        </span>
                        <p className="mt-5 text-sm">La vidéo apparaîtra ici</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          après la génération.
                        </p>
                      </div>
                    </div>
                    <Link className="btn-primary mt-5 w-full justify-center" href="/create">
                      Suivant <ArrowRight size={17} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1760px] px-5 pb-20 sm:px-8 xl:px-10">
        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--primary)] px-6 py-8 text-white sm:px-10 sm:py-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#b9d2b7]">Prêt à publier votre prochain bien ?</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Donnez à chaque annonce la place qu'elle mérite.</h2>
          </div>
          <Link className="mt-6 w-full border-white/20 bg-white text-[var(--primary)] hover:bg-[#f4f3ed] lg:mt-0 lg:w-auto" href="/create">
            Commencer maintenant <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-[1760px] gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_2fr] xl:px-10">
          <div className="max-w-sm">
            <BrandLogo />
            <p className="mt-5 text-sm leading-7 text-[var(--text-secondary)]">
              Terrova transforme les photos de vos biens en vidéos immobilières professionnelles, pensées pour vendre et louer en Afrique.
            </p>
            <p className="mt-5 text-sm font-semibold text-[var(--text-primary)]">Dakar · Sénégal</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h2 className="text-sm font-black">{column.title}</h2>
                <nav aria-label={column.title} className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <Link className="footer-link" href={link.href} key={link.label}>{link.label}</Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-[var(--border)]">
          <div className="mx-auto flex max-w-[1760px] flex-col gap-2 px-5 py-5 text-xs text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between sm:px-8 xl:px-10">
            <span>© {new Date().getFullYear()} Terrova. Tous droits réservés.</span>
            <span>Vos biens. En vidéo. Envie d'acheteurs.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
