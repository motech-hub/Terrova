# Authentification Supabase

Terrova utilise Supabase Auth pour Google et les magic links. Les photos et vidéos restent stockées temporairement dans Cloudflare R2.

## Variables locales

Copie `.env.example` vers `.env.local`, puis renseigne :

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Ne mets jamais une clé secrète Supabase dans une variable `NEXT_PUBLIC_*` ni dans le dépôt.

## Configuration Supabase

Dans Supabase :

1. Active le provider Google dans Authentication → Providers.
2. Configure l’URL de callback Google affichée par Supabase :

   `https://<project-ref>.supabase.co/auth/v1/callback`

3. Dans Authentication → URL Configuration, ajoute :

   - `http://localhost:3000/auth/callback`
   - l’URL de production suivie de `/auth/callback`

4. Active l’authentification par email et configure un expéditeur SMTP pour la production.

L’écran `/login` utilise Google OAuth et `signInWithOtp` pour envoyer les magic links. La route `/auth/callback` échange le code PKCE contre une session stockée dans des cookies.

## Sécurité

Quand Supabase est configuré, le proxy protège `/dashboard`, `/create`, `/videos` et toutes les routes `/api`. Les routes métier dérivent l’identité depuis la session Supabase et ignorent le `sessionId` envoyé par le client.

Le `sessionId` reste accepté uniquement comme repli de démonstration quand les variables Supabase sont absentes en local. Il ne doit pas être utilisé en production.

## Prochaine étape : Postgres

Les tables D1 actuelles (`generation_jobs`, `credit_wallets`, `credit_ledger`) doivent être migrées vers Supabase Postgres et recevoir une colonne `user_id` avec des politiques RLS. Cette migration est distincte de l’authentification afin de pouvoir valider d’abord le parcours de connexion.
