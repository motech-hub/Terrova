import { LegalPage } from "@/src/components/shared/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage title="Conditions d'utilisation">
      <p>
        Terrova fournit un outil de création de vidéos immobilières assisté par
        IA. L'utilisateur reste responsable des droits liés aux photos,
        descriptions et biens présentés.
      </p>
      <p>
        Le MVP inclut un mode démonstration lorsque les services externes ne
        sont pas configurés. Les résultats générés par ce mode servent à valider
        le parcours produit.
      </p>
    </LegalPage>
  );
}
