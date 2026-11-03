CREATE TABLE IF NOT EXISTS generation_jobs (
  job_id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_key TEXT,
  provider_job_id TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS generation_jobs_session_id_idx
  ON generation_jobs (session_id);

CREATE INDEX IF NOT EXISTS generation_jobs_status_idx
  ON generation_jobs (status);
