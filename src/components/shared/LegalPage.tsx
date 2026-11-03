import Link from "next/link";
import { BrandLogo } from "@/src/components/shared/BrandLogo";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-6 sm:px-8">
      <nav className="mx-auto flex max-w-5xl items-center justify-between">
        <BrandLogo />
        <Link className="btn-secondary" href="/">Accueil</Link>
      </nav>
      <article className="prose-terrova mx-auto mt-14 max-w-3xl rounded-2xl border border-[var(--border)] bg-white p-7 shadow-soft">
        <h1>{title}</h1>
        {children}
      </article>
    </main>
  );
}
