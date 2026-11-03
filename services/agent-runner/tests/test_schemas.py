from terrova_agent_runner.agents import _input_items, _validate_role_boundary
from terrova_agent_runner.schemas import AgentDefinition, AgentTaskRequest, DispatchOutput, GenerationPlanOutput, ReviewOutput


def test_dispatch_rejects_unknown_agent() -> None:
    try:
        DispatchOutput.model_validate({"selected_agents": ["orchestrator", "inconnu"], "rationale": "Test valide"})
    except ValueError:
        return
    raise AssertionError("Un agent inconnu doit être rejeté")


def test_review_accepts_structured_finding() -> None:
    review = ReviewOutput.model_validate({
        "decision": "changes_required",
        "summary": "Une scène doit être corrigée.",
        "findings": [{"code": "scene_fidelity", "severity": "high", "message": "Élément absent de la photo.", "scene_index": 1}],
    })
    assert review.findings[0].code == "scene_fidelity"


def test_plan_uses_snake_case_on_the_service_contract() -> None:
    plan = GenerationPlanOutput.model_validate({
        "version": 1,
        "language": "fr",
        "title": "Visite du bien",
        "hook": "Découvrez ce bien.",
        "scenes": [{
            "index": 0,
            "image_key": "properties/1/image.jpg",
            "duration_seconds": 5,
            "visual_prompt": "Un mouvement doux révèle la pièce lumineuse.",
            "caption": "Une pièce lumineuse",
        }],
        "final_call_to_action": "Contactez-nous pour visiter.",
    })
    assert plan.model_dump()["scenes"][0]["image_key"] == "properties/1/image.jpg"


def test_task_message_does_not_embed_the_private_context() -> None:
    request = AgentTaskRequest(
        run_id="agent-run-test",
        task_id="agent-task-test",
        trace_id="trace_0123456789abcdef0123456789abcdef",
        definition=AgentDefinition(
            agent_key="video_planner",
            model="gpt-5.6-luna",
            prompt_key="video_planner.v1",
            allowed_tools=["read_authorized_context"],
        ),
        context={"generationInput": {"property": {"district": "Donnée privée"}}},
    )

    message = _input_items(request)[0]["content"][0]["text"]
    assert "Donnée privée" not in message
    assert "read_authorized_context" in message


def test_role_boundary_rejects_unauthorized_tool_and_images() -> None:
    request = AgentTaskRequest(
        run_id="agent-run-test",
        task_id="agent-task-test",
        trace_id="trace_0123456789abcdef0123456789abcdef",
        definition=AgentDefinition(
            agent_key="plan_fixer",
            model="gpt-5.6-luna",
            prompt_key="plan_fixer.v1",
            allowed_tools=["read_authorized_context"],
        ),
        context={"subjectArtifact": {}, "review": {}},
        image_urls=["https://example.test/image.jpg"],
    )
    try:
        _validate_role_boundary(request)
    except ValueError:
        return
    raise AssertionError("Le runner doit refuser un outil ou des images non autorisés.")
