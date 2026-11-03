from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


AgentKey = Literal["orchestrator", "video_planner", "plan_reviewer", "plan_fixer"]
ReviewDecision = Literal["approved", "changes_required", "blocked"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AgentDefinition(StrictModel):
    agent_key: AgentKey
    model: str = Field(min_length=1, max_length=120)
    prompt_key: str = Field(min_length=1, max_length=120)
    allowed_tools: list[str] = Field(default_factory=list, max_length=8)


class AgentTaskRequest(StrictModel):
    run_id: str = Field(min_length=3, max_length=160)
    task_id: str = Field(min_length=3, max_length=160)
    trace_id: str = Field(pattern=r"^trace_[0-9a-f]{32}$")
    definition: AgentDefinition
    context: dict[str, Any] = Field(default_factory=dict)
    image_urls: list[str] = Field(default_factory=list, max_length=10)


class DispatchOutput(StrictModel):
    selected_agents: list[AgentKey] = Field(min_length=2, max_length=4)
    rationale: str = Field(min_length=2, max_length=400)


class VideoScene(StrictModel):
    index: int = Field(ge=0, le=20)
    image_key: str = Field(min_length=1, max_length=300)
    duration_seconds: float = Field(gt=0, le=15)
    visual_prompt: str = Field(min_length=10, max_length=600)
    caption: str = Field(min_length=2, max_length=140)
    voiceover: Optional[str] = Field(default=None, max_length=360)


class GenerationPlanOutput(StrictModel):
    version: Literal[1]
    language: Literal["fr"]
    title: str = Field(min_length=2, max_length=120)
    hook: str = Field(min_length=2, max_length=180)
    scenes: list[VideoScene] = Field(min_length=1, max_length=12)
    final_call_to_action: str = Field(min_length=2, max_length=180)


class Finding(StrictModel):
    code: str = Field(min_length=2, max_length=80)
    severity: Literal["low", "medium", "high"]
    message: str = Field(min_length=2, max_length=800)
    scene_index: Optional[int] = Field(default=None, ge=0, le=20)


class ReviewOutput(StrictModel):
    decision: ReviewDecision
    summary: str = Field(min_length=2, max_length=800)
    findings: list[Finding] = Field(default_factory=list, max_length=20)


class AgentTaskResponse(StrictModel):
    output: dict[str, Any]
    trace_id: str
