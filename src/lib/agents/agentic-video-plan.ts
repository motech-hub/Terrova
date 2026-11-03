import {
  assertAgentPersistence,
  createAgentArtifact,
  createAgentEvent,
  createAgentReview,
  createAgentRun,
  createAgentTask,
  getAgentDefinitions,
  updateAgentRun,
  updateAgentTask,
} from "@/src/lib/agents/agent-store";
import { requireAgentDefinition, runAgentTask } from "@/src/lib/agents/agent-runner-client";
import { dispatchSchema, reviewSchema, type AgentDefinition, type AgentKey } from "@/src/lib/agents/agent-types";
import { normalizeGenerationPlan, renderGenerationPlanPrompt, type GenerationPlan } from "@/src/lib/ai/generation-plan";
import { hasR2Config } from "@/src/lib/env";
import { createTemporaryReadUrl } from "@/src/lib/storage/r2";
import type { GenerateVideoInput } from "@/src/lib/video/video-provider";

const MAX_REVIEW_CYCLES = 2;

class NeedsHumanReviewError extends Error {
  constructor() {
    super("Le plan vidéo exige une revue humaine avant sa génération.");
    this.name = "NeedsHumanReviewError";
  }
}

export type AgenticVideoPlanResult = {
  plan: GenerationPlan;
  prompt: string;
  provider: "openai_agents";
  runId: string;
};

function safeGenerationInput(input: GenerateVideoInput) {
  return {
    property: input.property,
    video: {
      style: input.video.style,
      ratio: input.video.ratio,
      duration: input.video.duration,
      platform: input.video.platform,
      templateInstructions: input.video.templateInstructions,
    },
    images: input.images.map((image) => ({ key: image.key })),
  };
}

async function getImageUrls(input: GenerateVideoInput) {
  if (!hasR2Config()) return [];
  return Promise.all(input.images.map(async (image) => (await createTemporaryReadUrl(image.key)).url));
}

async function executeTask(
  definitions: AgentDefinition[],
  agentKey: AgentKey,
  input: {
    runId: string;
    traceId: string;
    attempt: number;
    context: Record<string, unknown>;
    imageUrls?: string[];
  },
) {
  const task = await createAgentTask(input.runId, agentKey, input.attempt, input.traceId);
  await updateAgentTask(task.taskId, "running");
  await createAgentEvent(input.runId, task.taskId, "task_started", { agentKey, attempt: input.attempt });
  try {
    const result = await runAgentTask({
      runId: input.runId,
      taskId: task.taskId,
      traceId: input.traceId,
      definition: requireAgentDefinition(definitions, agentKey),
      context: input.context,
      imageUrls: input.imageUrls,
    });
    await updateAgentTask(task.taskId, "completed");
    await createAgentEvent(input.runId, task.taskId, "task_completed", { agentKey, traceId: result.trace_id });
    return { task, output: result.output };
  } catch (error) {
    await updateAgentTask(task.taskId, "failed");
    await createAgentEvent(input.runId, task.taskId, "task_failed", {
      agentKey,
      message: error instanceof Error ? error.message.slice(0, 500) : "Erreur inconnue",
    });
    throw error;
  }
}

function assertRequiredDispatch(value: unknown) {
  const dispatch = dispatchSchema.parse(value);
  if (!dispatch.selected_agents.includes("video_planner") || !dispatch.selected_agents.includes("plan_reviewer")) {
    throw new Error("L'orchestrateur n'a pas sélectionné les agents indispensables.");
  }
  return dispatch;
}

export async function prepareAgenticVideoPrompt(input: GenerateVideoInput): Promise<AgenticVideoPlanResult> {
  if (process.env.NODE_ENV === "production") await assertAgentPersistence();
  const definitions = await getAgentDefinitions();
  const traceId = `trace_${crypto.randomUUID().replace(/-/g, "")}`;
  const run = await createAgentRun(input.sessionId, traceId);
  await updateAgentRun(run.runId, "running", 0);
  const generationInput = safeGenerationInput(input);
  await createAgentArtifact(run.runId, "generation_input", generationInput);

  try {
    const imageUrls = await getImageUrls(input);
    const dispatchTask = await executeTask(definitions, "orchestrator", {
      runId: run.runId,
      traceId,
      attempt: 1,
      context: { workflow: "video_plan" },
    });
    const dispatch = assertRequiredDispatch(dispatchTask.output);
    await createAgentArtifact(run.runId, "dispatch", dispatch, { taskId: dispatchTask.task.taskId });

    const plannerTask = await executeTask(definitions, "video_planner", {
      runId: run.runId,
      traceId,
      attempt: 1,
      context: { generationInput },
      imageUrls,
    });
    let plan = normalizeGenerationPlan(input, plannerTask.output);
    let planArtifact = await createAgentArtifact(run.runId, "generation_plan", plan, { taskId: plannerTask.task.taskId });

    for (let reviewCycle = 0; reviewCycle <= MAX_REVIEW_CYCLES; reviewCycle += 1) {
      const reviewerTask = await executeTask(definitions, "plan_reviewer", {
        runId: run.runId,
        traceId,
        attempt: reviewCycle + 1,
        context: { generationInput, subjectArtifact: plan },
        imageUrls,
      });
      const review = reviewSchema.parse(reviewerTask.output);
      await createAgentArtifact(run.runId, "review", review, { taskId: reviewerTask.task.taskId });
      await createAgentReview(run.runId, reviewerTask.task.taskId, review.decision, review.findings);

      if (review.decision === "approved") {
        await updateAgentRun(run.runId, "completed", reviewCycle);
        return {
          plan,
          prompt: renderGenerationPlanPrompt(input, plan),
          provider: "openai_agents",
          runId: run.runId,
        };
      }

      if (review.decision === "blocked" || reviewCycle === MAX_REVIEW_CYCLES) {
        await updateAgentRun(run.runId, "needs_human_review", reviewCycle);
        throw new NeedsHumanReviewError();
      }

      const fixerTask = await executeTask(definitions, "plan_fixer", {
        runId: run.runId,
        traceId,
        attempt: reviewCycle + 1,
        context: { subjectArtifact: plan, review },
      });
      plan = normalizeGenerationPlan(input, fixerTask.output);
      planArtifact = await createAgentArtifact(run.runId, "generation_plan", plan, { taskId: fixerTask.task.taskId });
      await createAgentEvent(run.runId, fixerTask.task.taskId, "plan_revised", { artifactId: planArtifact.artifactId, reviewCycle: reviewCycle + 1 });
      await updateAgentRun(run.runId, "running", reviewCycle + 1);
    }

    throw new Error("La boucle de revue agentique a terminé dans un état inattendu.");
  } catch (error) {
    if (!(error instanceof NeedsHumanReviewError)) {
      await updateAgentRun(run.runId, "failed");
    }
    throw error;
  }
}
