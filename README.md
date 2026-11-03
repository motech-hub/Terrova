# Terrova

Terrova is a full-stack AI video creation app for real-estate listings. Users add property photos, describe the property, choose a visual direction, and follow a video-generation job from planning through delivery.

The product UI is in French and is designed for real-estate professionals in Senegal and West Africa. This repository is a portfolio project; production use requires the external services and credentials described below.

## What it demonstrates

- A Next.js App Router interface and TypeScript API running with Vinext and Cloudflare Workers.
- Direct, signed photo uploads to Cloudflare R2 and asynchronous generation jobs coordinated by Cloudflare Workflows.
- A server-side scene-planning adapter for Gemini or Claude and a provider adapter for video generation through OpenRouter.
- An optional Python agent runner using the OpenAI Agents SDK. It creates validated planning and review artifacts and keeps agent permissions bounded.
- D1/Supabase persistence, guest-session support, credit estimates, and PayDunya WebPay checkout flows.
- A demo mode that keeps the core product flow available when provider credentials are not configured.

## Architecture

```text
Browser
  └─ Terrova web app (Next.js / TypeScript on Cloudflare Workers)
       ├─ Supabase authentication and application data
       ├─ D1 job state ── Cloudflare Workflow ── OpenRouter video provider
       ├─ R2 temporary photo and video objects
       ├─ Gemini or Claude scene planning
       └─ Optional private Python agent runner (OpenAI Agents SDK)
```

The Worker owns authentication, authorization, job state, and provider calls. The browser receives short-lived upload or playback URLs. The optional agent runner is called server-to-server and is not exposed to the browser.

## Run locally

Requirements: Node.js 22.13 or newer. The optional agent runner requires Python 3.10 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by the development server. Without provider credentials, the app uses demo behavior where available. A successful local build does not configure Cloudflare, Supabase, payment, or model-provider accounts.

## Configuration

Start with `.env.example`. Set only the services you intend to exercise:

- **AI planning:** Gemini or Claude credentials and model settings.
- **Video generation:** OpenRouter API key and video model.
- **Media storage:** Cloudflare R2 account, bucket, and endpoint.
- **Persistence and login:** Supabase settings; D1 is used for Cloudflare job state.
- **Payments:** PayDunya test keys and callback URLs.
- **Agent runner:** enable the feature flag and configure a private runner URL plus a shared secret on both services.

Never commit `.env.local`, provider credentials, signed media URLs, or real user photos and videos. Keep the agent runner private and use a unique secret between it and the Worker.

## Multi-agent planning runner

The optional runner lives in [`services/agent-runner`](services/agent-runner/). It contains an orchestrator, video planner, plan reviewer, and plan fixer. Agents exchange schema-validated artifacts; they do not receive shell, browser, payment, database, or provider-secret access. The review-and-fix loop is bounded and can stop for human review.

See [`docs/agentic-engine.md`](docs/agentic-engine.md) for its contract and deployment notes. Configure and deploy the runner separately before enabling the feature flag.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```

`npm test` builds the app and runs the rendered-HTML tests. The Python runner has a separate test suite in `services/agent-runner/tests`.

## API examples

The [`examples`](examples/) folder contains local HTTP requests for scene planning, cost estimation, and starting a generation. They use a synthetic session and object key; they do not include credentials or real media. The examples assume demo-mode configuration unless noted.

## Deployment notes

Cloudflare bindings, D1 migrations, R2 CORS and lifecycle rules, Supabase configuration, PayDunya callbacks, and provider credentials must be configured for the target environment. Start with [`docs/cloudflare-deploy.md`](docs/cloudflare-deploy.md) and [`docs/backend-api.md`](docs/backend-api.md). Payment and external provider flows must be tested in their respective sandbox environments before production use.

The implementation notes under `docs/` are currently in French; the API requests in [`examples/`](examples/) are in English.

## Privacy and current limits

The app is designed to keep uploaded media in temporary R2 paths and store job metadata separately. Production retention depends on the configured R2 lifecycle policy. Do not use real customer media in a public demo without permission.

Live generation, payment callbacks, and the agent runner need external credentials and cloud configuration. The repository does not include those credentials or claim that production services are configured.

## License

No license file is included. The code and assets are published for portfolio review; contact the repository owner before reusing or redistributing them.
