CREATE TABLE IF NOT EXISTS agent_definitions (
  agent_key TEXT PRIMARY KEY NOT NULL,
  model TEXT NOT NULL,
  prompt_key TEXT NOT NULL,
  allowed_tools_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
  run_id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  review_cycles INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS agent_runs_owner_id_idx ON agent_runs (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_tasks (
  task_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  agent_key TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  trace_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS agent_tasks_run_id_idx ON agent_tasks (run_id, created_at);

CREATE TABLE IF NOT EXISTS agent_artifacts (
  artifact_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  task_id TEXT,
  artifact_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS agent_artifacts_run_id_idx ON agent_artifacts (run_id, created_at);

CREATE TABLE IF NOT EXISTS agent_reviews (
  review_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS agent_reviews_run_id_idx ON agent_reviews (run_id, created_at);

CREATE TABLE IF NOT EXISTS agent_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  task_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS agent_events_run_id_idx ON agent_events (run_id, created_at);

INSERT OR IGNORE INTO agent_definitions (agent_key, model, prompt_key, allowed_tools_json, enabled, created_at, updated_at)
VALUES
  ('orchestrator', 'gpt-5.6-luna', 'orchestrator.v1', '[]', 1, unixepoch() * 1000, unixepoch() * 1000),
  ('video_planner', 'gpt-5.6-sol', 'video_planner.v1', '["read_authorized_context"]', 1, unixepoch() * 1000, unixepoch() * 1000),
  ('plan_reviewer', 'gpt-5.6-sol', 'plan_reviewer.v1', '["read_authorized_context", "read_subject_artifact"]', 1, unixepoch() * 1000, unixepoch() * 1000),
  ('plan_fixer', 'gpt-5.6-sol', 'plan_fixer.v1', '["read_subject_artifact", "read_review_findings"]', 1, unixepoch() * 1000, unixepoch() * 1000);
