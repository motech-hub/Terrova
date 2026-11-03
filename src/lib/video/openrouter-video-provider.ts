import { getEnv, hasOpenRouterConfig } from "@/src/lib/env";
import { createTemporaryReadUrl } from "@/src/lib/storage/r2";
import { buildDefaultVideoPrompt } from "@/src/lib/ai/generation-plan";
import { calculateTerrovaCredits, getOpenRouterVideoPricing } from "@/src/config/billing";
import type {
  GenerateVideoInput,
  GenerationEstimate,
  GenerationJob,
  GenerationResult,
  VideoGenerationProvider,
} from "@/src/lib/video/video-provider";

type OpenRouterVideoModel = {
  id: string;
  canonical_slug?: string;
  supported_durations?: number[];
  supported_resolutions?: string[];
  supported_aspect_ratios?: string[];
};

type OpenRouterModelsResponse = {
  data?: OpenRouterVideoModel[];
};

type OpenRouterVideoJob = {
  id?: string;
  polling_url?: string;
  status?: string;
  error?: string;
  unsigned_urls?: string[];
};

function mapStatus(status: string | undefined): GenerationResult["status"] {
  if (status === "completed") return "completed";
  if (status === "failed" || status === "cancelled" || status === "expired") return "failed";
  if (status === "in_progress" || status === "processing") return "processing";
  if (status === "queued" || status === "pending") return "pending";
  return "generating";
}

function baseUrl() {
  return getEnv().OPENROUTER_BASE_URL.replace(/\/$/, "");
}

function headers() {
  const env = getEnv();
  return {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "content-type": "application/json",
    ...(env.OPENROUTER_HTTP_REFERER ? { "HTTP-Referer": env.OPENROUTER_HTTP_REFERER } : {}),
    ...(env.OPENROUTER_APP_TITLE ? { "X-Title": env.OPENROUTER_APP_TITLE } : {}),
  };
}

function providerError(response: Response, operation: string, responseText: string) {
  const detail = responseText.trim().replace(/\s+/g, " ").slice(0, 300);
  console.error(`[OpenRouter] ${operation} failed`, {
    status: response.status,
    detail,
  });
  return new Error(`OpenRouter ${operation} failed (${response.status})${detail ? `: ${detail}` : ""}`);
}

async function readResponse<T>(response: Response, operation: string) {
  const responseText = await response.text();
  if (!response.ok) throw providerError(response, operation, responseText);
  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(`OpenRouter ${operation} a renvoyé une réponse JSON invalide.`);
  }
}

async function getVideoModel(modelId: string) {
  const response = await fetch(`${baseUrl()}/videos/models`, { headers: headers() });
  const payload = await readResponse<OpenRouterModelsResponse>(response, "model list");
  const model = payload.data?.find((candidate) => candidate.id === modelId || candidate.canonical_slug === modelId);
  if (!model) throw new Error(`Le modèle vidéo OpenRouter « ${modelId} » est introuvable dans le catalogue.`);
  return model;
}

function assertSupported(value: string | number, supported: Array<string | number> | undefined, label: string) {
  if (supported && supported.length > 0 && !supported.includes(value)) {
    throw new Error(`${label} n’est pas pris en charge par le modèle OpenRouter sélectionné.`);
  }
}

function isOpenRouterContentUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin === new URL(baseUrl()).origin && url.pathname.includes("/videos/") && url.pathname.endsWith("/content");
  } catch {
    return false;
  }
}

const demoJobs = new Map<string, { createdAt: number }>();

export class OpenRouterVideoProvider implements VideoGenerationProvider {
  async estimate(input: GenerateVideoInput): Promise<GenerationEstimate> {
    if (!hasOpenRouterConfig()) {
      return {
        provider: "demo",
        providerCostUsd: 0,
        terrovaCredits: calculateTerrovaCredits(input.video.duration, 2),
      };
    }

    const env = getEnv();
    const pricing = getOpenRouterVideoPricing(env.OPENROUTER_VIDEO_MODEL);
    const model = await getVideoModel(env.OPENROUTER_VIDEO_MODEL);
    assertSupported(input.video.duration, model.supported_durations, "Cette durée n’est pas");
    assertSupported(env.OPENROUTER_VIDEO_RESOLUTION, model.supported_resolutions, "Cette résolution n’est pas");
    assertSupported(input.video.ratio, model.supported_aspect_ratios, "Ce format n’est pas");
    const providerCostUsd = pricing.providerCostPerSecondUsd * input.video.duration;
    return {
      provider: "openrouter",
      providerCostUsd,
      terrovaCredits: calculateTerrovaCredits(input.video.duration, pricing.terrovaCreditsPerSecond),
    };
  }

