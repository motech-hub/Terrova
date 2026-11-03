import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { setCloudflareBindings } from "@/src/lib/cloudflare";
import { finalizeGeneration, getGenerationJob, updateGenerationJob } from "@/src/lib/generations/generation-store";
import { getEnv } from "@/src/lib/env";
import { videoProvider } from "@/src/lib/video/openrouter-video-provider";
import type { GenerationResult } from "@/src/lib/video/video-provider";

export type GenerationWorkflowParams = { jobId: string };

type WorkflowBindings = {
  DB?: D1Database;
  MEDIA?: R2Bucket;
};

export class GenerationWorkflow extends WorkflowEntrypoint<
  WorkflowBindings,
  GenerationWorkflowParams
> {
  async run(
    event: Readonly<WorkflowEvent<GenerationWorkflowParams>>,
    step: WorkflowStep,
  ) {
    setCloudflareBindings(this.env);
    const jobId = event.payload.jobId;
    const env = getEnv();

    for (let attempt = 0; attempt < env.GENERATION_MAX_ATTEMPTS; attempt += 1) {
      const stored = await step.do(
        `Lire le job ${attempt + 1}`,
        { retries: { limit: 2, delay: "5 seconds", backoff: "exponential" } },
        () => getGenerationJob(jobId),
      );
      const result = await step.do(
        `Vérifier la génération ${attempt + 1}`,
        { retries: { limit: 2, delay: "5 seconds", backoff: "exponential" } },
        () => videoProvider.getStatus(jobId, { providerStatusUrl: stored?.providerStatusUrl }),
      );
      const finalized = await step.do(
        `Enregistrer l'état ${attempt + 1}`,
        { retries: { limit: 2, delay: "5 seconds", backoff: "exponential" } },
        () => finalizeGeneration(jobId, result),
      );

      if (finalized.status === "completed" || finalized.status === "failed") {
        return finalized;
      }

      await step.sleep(
        `Attendre avant la vérification ${attempt + 1}`,
        `${env.GENERATION_POLL_INTERVAL_SECONDS} seconds`,
      );
    }

    const timeoutResult: GenerationResult = {
      jobId,
      status: "failed",
      provider: "openrouter",
      message: "La génération a dépassé le délai maximal.",
    };
    await step.do(
      "Enregistrer le délai dépassé",
      { retries: { limit: 2, delay: "5 seconds", backoff: "exponential" } },
      () => updateGenerationJob(jobId, timeoutResult),
    );
    return timeoutResult;
  }
}
