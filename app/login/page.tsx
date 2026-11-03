import { Suspense } from "react";
import { BrandLogo } from "@/src/components/shared/BrandLogo";
import { AuthForm } from "@/src/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-6 text-[var(--text-primary)] sm:px-8">
      <div className="mx-auto max-w-[1760px]">
        <BrandLogo />
        <div className="grid min-h-[calc(100vh-110px)] place-items-center py-10">
          <Suspense fallback={<div className="h-[520px] w-full max-w-md rounded-[28px] border border-[var(--border)] bg-[var(--surface)]" />}>
            <AuthForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
