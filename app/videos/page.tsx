import { Download, RotateCcw } from "lucide-react";
import { DashboardShell } from "@/src/components/dashboard/DashboardShell";
import { demoVideos } from "@/src/config/demo-data";
import Link from "next/link";

const statusClass: Record<string, string> = {
  "En cours": "badge badge-warn",
  Prête: "badge badge-success",
  Expirée: "badge badge-muted",
  Échec: "badge badge-error",
};

export default function VideosPage() {
  return (
    <DashboardShell title="Mes vidéos" subtitle="Les fichiers médias restent temporaires par design.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {demoVideos.map((video) => (
          <article className="video-card" key={video.title}>
            <div className="h-44 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url('${video.thumbnail}')` }} />
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black">{video.title}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {video.city} · {video.date} · {video.format}
                </p>
              </div>
              <span className={statusClass[video.status]}>{video.status}</span>
            </div>
            {video.status === "Expirée" ? (
              <p className="mt-4 rounded-xl bg-[var(--surface-secondary)] p-3 text-sm text-[var(--text-secondary)]">
                Vidéo expirée. Le fichier a été supprimé conformément à notre
                politique de confidentialité.
              </p>
            ) : (
              <div className="mt-4 flex gap-2">
                <button className="btn-secondary min-h-11 flex-1" disabled type="button">
                  <Download size={16} /> Télécharger
                </button>
                <Link className="icon-button" href="/create" aria-label="Créer une nouvelle vidéo">
                  <RotateCcw size={16} />
                </Link>
              </div>
            )}
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
