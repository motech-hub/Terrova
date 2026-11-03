# Local API examples

These requests use a synthetic UUID and object key. They do not contain real photos, credentials, or signed URLs.

The scene-planning and estimate requests can be exercised in demo mode. Starting a real generation additionally requires a configured video provider, a workflow runtime, and (when enabled) a valid account and credit balance. In a Supabase-backed setup, guest requests also need the signed guest-session cookie issued by the app.

Replace the example `image.key` with a key returned by Terrova's upload flow. The API checks that the key belongs to the requesting session.

- [`generation-plan.http`](generation-plan.http): prepare a structured scene plan.
- [`estimate.http`](estimate.http): estimate provider cost and Terrova credits.
- [`start-generation.http`](start-generation.http): start a job and poll its status.
