import { getEnv, hasAgentRunnerConfig, hasClaudeConfig, hasGeminiConfig, hasR2Config } from "@/src/lib/env";
import { prepareAgenticVideoPrompt } from "@/src/lib/agents/agentic-video-plan";
import {
  buildGenerationPlanPrompt,
  buildGenerationPlanReviewPrompt,
  createDeterministicGenerationPlan,
  generationPlanJsonSchema,
  normalizeGenerationPlan,
  renderGenerationPlanPrompt,
  type GenerationPlan,
} from "@/src/lib/ai/generation-plan";
import { loadImageParts } from "@/src/lib/ai/image-parts";
import type { GenerateVideoInput } from "@/src/lib/video/video-provider";

export interface GenerationPlanProvider {
  readonly name: "gemini" | "claude" | "deterministic";
  plan(input: GenerateVideoInput): Promise<GenerationPlan>;
}

export type IntelligentPromptResult = {
  prompt: string;
  plan: GenerationPlan;
  provider: GenerationPlanProvider["name"];
};

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("AI plan JSON missing");
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
}

async function loadPlanImageParts(input: GenerateVideoInput) {
  return hasR2Config()
    ? loadImageParts(input.images, { maxImages: 10, maxImageBytes: 2 * 1024 * 1024 })
    : [];
}

async function requestGeminiPlan(input: GenerateVideoInput, instruction: string) {
  const env = getEnv();
  if (!hasGeminiConfig()) throw new Error("Gemini configuration missing");

  const imageParts = await loadPlanImageParts(input);
  const url = env.GOOGLE_GENAI_USE_ENTERPRISE
    ? `${env.GEMINI_ENTERPRISE_BASE_URL}/v1/publishers/google/models/${env.GEMINI_MODEL}:generateContent?key=${encodeURIComponent(env.GOOGLE_API_KEY!)}`
    : `${env.GEMINI_BASE_URL}/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(!env.GOOGLE_GENAI_USE_ENTERPRISE ? { "x-goog-api-key": env.GOOGLE_API_KEY! } : {}),
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: instruction },
          ...imageParts.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.data } })),
        ],
      }],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 3200,
        responseMimeType: "application/json",
        responseSchema: generationPlanJsonSchema,
      },
    }),
  });

  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
  if (!text) throw new Error("Gemini returned an empty plan");
  return normalizeGenerationPlan(input, extractJson(text));
}

async function requestClaudePlan(input: GenerateVideoInput, instruction: string) {
  const env = getEnv();
  if (!hasClaudeConfig()) throw new Error("Claude configuration missing");

  const imageParts = await loadPlanImageParts(input);
  const response = await fetch(`${env.ANTHROPIC_BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL,
      max_tokens: 3200,
      temperature: 0.15,
      system: "Tu es un directeur créatif immobilier senior et un responsable qualité. Réponds uniquement avec un JSON valide conforme au plan demandé. Appuie-toi d'abord sur les images, puis sur les informations confirmées. Ne complète jamais une information manquante par une supposition.",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: instruction },
          ...imageParts.map((image) => ({
            type: "image",
            source: { type: "base64", media_type: image.mimeType, data: image.data },
          })),
        ],
      }],
    }),
  });

  if (!response.ok) throw new Error(`Claude request failed (${response.status})`);
  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content?.find((part) => part.type === "text")?.text;
  if (!text) throw new Error("Claude returned an empty plan");
  return normalizeGenerationPlan(input, extractJson(text));
}

type ReviewablePlanProvider = GenerationPlanProvider & {
  review(input: GenerateVideoInput, draft: GenerationPlan): Promise<GenerationPlan>;
};

class GeminiPlanProvider implements ReviewablePlanProvider {
  readonly name = "gemini" as const;

  async plan(input: GenerateVideoInput) {
    return requestGeminiPlan(input, buildGenerationPlanPrompt(input));
  }

  async review(input: GenerateVideoInput, draft: GenerationPlan) {
    return requestGeminiPlan(input, buildGenerationPlanReviewPrompt(input, draft));
  }
}

class ClaudePlanProvider implements ReviewablePlanProvider {
  readonly name = "claude" as const;

  async plan(input: GenerateVideoInput) {
    return requestClaudePlan(input, buildGenerationPlanPrompt(input));
  }

  async review(input: GenerateVideoInput, draft: GenerationPlan) {
    return requestClaudePlan(input, buildGenerationPlanReviewPrompt(input, draft));
  }
}

class DeterministicPlanProvider implements GenerationPlanProvider {
  readonly name = "deterministic" as const;

  async plan(input: GenerateVideoInput) {
    return createDeterministicGenerationPlan(input);
  }
}

class FallbackPlanProvider implements GenerationPlanProvider {
  readonly name = "deterministic" as const;
  private readonly deterministic = new DeterministicPlanProvider();

  async planWithProvider(input: GenerateVideoInput): Promise<IntelligentPromptResult> {
    const env = getEnv();
    const providers: ReviewablePlanProvider[] = env.AI_PRIMARY_PROVIDER === "claude"
      ? [new ClaudePlanProvider(), new GeminiPlanProvider()]
      : [new GeminiPlanProvider(), new ClaudePlanProvider()];

    for (const provider of providers) {
      const configured = provider.name === "gemini" ? hasGeminiConfig() : hasClaudeConfig();
      if (!configured) continue;
      try {
        const draft = await provider.plan(input);
        let plan = draft;
        try {
          plan = await provider.review(input, draft);
        } catch (error) {
          if (!env.AI_ALLOW_FALLBACK) throw error;
        }
        return {
          plan,
          prompt: renderGenerationPlanPrompt(input, plan),
          provider: provider.name,
        };
      } catch (error) {
        if (!env.AI_ALLOW_FALLBACK) throw error;
      }
    }

    const plan = await this.deterministic.plan(input);
    return {
      plan,
      prompt: renderGenerationPlanPrompt(input, plan),
      provider: this.deterministic.name,
    };
  }

  async plan(input: GenerateVideoInput) {
    return (await this.planWithProvider(input)).plan;
  }
}

const fallbackPlanProvider = new FallbackPlanProvider();

export const generationPlanProvider: GenerationPlanProvider = fallbackPlanProvider;

export async function prepareIntelligentVideoPrompt(input: GenerateVideoInput) {
  return fallbackPlanProvider.planWithProvider(input);
}

export async function prepareVideoPrompt(input: GenerateVideoInput) {
  if (hasAgentRunnerConfig()) return prepareAgenticVideoPrompt(input);
  return prepareIntelligentVideoPrompt(input);
}
