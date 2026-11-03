import { z } from "zod";

export const agentKeys = ["orchestrator", "video_planner", "plan_reviewer", "plan_fixer"] as const;
export type AgentKey = (typeof agentKeys)[number];

export const agentRunStatuses = ["pending", "running", "completed", "failed", "needs_human_review"] as const;
export type AgentRunStatus = (typeof agentRunStatuses)[number];

export const agentTaskStatuses = ["pending", "running", "completed", "failed", "skipped"] as const;
export type AgentTaskStatus = (typeof agentTaskStatuses)[number];

export const artifactTypes = ["generation_input", "dispatch", "generation_plan", "review", "trace"] as const;
export type ArtifactType = (typeof artifactTypes)[number];

export const reviewDecisionSchema = z.enum(["approved", "changes_required", "blocked"]);
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

export const findingSchema = z.object({
  code: z.string().min(2).max(80),
  severity: z.enum(["low", "medium", "high"]),
  message: z.string().min(2).max(800),
  sceneIndex: z.number().int().min(0).max(20).optional(),
});
export type AgentFinding = z.infer<typeof findingSchema>;

export const dispatchSchema = z.object({
  selected_agents: z.array(z.enum(agentKeys)).min(2).max(agentKeys.length),
  rationale: z.string().min(2).max(400),
});
export type AgentDispatch = z.infer<typeof dispatchSchema>;

export const reviewSchema = z.object({
  decision: reviewDecisionSchema,
  summary: z.string().min(2).max(800),
  findings: z.array(findingSchema).max(20),
});
export type AgentReview = z.infer<typeof reviewSchema>;

export type AgentDefinition = {
  agentKey: AgentKey;
  model: string;
  promptKey: string;
  allowedTools: string[];
};

export type AgentRun = {
  runId: string;
  ownerId: string;
  status: AgentRunStatus;
  traceId: string;
  reviewCycles: number;
  createdAt: number;
  updatedAt: number;
};

export type AgentTask = {
  taskId: string;
  runId: string;
  agentKey: AgentKey;
  status: AgentTaskStatus;
  attempt: number;
  traceId: string;
  createdAt: number;
  updatedAt: number;
};

export type AgentArtifact = {
  artifactId: string;
  runId: string;
  taskId?: string;
  type: ArtifactType;
  schemaVersion: number;
  content: unknown;
  createdAt: number;
};
