import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const stringToBoolean = (value: unknown) => {
  if (value === undefined || value === "") return undefined;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return value;
};

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  SUPABASE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  GUEST_SESSION_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  PAYDUNYA_MODE: z.preprocess(emptyToUndefined, z.enum(["test", "live"]).default("test")),
  PAYDUNYA_MASTER_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  PAYDUNYA_PRIVATE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  PAYDUNYA_PUBLIC_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  PAYDUNYA_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  PAYDUNYA_API_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  PAYDUNYA_RETURN_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  PAYDUNYA_CANCEL_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  PAYDUNYA_CALLBACK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  PAYDUNYA_STORE_NAME: z.preprocess(emptyToUndefined, z.string().default("Terrova")),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
  MAKE_GENERATE_WEBHOOK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  MAKE_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_GENAI_USE_ENTERPRISE: z.preprocess(stringToBoolean, z.boolean().default(false)),
  GOOGLE_CLOUD_PROJECT: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CLOUD_LOCATION: z.preprocess(emptyToUndefined, z.string().default("global")),
  GEMINI_MODEL: z.preprocess(emptyToUndefined, z.string().default("gemini-2.5-flash")),
  GEMINI_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default("https://generativelanguage.googleapis.com"),
  ),
  GEMINI_ENTERPRISE_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default("https://aiplatform.googleapis.com"),
  ),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  CLAUDE_MODEL: z.preprocess(emptyToUndefined, z.string().default("claude-sonnet-4-20250514")),
  ANTHROPIC_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default("https://api.anthropic.com"),
  ),
  AI_PRIMARY_PROVIDER: z.enum(["gemini", "claude"]).default("gemini"),
  AI_ALLOW_FALLBACK: z.preprocess(stringToBoolean, z.boolean().default(true)),
  AGENTIC_VIDEO_PLANNING_ENABLED: z.preprocess(stringToBoolean, z.boolean().default(false)),
  AGENT_RUNNER_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  AGENT_RUNNER_SHARED_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  OPENROUTER_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  OPENROUTER_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default("https://openrouter.ai/api/v1"),
  ),
  OPENROUTER_VIDEO_MODEL: z.preprocess(
    emptyToUndefined,
    z.string().default("bytedance/seedance-2.0-mini"),
  ),
  OPENROUTER_VIDEO_RESOLUTION: z.preprocess(
    emptyToUndefined,
    z.string().default("720p"),
  ),
  OPENROUTER_HTTP_REFERER: z.preprocess(emptyToUndefined, z.string().url().optional()),
  OPENROUTER_APP_TITLE: z.preprocess(emptyToUndefined, z.string().default("Terrova")),
  GENERATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(36),
  GENERATION_POLL_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(300).default(10),
});

export function getEnv() {
  return envSchema.parse(process.env);
}

export function getSupabaseConfig() {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return null;
  }

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function hasR2Config() {
  const env = getEnv();
  return Boolean(
    env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME &&
      (env.R2_ENDPOINT || env.R2_ACCOUNT_ID),
  );
}

export function hasMakeConfig() {
  const env = getEnv();
  return Boolean(env.MAKE_GENERATE_WEBHOOK_URL);
}

export function hasGeminiConfig() {
  const env = getEnv();
  return Boolean(env.GOOGLE_API_KEY);
}

export function hasClaudeConfig() {
  return Boolean(getEnv().ANTHROPIC_API_KEY);
}

export function hasOpenRouterConfig() {
  const env = getEnv();
  return Boolean(env.OPENROUTER_API_KEY);
}

export function hasAgentRunnerConfig() {
  const env = getEnv();
  return Boolean(
    env.AGENTIC_VIDEO_PLANNING_ENABLED &&
      env.AGENT_RUNNER_URL &&
      env.AGENT_RUNNER_SHARED_SECRET,
  );
}

export function getPaydunyaConfig() {
  const env = getEnv();
  if (!env.PAYDUNYA_MASTER_KEY || !env.PAYDUNYA_PRIVATE_KEY || !env.PAYDUNYA_TOKEN) return null;

  const defaultBaseUrl = env.PAYDUNYA_MODE === "live"
    ? "https://app.paydunya.com/api"
    : "https://app.paydunya.com/sandbox-api";

  return {
    mode: env.PAYDUNYA_MODE,
    masterKey: env.PAYDUNYA_MASTER_KEY,
    privateKey: env.PAYDUNYA_PRIVATE_KEY,
    publicKey: env.PAYDUNYA_PUBLIC_KEY,
    token: env.PAYDUNYA_TOKEN,
    apiBaseUrl: env.PAYDUNYA_API_BASE_URL ?? defaultBaseUrl,
    returnUrl: env.PAYDUNYA_RETURN_URL ?? new URL("/api/payments/paydunya/return", env.NEXT_PUBLIC_APP_URL).toString(),
    cancelUrl: env.PAYDUNYA_CANCEL_URL ?? new URL("/api/payments/paydunya/return", env.NEXT_PUBLIC_APP_URL).toString(),
    callbackUrl: env.PAYDUNYA_CALLBACK_URL ?? new URL("/api/payments/paydunya/ipn", env.NEXT_PUBLIC_APP_URL).toString(),
    storeName: env.PAYDUNYA_STORE_NAME,
  };
}

export function hasPaydunyaConfig() {
  return Boolean(getPaydunyaConfig());
}
