from __future__ import annotations

import hmac
import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException

from .agents import execute_task
from .schemas import AgentTaskRequest, AgentTaskResponse


app = FastAPI(title="Terrova Agent Runner", docs_url=None, redoc_url=None)


def _assert_service_secret(candidate: Optional[str]) -> None:
    expected = os.environ.get("AGENT_RUNNER_SHARED_SECRET")
    if not expected or not candidate or not hmac.compare_digest(expected, candidate):
        raise HTTPException(status_code=401, detail="Service non autorisé.")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/tasks/run", response_model=AgentTaskResponse)
async def run_task(
    request: AgentTaskRequest,
    x_terrova_agent_secret: Optional[str] = Header(default=None),
) -> AgentTaskResponse:
    _assert_service_secret(x_terrova_agent_secret)
    output = await execute_task(request)
    return AgentTaskResponse(output=output, trace_id=request.trace_id)
