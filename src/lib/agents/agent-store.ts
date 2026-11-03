import { getCloudflareBindings } from "@/src/lib/cloudflare";
import type {
  AgentArtifact,
  AgentDefinition,
  AgentKey,
  AgentRun,
  AgentRunStatus,
  AgentTask,
  AgentTaskStatus,
  ArtifactType,
  ReviewDecision,
} from "@/src/lib/agents/agent-types";

const memoryRuns = new Map<string, AgentRun>();
const memoryTasks = new Map<string, AgentTask>();
const memoryArtifacts = new Map<string, AgentArtifact>();
const memoryDefinitions: AgentDefinition[] = [
  { agentKey: "orchestrator", model: "gpt-5.6-luna", promptKey: "orchestrator.v1", allowedTools: [] },
  { agentKey: "video_planner", model: "gpt-5.6-sol", promptKey: "video_planner.v1", allowedTools: ["read_authorized_context"] },
  { agentKey: "plan_reviewer", model: "gpt-5.6-sol", promptKey: "plan_reviewer.v1", allowedTools: ["read_authorized_context", "read_subject_artifact"] },
  { agentKey: "plan_fixer", model: "gpt-5.6-sol", promptKey: "plan_fixer.v1", allowedTools: ["read_subject_artifact", "read_review_findings"] },
];

function getDatabase() {
  try {
    return getCloudflareBindings().DB;
  } catch {
    return undefined;
  }
}

function rethrowPersistenceFailure(error: unknown) {
  if (process.env.NODE_ENV === "production") throw error;
}

export async function assertAgentPersistence() {
  const database = getDatabase();
  if (!database) throw new Error("Le binding D1 est requis pour activer le moteur agentique en production.");
  try {
    await database.prepare("SELECT 1 FROM agent_definitions LIMIT 1").first();
  } catch (error) {
    throw new Error("La migration D1 du moteur agentique est absente ou inaccessible.", { cause: error });
  }
}

function now() {
  return Date.now();
}

function parseJson(value: unknown) {
  if (typeof value === "string") return JSON.parse(value) as unknown;
  return value;
}

function toTimestamp(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? now() : parsed;
}

function rowToRun(row: Record<string, unknown>): AgentRun {
  return {
    runId: String(row.run_id),
    ownerId: String(row.owner_id),
    status: row.status as AgentRunStatus,
    traceId: String(row.trace_id),
    reviewCycles: Number(row.review_cycles ?? 0),
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  };
}

function rowToTask(row: Record<string, unknown>): AgentTask {
  return {
    taskId: String(row.task_id),
    runId: String(row.run_id),
    agentKey: row.agent_key as AgentKey,
    status: row.status as AgentTaskStatus,
    attempt: Number(row.attempt),
    traceId: String(row.trace_id),
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  };
}

function rowToArtifact(row: Record<string, unknown>): AgentArtifact {
  return {
    artifactId: String(row.artifact_id),
    runId: String(row.run_id),
    taskId: row.task_id ? String(row.task_id) : undefined,
    type: row.artifact_type as ArtifactType,
    schemaVersion: Number(row.schema_version),
    content: parseJson(row.content_json),
    createdAt: toTimestamp(row.created_at),
  };
}

export async function getAgentDefinitions() {
  const database = getDatabase();
  if (!database) return memoryDefinitions;
  try {
    const result = await database.prepare(
      "SELECT agent_key, model, prompt_key, allowed_tools_json FROM agent_definitions WHERE enabled = 1 ORDER BY agent_key",
    ).all<Record<string, unknown>>();
    return result.results.map((row) => ({
      agentKey: row.agent_key as AgentKey,
      model: String(row.model),
      promptKey: String(row.prompt_key),
      allowedTools: parseJson(row.allowed_tools_json) as string[],
    }));
  } catch (error) {
    rethrowPersistenceFailure(error);
    return memoryDefinitions;
  }
}

