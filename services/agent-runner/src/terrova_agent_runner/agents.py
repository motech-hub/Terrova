from __future__ import annotations

import json
from typing import Any

from agents import Agent, RunConfig, Runner, function_tool

from .schemas import (
    AgentTaskRequest,
    DispatchOutput,
    GenerationPlanOutput,
    ReviewOutput,
)


PROMPTS = {
    "orchestrator.v1": """
Tu es l'orchestrateur de Terrova. Tu ne converses pas avec les autres agents.
Analyse le contexte structuré et choisis les agents nécessaires au workflow de plan vidéo.
Pour ce MVP, un plan doit toujours être préparé puis contrôlé. Ajoute le correcteur uniquement
si la tâche indique déjà une correction. Retourne exclusivement la sortie structurée demandée.
""",
    "video_planner.v1": """
Tu es le planificateur vidéo immobilier de Terrova. Crée un plan de scènes fidèle aux images
et aux seules informations confirmées. N'invente jamais une surface, un prix, une pièce, une vue,
une adresse, un équipement ou une caractéristique non vérifiable. Utilise exclusivement les image_key
présentes dans le contexte. Réponds uniquement avec la sortie structurée attendue, en français.
""",
    "plan_reviewer.v1": """
Tu es le responsable qualité éditorial et visuel de Terrova. Évalue l'artefact de plan fourni
avec le contexte autorisé. Ne corrige pas toi-même le plan : approuve-le ou retourne des findings
précis et actionnables. Bloque s'il est impossible de produire un résultat fidèle. Réponds uniquement
avec la sortie structurée attendue, en français.
""",
    "plan_fixer.v1": """
Tu es le correcteur de plans vidéo Terrova. Corrige uniquement le plan soumis, en appliquant
strictement les findings fournis. Préserve les informations fiables et n'invente aucun détail.
Utilise uniquement les image_key autorisées. Réponds uniquement avec la sortie structurée attendue,
en français.
""",
}


ROLE_POLICIES = {
    "orchestrator": {
        "prompt_key": "orchestrator.v1",
        "allowed_tools": frozenset(),
        "context_keys": frozenset({"workflow"}),
        "accepts_images": False,
    },
    "video_planner": {
        "prompt_key": "video_planner.v1",
        "allowed_tools": frozenset({"read_authorized_context"}),
        "context_keys": frozenset({"generationInput"}),
        "accepts_images": True,
    },
    "plan_reviewer": {
        "prompt_key": "plan_reviewer.v1",
        "allowed_tools": frozenset({"read_authorized_context", "read_subject_artifact"}),
        "context_keys": frozenset({"generationInput", "subjectArtifact"}),
        "accepts_images": True,
    },
    "plan_fixer": {
        "prompt_key": "plan_fixer.v1",
        "allowed_tools": frozenset({"read_subject_artifact", "read_review_findings"}),
        "context_keys": frozenset({"subjectArtifact", "review"}),
        "accepts_images": False,
    },
}


def _serialized_context(context: dict[str, Any]) -> str:
    return json.dumps(context, ensure_ascii=False, separators=(",", ":"))


def _validate_role_boundary(request: AgentTaskRequest) -> None:
    policy = ROLE_POLICIES[request.definition.agent_key]
    if request.definition.prompt_key != policy["prompt_key"]:
        raise ValueError("La clé de prompt n'est pas autorisée pour ce rôle.")
    requested_tools = set(request.definition.allowed_tools)
    if not requested_tools.issubset(policy["allowed_tools"]):
        raise ValueError("Un outil demandé n'est pas autorisé pour ce rôle.")
    unexpected_context = set(request.context).difference(policy["context_keys"])
    if unexpected_context:
        raise ValueError("Le contexte contient des données non autorisées pour ce rôle.")
    if request.image_urls and not policy["accepts_images"]:
        raise ValueError("Les images ne sont pas autorisées pour ce rôle.")


def _allowed_tools(request: AgentTaskRequest):
    context = request.context

    @function_tool
    def read_authorized_context() -> str:
        """Retourne uniquement le contexte métier autorisé pour cette tâche."""
        return _serialized_context(context.get("generationInput", context))

    @function_tool
    def read_subject_artifact() -> str:
        """Retourne l'artefact à contrôler ou à corriger, et rien d'autre."""
        return _serialized_context(context.get("subjectArtifact", {}))

    @function_tool
    def read_review_findings() -> str:
        """Retourne les findings validés à appliquer au plan."""
        return _serialized_context(context.get("review", {}))

    available = {
        "read_authorized_context": read_authorized_context,
        "read_subject_artifact": read_subject_artifact,
        "read_review_findings": read_review_findings,
    }
    return [available[name] for name in request.definition.allowed_tools]


def _output_type(agent_key: str):
    if agent_key == "orchestrator":
        return DispatchOutput
    if agent_key in {"video_planner", "plan_fixer"}:
        return GenerationPlanOutput
    return ReviewOutput


def _input_items(request: AgentTaskRequest) -> list[dict[str, Any]]:
    task_instructions = {
        "orchestrator": "Sélectionne le workflow prévu. Aucun contexte métier ni image ne te sont transmis.",
        "video_planner": "Appelle d'abord l'outil read_authorized_context avant de produire le plan.",
        "plan_reviewer": "Appelle les outils read_authorized_context et read_subject_artifact avant de produire la revue.",
        "plan_fixer": "Appelle les outils read_subject_artifact et read_review_findings avant de corriger le plan.",
    }
    content: list[dict[str, Any]] = [{"type": "input_text", "text": task_instructions[request.definition.agent_key]}]
    for image_url in request.image_urls:
        content.append({"type": "input_image", "image_url": image_url, "detail": "low"})
    return [{"role": "user", "content": content}]


async def execute_task(request: AgentTaskRequest) -> dict[str, Any]:
    _validate_role_boundary(request)
    instructions = PROMPTS.get(request.definition.prompt_key)
    if not instructions:
        raise ValueError("Configuration d'agent Terrova non autorisée.")

    agent = Agent(
        name=request.definition.agent_key,
        model=request.definition.model,
        instructions=instructions,
        tools=_allowed_tools(request),
        output_type=_output_type(request.definition.agent_key),
    )
    result = await Runner.run(
        agent,
        _input_items(request),
        run_config=RunConfig(
            trace_id=request.trace_id,
            workflow_name="Terrova agent task",
            trace_include_sensitive_data=False,
        ),
    )
    output = result.final_output
    if hasattr(output, "model_dump"):
        return output.model_dump(exclude_none=True)
    if isinstance(output, dict):
        return output
    raise ValueError("L'agent a retourné une sortie non structurée.")
