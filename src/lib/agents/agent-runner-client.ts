import { getEnv, hasAgentRunnerConfig } from "@/src/lib/env";
import type { AgentDefinition, AgentKey } from "@/src/lib/agents/agent-types";

type AgentRunnerResponse = {
  output: unknown;
  trace_id: string;
};

export class AgentRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentRunnerError";
  }
}

function toCamelCase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCamelCase);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
    key === "selected_agents" ? key : key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
    toCamelCase(nestedValue),
  ]));
}

export async function runAgentTask(input: {
  runId: string;
  taskId: string;
  traceId: string;
  definition: AgentDefinition;
  context: Record<string, unknown>;
  imageUrls?: string[];
}): Promise<AgentRunnerResponse> {
  if (!hasAgentRunnerConfig()) throw new AgentRunnerError("Le runner d'agents Terrova n'est pas configuré.");
  const env = getEnv();
  const response = await fetch(`${env.AGENT_RUNNER_URL!.replace(/\/$/, "")}/v1/tasks/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-terrova-agent-secret": env.AGENT_RUNNER_SHARED_SECRET!,
    },
    body: JSON.stringify({
      run_id: input.runId,
      task_id: input.taskId,
      trace_id: input.traceId,
      definition: {
        agent_key: input.definition.agentKey,
        model: input.definition.model,
        prompt_key: input.definition.promptKey,
        allowed_tools: input.definition.allowedTools,
      },
      context: input.context,
      image_urls: input.imageUrls ?? [],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new AgentRunnerError(`Le runner d'agents a échoué (${response.status})${body ? ` : ${body.slice(0, 240)}` : ""}`);
  }
  const payload = await response.json() as AgentRunnerResponse;
  return { ...payload, output: toCamelCase(payload.output) };
}

export function requireAgentDefinition(
  definitions: AgentDefinition[],
  agentKey: AgentKey,
) {
  const definition = definitions.find((candidate) => candidate.agentKey === agentKey);
  if (!definition) throw new AgentRunnerError(`L'agent « ${agentKey} » est désactivé ou introuvable.`);
  return definition;
}