export async function createAgentRun(ownerId: string, traceId: string) {
  const timestamp = now();
  const run: AgentRun = {
    runId: `agent-run-${crypto.randomUUID()}`,
    ownerId,
    status: "pending",
    traceId,
    reviewCycles: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  memoryRuns.set(run.runId, run);
  const database = getDatabase();
  if (!database) return run;
  try {
    await database.prepare(
      "INSERT INTO agent_runs (run_id, owner_id, status, trace_id, review_cycles, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    ).bind(run.runId, run.ownerId, run.status, run.traceId, run.reviewCycles, run.createdAt, run.updatedAt).run();
  } catch (error) {
    rethrowPersistenceFailure(error);
    // Le repli mémoire permet le développement local avant l'application de la migration D1.
  }
  return run;
}

export async function updateAgentRun(runId: string, status: AgentRunStatus, reviewCycles?: number) {
  const current = memoryRuns.get(runId);
  const updated = current ? { ...current, status, reviewCycles: reviewCycles ?? current.reviewCycles, updatedAt: now() } : undefined;
  if (updated) memoryRuns.set(runId, updated);
  const database = getDatabase();
  if (database) {
    try {
      await database.prepare(
        "UPDATE agent_runs SET status = ?1, review_cycles = COALESCE(?2, review_cycles), updated_at = ?3 WHERE run_id = ?4",
      ).bind(status, reviewCycles ?? null, updated?.updatedAt ?? now(), runId).run();
    } catch (error) {
      rethrowPersistenceFailure(error);
      // Le statut en mémoire reste disponible pour le mode démo local.
    }
  }
  return updated;
}

export async function createAgentTask(runId: string, agentKey: AgentKey, attempt: number, traceId: string) {
  const timestamp = now();
  const task: AgentTask = {
    taskId: `agent-task-${crypto.randomUUID()}`,
    runId,
    agentKey,
    status: "pending",
    attempt,
    traceId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  memoryTasks.set(task.taskId, task);
  const database = getDatabase();
  if (database) {
    try {
      await database.prepare(
        "INSERT INTO agent_tasks (task_id, run_id, agent_key, status, attempt, trace_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
      ).bind(task.taskId, task.runId, task.agentKey, task.status, task.attempt, task.traceId, task.createdAt, task.updatedAt).run();
    } catch (error) {
      rethrowPersistenceFailure(error);
      // Le repli mémoire permet le développement local avant l'application de la migration D1.
    }
  }
  return task;
}

export async function updateAgentTask(taskId: string, status: AgentTaskStatus) {
  const current = memoryTasks.get(taskId);
  const updated = current ? { ...current, status, updatedAt: now() } : undefined;
  if (updated) memoryTasks.set(taskId, updated);
  const database = getDatabase();
  if (database) {
    try {
      await database.prepare("UPDATE agent_tasks SET status = ?1, updated_at = ?2 WHERE task_id = ?3")
        .bind(status, updated?.updatedAt ?? now(), taskId).run();
    } catch (error) {
      rethrowPersistenceFailure(error);
      // Le repli mémoire permet le développement local avant l'application de la migration D1.
    }
  }
  return updated;
}

export async function createAgentArtifact(
  runId: string,
  type: ArtifactType,
  content: unknown,
  options?: { taskId?: string; schemaVersion?: number },
) {
  const artifact: AgentArtifact = {
    artifactId: `agent-artifact-${crypto.randomUUID()}`,
    runId,
    taskId: options?.taskId,
    type,
    schemaVersion: options?.schemaVersion ?? 1,
    content,
    createdAt: now(),
  };
  memoryArtifacts.set(artifact.artifactId, artifact);
  const database = getDatabase();
  if (database) {
    try {
      await database.prepare(
        "INSERT INTO agent_artifacts (artifact_id, run_id, task_id, artifact_type, schema_version, content_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      ).bind(
        artifact.artifactId,
        artifact.runId,
        artifact.taskId ?? null,
        artifact.type,
        artifact.schemaVersion,
        JSON.stringify(artifact.content),
        artifact.createdAt,
      ).run();
    } catch (error) {
      rethrowPersistenceFailure(error);
      // Le repli mémoire permet le développement local avant l'application de la migration D1.
    }
  }
  return artifact;
}

export async function createAgentReview(
  runId: string,
  taskId: string,
  decision: ReviewDecision,
  findings: unknown,
) {
  const database = getDatabase();
  if (!database) return;
  try {
    await database.prepare(
      "INSERT INTO agent_reviews (review_id, run_id, task_id, decision, findings_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(`agent-review-${crypto.randomUUID()}`, runId, taskId, decision, JSON.stringify(findings), now()).run();
  } catch (error) {
    rethrowPersistenceFailure(error);
    // Les artefacts de revue restent stockés en mémoire dans le mode démo local.
  }
}

export async function createAgentEvent(runId: string, taskId: string | undefined, eventType: string, payload: unknown) {
  const database = getDatabase();
  if (!database) return;
  try {
    await database.prepare(
      "INSERT INTO agent_events (event_id, run_id, task_id, event_type, payload_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(`agent-event-${crypto.randomUUID()}`, runId, taskId ?? null, eventType, JSON.stringify(payload), now()).run();
  } catch (error) {
    rethrowPersistenceFailure(error);
    // Les événements sont facultatifs en développement local sans D1.
  }
}

export async function getAgentArtifact(artifactId: string) {
  const inMemory = memoryArtifacts.get(artifactId);
  if (inMemory) return inMemory;
  const database = getDatabase();
  if (!database) return undefined;
  try {
    const row = await database.prepare("SELECT * FROM agent_artifacts WHERE artifact_id = ?1").bind(artifactId).first<Record<string, unknown>>();
    return row ? rowToArtifact(row) : undefined;
  } catch (error) {
    rethrowPersistenceFailure(error);
    return undefined;
  }
}

export async function getAgentRun(runId: string) {
  const inMemory = memoryRuns.get(runId);
  if (inMemory) return inMemory;
  const database = getDatabase();
  if (!database) return undefined;
  try {
    const row = await database.prepare("SELECT * FROM agent_runs WHERE run_id = ?1").bind(runId).first<Record<string, unknown>>();
    return row ? rowToRun(row) : undefined;
  } catch (error) {
    rethrowPersistenceFailure(error);
    return undefined;
  }
}

export async function getAgentTask(taskId: string) {
  const inMemory = memoryTasks.get(taskId);
  if (inMemory) return inMemory;
  const database = getDatabase();
  if (!database) return undefined;
  try {
    const row = await database.prepare("SELECT * FROM agent_tasks WHERE task_id = ?1").bind(taskId).first<Record<string, unknown>>();
    return row ? rowToTask(row) : undefined;
  } catch (error) {
    rethrowPersistenceFailure(error);
    return undefined;
  }
}
