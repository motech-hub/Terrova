import Link from "next/link";
import { ArrowRight, Film, Plus } from "lucide-react";
import { DashboardShell } from "@/src/components/dashboard/DashboardShell";
import { CreditBalance } from "@/src/components/billing/CreditBalance";
import { demoVideos } from "@/src/config/demo-data";

export default function DashboardPage() {
  return (
    <DashboardShell title="Bonjour" subtitle="Vos projets vidéo immobiliers au même endroit.">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-6">
          <h2 className="text-2xl font-black">Créer une nouvelle vidéo</h2>
          <p className="mt-3 max-w-xl text-[var(--text-secondary)]">
            Ajoutez vos photos, décrivez le bien et laissez Terrova préparer une
            vidéo professionnelle pour vos annonces.
          </p>
          <Link className="btn-primary mt-6 inline-flex" href="/create">
            <Plus size={18} /> Nouveau projet
          </Link>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="metric-card">
            <Film className="text-[var(--primary)]" />
            <span>Vidéos créées</span>
            <strong>8</strong>
          </div>
          <CreditBalance variant="metric" />
        </section>
      </div>
      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black">Créations récentes</h2>
          <Link className="inline-flex items-center gap-2 text-sm font-bold text-[var(--primary)]" href="/videos">
            Voir tout <ArrowRight size={16} />
          </Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {demoVideos.slice(0, 3).map((video) => (
            <article className="video-card" key={video.title}>
              <div className="h-36 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url('${video.thumbnail}')` }} />
              <strong className="mt-4 block">{video.title}</strong>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{video.city} · {video.format}</p>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
