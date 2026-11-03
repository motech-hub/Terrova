import { DashboardShell } from "@/src/components/dashboard/DashboardShell";
import { CreateWizard } from "@/src/components/create/CreateWizard";

export default function CreatePage() {
  return (
    <DashboardShell
      title="Nouveau projet"
      subtitle="Créez une vidéo immobilière en quelques étapes."
    >
      <CreateWizard />
    </DashboardShell>
  );
}
