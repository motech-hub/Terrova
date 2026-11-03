import Link from "next/link";
import {
  Bell,
  CreditCard,
  Grid2X2,
  LayoutDashboard,
  Menu,
  Plus,
  Settings,
  Video,
} from "lucide-react";
import { BrandLogo } from "@/src/components/shared/BrandLogo";
import { CreditBalance } from "@/src/components/billing/CreditBalance";
import { SignOutButton } from "@/src/components/auth/SignOutButton";
import { getCurrentUser } from "@/src/lib/supabase/server";

const nav = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Nouveau projet", href: "/create", icon: Plus },
  { label: "Mes vidéos", href: "/videos", icon: Video },
  { label: "Modèles", href: "/templates", icon: Grid2X2 },
  { label: "Facturation", href: "/pricing", icon: CreditCard },
  { label: "Paramètres", href: "/settings", icon: Settings },
];

export async function DashboardShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const user = await getCurrentUser();
  const displayName =
    (typeof user?.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    user?.email?.split("@")[0] ||
    "Mon compte";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-4 text-[var(--text-primary)] sm:px-6">
      <div className="mx-auto grid max-w-[1760px] overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-soft lg:grid-cols-[270px_1fr]">
        <aside className="hidden min-h-[calc(100vh-2rem)] border-r border-[var(--border)] bg-[var(--surface-secondary)]/72 p-6 lg:block">
          <BrandLogo />
          <nav className="mt-8 space-y-2">
            {nav.map((item) => (
              <Link className="sidebar-link" href={item.href} key={item.href}>
                <item.icon aria-hidden="true" size={17} />
                {item.label}
              </Link>
            ))}
          </nav>
          {user ? <CreditBalance /> : null}
          {user ? <SignOutButton /> : null}
        </aside>
        <section>
          <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-8">
            <div>
              <button
                className="mb-3 inline-grid size-10 place-items-center rounded-xl border border-[var(--border)] lg:hidden"
                disabled
                type="button"
                aria-label="Ouvrir le menu"
              >
                <Menu size={19} />
              </button>
              <h1 className="text-2xl font-black sm:text-3xl">{title}</h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <button className="grid size-11 place-items-center rounded-full border border-[var(--border)]" aria-label="Notifications" disabled>
                <Bell size={18} />
              </button>
              <span className="grid size-11 place-items-center rounded-full bg-[#424938] text-sm font-bold text-white">
                {initials || "T"}
              </span>
              <span className="hidden text-sm font-semibold sm:inline">{displayName}</span>
            </div>
          </header>
          <div className="p-5 sm:p-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
