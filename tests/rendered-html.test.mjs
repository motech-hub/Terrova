import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("le build contient les routes backend et les bindings Cloudflare", async () => {
  const serverBundle = await readFile("dist/server/index.js", "utf8");
  const workerConfig = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));

  assert.match(serverBundle, /api\/generations/);
  assert.match(serverBundle, /openrouter-video-provider/);
  assert.equal(workerConfig.d1_databases[0].binding, "DB");
  assert.equal(workerConfig.r2_buckets[0].binding, "MEDIA");
  assert.equal(workerConfig.workflows[0].binding, "GENERATION_WORKFLOW");
});

test("la migration D1 contient uniquement les métadonnées attendues", async () => {
  const migration = await readFile("db/migrations/0001_generation_jobs.sql", "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS generation_jobs/);
  assert.match(migration, /input_json TEXT NOT NULL/);
  assert.doesNotMatch(migration, /api[_-]?key|secret|prompt/i);
});

test("le moteur agentique isole le SDK OpenAI du navigateur et du Worker", async () => {
  const provider = await readFile("src/lib/ai/ai-provider.ts", "utf8");
  const client = await readFile("src/lib/agents/agent-runner-client.ts", "utf8");
  const engine = await readFile("src/lib/agents/agentic-video-plan.ts", "utf8");
  const migration = await readFile("db/migrations/0005_agentic_engine.sql", "utf8");
  const runnerPackage = await readFile("services/agent-runner/pyproject.toml", "utf8");
  const runner = await readFile("services/agent-runner/src/terrova_agent_runner/agents.py", "utf8");

  assert.match(provider, /prepareAgenticVideoPrompt/);
  assert.match(client, /x-terrova-agent-secret/);
  assert.match(client, /AGENT_RUNNER_SHARED_SECRET/);
  assert.doesNotMatch(client, /OPENAI_API_KEY/);
  assert.match(runnerPackage, /openai-agents/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS agent_runs/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS agent_artifacts/);
  assert.doesNotMatch(migration, /api[_-]?key|secret|signed.*url/i);
  assert.match(engine, /normalizeGenerationPlan/);
  assert.match(engine, /trace_\$\{crypto\.randomUUID\(\)\.replace\(\/-\/g, ""\)\}/);
  assert.match(runner, /trace_include_sensitive_data=False/);
  assert.match(runner, /trace_id=request\.trace_id/);
  assert.match(runner, /task_instructions/);
  assert.doesNotMatch(runner, /Contexte de tâche structuré/);
});

test("PayDunya utilise WebPay avec vérification serveur et IPN signé", async () => {
  const provider = await readFile("src/lib/payments/paydunya.ts", "utf8");
  const checkout = await readFile("app/api/payments/paydunya/checkout/route.ts", "utf8");
  const ipn = await readFile("app/api/payments/paydunya/ipn/route.ts", "utf8");
  const proxy = await readFile("proxy.ts", "utf8");

  assert.match(provider, /checkout-invoice\/create/);
  assert.match(provider, /checkout-invoice\/confirm/);
  assert.match(provider, /PAYDUNYA-MASTER-KEY/);
  assert.match(provider, /PaydunyaApiError/);
  assert.match(provider, /SHA-512/);
  assert.match(provider, /app\.paydunya\.com/);
  assert.match(provider, /paydunya\.com/);
  assert.match(provider, /PAYDUNYA_CHECKOUT_HOSTS/);
  assert.match(provider, /TEST_PAYDUNYA/);
  assert.match(provider, /testLabel/);
  assert.match(provider, /isTestMode/);
  assert.match(checkout, /getPurchasableProduct/);
  assert.match(checkout, /diagnostic/);
  assert.match(ipn, /verifyPaydunyaHash/);
  assert.match(ipn, /confirmPaydunyaInvoice/);
  assert.match(ipn, /reconcilePaydunyaPayment/);
  assert.match(proxy, /api\/payments\/paydunya\/ipn/);
  assert.match(proxy, /api\/payments\/paydunya\/return/);
});

test("les paiements PayDunya sont idempotents et ne créditent qu'une commande confirmée", async () => {
  const migration = await readFile("supabase/migrations/202609030001_payments.sql", "utf8");
  const d1Migration = await readFile("db/migrations/0004_payments.sql", "utf8");
  const store = await readFile("src/lib/payments/payment-store.ts", "utf8");

  assert.match(migration, /create table if not exists public\.orders/);
  assert.match(migration, /create table if not exists public\.payments/);
  assert.match(migration, /unique \(provider, provider_token\)/);
  assert.match(migration, /PAYMENT_AMOUNT_MISMATCH/);
  assert.match(migration, /entry_type = 'purchase'/);
  assert.match(d1Migration, /CREATE TABLE IF NOT EXISTS orders/);
  assert.match(d1Migration, /CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_token_idx/);
  assert.match(store, /grantPurchasedCredits/);
});

test("le coût de génération utilise le tarif local de Seedance 2.0 Mini", async () => {
  const provider = await readFile("src/lib/video/openrouter-video-provider.ts", "utf8");
  const billing = await readFile("src/config/billing.ts", "utf8");
  const wizard = await readFile("src/components/create/CreateWizard.tsx", "utf8");
  const generation = await readFile("app/api/generations/route.ts", "utf8");
  const docs = await readFile("docs/credit-billing-plan.md", "utf8");

  assert.match(provider, /provider: "demo",/);
  assert.match(provider, /terrovaCredits: calculateTerrovaCredits\(input\.video\.duration, 2\)/);
  assert.match(billing, /"bytedance\/seedance-2\.0-mini":/);
  assert.match(billing, /providerCostPerSecondUsd: 0\.03024/);
  assert.match(billing, /terrovaCreditsPerSecond: 2/);
  assert.match(billing, /priceXof: 5_000, priceLabel: "5 000 FCFA", credits: 60/);
  assert.match(billing, /priceXof: 10_000, priceLabel: "10 000 FCFA", credits: 200/);
  assert.match(billing, /Math\.ceil\(durationSeconds \* creditsPerSecond\)/);
  assert.match(provider, /getOpenRouterVideoPricing/);
  assert.match(provider, /terrovaCredits: calculateTerrovaCredits\(input\.video\.duration, pricing\.terrovaCreditsPerSecond\)/);
  assert.match(docs, /5 secondes = 0,1512 USD et 10 crédits/);
  assert.match(docs, /10 secondes = 0,3024 USD et 20 crédits/);
  assert.match(docs, /15 secondes = 0,4536 USD et 30 crédits/);
  assert.doesNotMatch(wizard, /Exemples Hailuo 3 Max/);
  assert.match(generation, /Le tarif du modèle vidéo est requis/);
  assert.doesNotMatch(docs, /coût provisoire|valeur provisoire/i);
});

test("le provider vidéo respecte le contrat OpenRouter et garde les URLs protégées côté serveur", async () => {
  const provider = await readFile("src/lib/video/openrouter-video-provider.ts", "utf8");
  const env = await readFile(".env.example", "utf8");
  const activeFiles = await Promise.all([
    readFile("app/api/generations/route.ts", "utf8"),
    readFile("app/api/generations/estimate/route.ts", "utf8"),
    readFile("app/api/generations/[jobId]/route.ts", "utf8"),
    readFile("src/lib/workflows/generation-workflow.ts", "utf8"),
  ]);

  assert.match(env, /OPENROUTER_VIDEO_MODEL=bytedance\/seedance-2\.0-mini/);
  assert.match(env, /OPENROUTER_VIDEO_RESOLUTION=720p/);
  assert.match(provider, /input_references: images/);
  assert.match(provider, /polling_url/);
  assert.match(provider, /unsigned_urls/);
  assert.match(provider, /videoDownloadHeaders: headers\(\)/);
  assert.match(provider, /Authorization: `Bearer \$\{env\.OPENROUTER_API_KEY\}`/);
  assert.doesNotMatch(activeFiles.join("\n"), /higgsfield|HIGGSFIELD|Higgsfield/);
});

test("les modèles appliquent leurs réglages et utilisent des visuels locaux distincts", async () => {
  const templates = await readFile("src/config/templates.ts", "utf8");
  const wizard = await readFile("src/components/create/CreateWizard.tsx", "utf8");
  const demoData = await readFile("src/config/demo-data.ts", "utf8");
  const home = await readFile("app/page.tsx", "utf8");

  assert.match(wizard, /useSearchParams/);
  assert.match(wizard, /setSelectedTemplate\(template\)/);
  assert.match(wizard, /templateInstructions: selectedTemplate\?\.instructions/);
  assert.match(templates, /template-villa-premium\.png/);
  assert.match(templates, /template-terrain-projet\.png/);
  assert.doesNotMatch(`${demoData}\n${home}`, /images\.unsplash\.com/);
});

test("le parcours invité demande l'authentification uniquement au lancement", async () => {
  const proxy = await readFile("proxy.ts", "utf8");
  const serverAuth = await readFile("src/lib/supabase/server.ts", "utf8");
  const wizard = await readFile("src/components/create/CreateWizard.tsx", "utf8");
  const generation = await readFile("app/api/generations/route.ts", "utf8");
  const upload = await readFile("app/api/uploads/presign/route.ts", "utf8");
  const guestSessionRoute = await readFile("app/api/guest-session/route.ts", "utf8");
  const guestSession = await readFile("src/lib/guest-session.ts", "utf8");
  const paymentButton = await readFile("src/components/billing/PaydunyaPurchaseButton.tsx", "utf8");
  const paymentCheckout = await readFile("app/api/payments/paydunya/checkout/route.ts", "utf8");
  const paymentReturn = await readFile("app/api/payments/paydunya/return/route.ts", "utf8");

  assert.doesNotMatch(proxy, /protectedPrefixes = \[[^\]]*"\/create"/);
  assert.match(proxy, /guestCreationApiPaths/);
  assert.match(serverAuth, /allowGuest\?: boolean/);
  assert.match(wizard, /generationDraftStorageKey/);
  assert.match(wizard, /localStorage\.setItem\(generationDraftStorageKey/);
  assert.match(wizard, /resume=generation/);
  assert.match(wizard, /guestSessionId \?\? getSessionId\(\)/);
  assert.match(wizard, /CreditPurchaseDialog/);
  assert.match(wizard, /Votre vidéo consommera/);
  assert.match(generation, /guestSessionId/);
  assert.match(upload, /createGuestSessionToken/);
  assert.match(upload, /getVerifiedGuestSessionId/);
  assert.match(upload, /guestSessionId \?\? user\?\.id/);
  assert.match(upload, /requestedSessionId === verifiedGuestSessionId/);
  assert.match(generation, /assertAnySessionOwnsTempKey/);
  assert.match(wizard, /isAuthenticated = Boolean\(data\.user\)/);
  assert.match(wizard, /AuthSessionMissingError/);
  assert.match(wizard, /if \(data\.user\) \{\s+await launchGeneration\(\);/);
  assert.match(wizard, /response\.status === 402/);
  assert.match(guestSessionRoute, /crypto\.randomUUID/);
  assert.match(wizard, /\/api\/guest-session/);
  assert.match(guestSession, /verifyGuestSessionCookie/);
  assert.match(guestSession, /GUEST_SESSION_SECRET est requis/);
  assert.match(wizard, /paymentStatus !== "completed"/);
  assert.match(paymentButton, /returnTo/);
  assert.match(paymentButton, /resumePayment/);
  assert.match(paymentButton, /autoResumeStartedRef/);
  assert.match(paymentButton, /returnTo\?: string/);
  assert.match(paymentCheckout, /buildReturnUrl/);
  assert.match(paymentReturn, /safeNextPath/);
});
