import Link from "next/link";
import { Home } from "lucide-react";

export function BrandLogo() {
  return (
    <Link
      className="inline-flex items-center gap-2 text-2xl font-black text-[var(--primary)]"
      href="/"
    >
      <Home aria-hidden="true" className="size-8" strokeWidth={2.2} />
      <span>Terrova</span>
    </Link>
  );
}
