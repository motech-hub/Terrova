import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DashboardShell } from "@/src/components/dashboard/DashboardShell";
import { templateImages, templates } from "@/src/config/templates";

export default function TemplatesPage() {
  return (
    <DashboardShell title="Modèles" subtitle="Des points de départ adaptés aux annonces immobilières.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-soft" key={template.id}>
            <div
              aria-hidden="true"
              className="h-44 rounded-xl bg-cover bg-center"
              style={{ backgroundImage: `url('${templateImages[template.id]}')` }}
            />
            <p className="text-sm font-bold uppercase text-[var(--primary)]">{template.ratio} · {template.duration} sec</p>
            <h2 className="mt-3 text-xl font-black">{template.name}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{template.description}</p>
            <p className="mt-4 rounded-xl bg-[var(--surface-secondary)] p-3 text-sm text-[var(--text-secondary)]">{template.instructions}</p>
            <Link className="btn-primary mt-5 w-full justify-center" href={`/create?template=${template.id}`}>
              Utiliser ce modèle <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