  async generate(input: GenerateVideoInput): Promise<GenerationJob> {
    if (!hasOpenRouterConfig()) {
      const jobId = `demo-${crypto.randomUUID()}`;
      demoJobs.set(jobId, { createdAt: Date.now() });
      return { jobId, status: "pending", provider: "demo" };
    }

    const env = getEnv();
    const images = await Promise.all(
      input.images.map(async (image) => {
        const signed = await createTemporaryReadUrl(image.key);
        return {
          type: "image_url",
          image_url: { url: signed.url },
        };
      }),
    );
    const prompt = input.video.prompt?.trim() || buildDefaultVideoPrompt(input);
    const response = await fetch(`${baseUrl()}/videos`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: env.OPENROUTER_VIDEO_MODEL,
        prompt,
        aspect_ratio: input.video.ratio,
        duration: input.video.duration,
        resolution: env.OPENROUTER_VIDEO_RESOLUTION,
        generate_audio: false,
        input_references: images,
      }),
    });
    const payload = await readResponse<OpenRouterVideoJob>(response, "video generation");
    if (!payload.id) throw new Error("OpenRouter n’a pas retourné d’identifiant de job.");

    const pollingUrl = payload.polling_url ? new URL(payload.polling_url, `${baseUrl()}/`).toString() : `${baseUrl()}/videos/${payload.id}`;
    return {
      jobId: `openrouter-${payload.id}`,
      status: mapStatus(payload.status),
      provider: "openrouter",
      providerStatusUrl: pollingUrl,
    };
  }

  async getStatus(jobId: string, options?: { providerStatusUrl?: string }): Promise<GenerationResult> {
    if (jobId.startsWith("demo-")) {
      const createdAt = demoJobs.get(jobId)?.createdAt ?? Date.now() - 4500;
      const age = Date.now() - createdAt;
      if (age < 1200) return { jobId, status: "pending", provider: "demo", message: "Photos reçues" };
      if (age < 2400) return { jobId, status: "analyzing", provider: "demo", message: "Analyse du bien" };
      if (age < 3800) return { jobId, status: "generating", provider: "demo", message: "Création de la vidéo" };
      if (age < 5000) return { jobId, status: "processing", provider: "demo", message: "Finalisation" };
      return {
        jobId,
        status: "completed",
        provider: "demo",
        videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        message: "Votre vidéo est prête.",
      };
    }

    if (!jobId.startsWith("openrouter-") || !hasOpenRouterConfig()) {
      return { jobId, status: "processing", provider: "openrouter", message: "Génération en cours." };
    }

    const statusUrl = new URL(options?.providerStatusUrl ?? `${baseUrl()}/videos/${jobId.slice("openrouter-".length)}`);
    if (statusUrl.origin !== new URL(baseUrl()).origin || !statusUrl.pathname.includes("/videos/")) {
      throw new Error("URL de suivi OpenRouter invalide.");
    }
    const response = await fetch(statusUrl, { headers: headers() });
    const payload = await readResponse<OpenRouterVideoJob>(response, "video status");
    const status = mapStatus(payload.status);
    if (status === "completed" && !payload.unsigned_urls?.[0]) {
      return {
        jobId,
        status: "failed",
        provider: "openrouter",
        message: "OpenRouter a terminé la génération sans fournir d’URL vidéo téléchargeable.",
      };
    }
    return {
      jobId,
      status,
      provider: "openrouter",
      ...(status === "completed" && payload.unsigned_urls?.[0] ? { videoUrl: payload.unsigned_urls[0] } : {}),
      ...(status === "completed" && payload.unsigned_urls?.[0] && isOpenRouterContentUrl(payload.unsigned_urls[0])
        ? { videoDownloadHeaders: headers() }
        : {}),
      message:
        status === "completed"
          ? "Votre vidéo est prête."
          : status === "failed"
            ? payload.error ?? "La génération OpenRouter a échoué."
            : "Génération en cours.",
    };
  }
}

export const videoProvider = new OpenRouterVideoProvider();
