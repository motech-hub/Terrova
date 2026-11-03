import { getEnv, hasMakeConfig } from "@/src/lib/env";
import { createTemporaryReadUrl } from "@/src/lib/storage/r2";
import type {
  GenerateVideoInput,
  GenerationJob,
  GenerationResult,
  VideoGenerationProvider,
} from "@/src/lib/video/video-provider";

const demoJobs = new Map<string, { createdAt: number }>();

export class MakeVideoProvider implements VideoGenerationProvider {
  async generate(input: GenerateVideoInput): Promise<GenerationJob> {
    if (!hasMakeConfig()) {
      const jobId = `demo-${crypto.randomUUID()}`;
      demoJobs.set(jobId, { createdAt: Date.now() });
      return { jobId, status: "pending", provider: "demo" };
    }

    const env = getEnv();
    const images = await Promise.all(
      input.images.map(async (image) => {
        const signed = await createTemporaryReadUrl(image.key);
        return { key: image.key, url: signed.url };
      }),
    );

    const requestId = crypto.randomUUID();
    const response = await fetch(env.MAKE_GENERATE_WEBHOOK_URL!, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.MAKE_WEBHOOK_SECRET ? { "x-terrova-secret": env.MAKE_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({
        requestId,
        sessionId: input.sessionId,
        property: input.property,
        video: input.video,
        images,
      }),
    });

    if (!response.ok) {
      throw new Error("Make webhook unavailable");
    }

    const responseText = await response.text();
    let payload: Partial<GenerationJob> = {};
    if (responseText) {
      try {
        payload = JSON.parse(responseText) as Partial<GenerationJob>;
      } catch {
        payload = {};
      }
    }

    return {
      jobId: payload.jobId ?? requestId,
      status: payload.status ?? "pending",
      provider: "make",
    };
  }

  async getStatus(jobId: string): Promise<GenerationResult> {
    if (jobId.startsWith("demo-") || !hasMakeConfig()) {
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

    return {
      jobId,
      status: "processing",
      provider: "make",
      message:
        "Statut demandé. Configurez un endpoint Make de statut ou remplacez ce provider par un provider persistant.",
    };
  }
}

export const videoProvider = new MakeVideoProvider();
