import { DashboardShell } from "@/src/components/dashboard/DashboardShell";
import { SettingsForm } from "@/src/components/settings/SettingsForm";
import { getCurrentUser } from "@/src/lib/supabase/server";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const fullName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";

  return (
    <DashboardShell title="Paramètres" subtitle="Votre compte, vos préférences et vos notifications.">
      <SettingsForm initialName={fullName} email={user?.email ?? ""} isDemo={!user} />
    </DashboardShell>
  );
}
