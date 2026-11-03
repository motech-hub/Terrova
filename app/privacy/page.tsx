import { LegalPage } from "@/src/components/shared/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage title="Confidentialité">
      <p>
        Terrova est conçu pour éviter la conservation permanente des photos et
        vidéos dans son infrastructure applicative. Les médias sont destinés à
        être stockés temporairement dans Cloudflare R2, puis supprimés
        automatiquement selon une règle de cycle de vie.
      </p>
      <p>
        Les serveurs manipulent des clés d'objet, des identifiants de génération
        et des URLs temporaires. Les identifiants secrets, URLs signées et
        fichiers médias ne doivent pas être journalisés.
      </p>
    </LegalPage>
  );
}
