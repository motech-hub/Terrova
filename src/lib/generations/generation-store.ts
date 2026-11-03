import { getCloudflareBindings } from "@/src/lib/cloudflare";
import { createTemporaryReadUrl, uploadTemporaryVideoFromUrl } from "@/src/lib/storage/r2";
import { consumeReservedCredits, releaseReservedCredits } from "@/src/lib/credits/credit-store";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type { GenerationJob, GenerationResult, GenerateVideoInput } from "@/src/lib/video/video-provider";

export type StoredGenerationJob = {
  jobId: string;
  sessionId: string;
  provider: GenerationJob["provider"];
  status: GenerationResult["status"];
  input: GenerateVideoInput;
  outputKey?: string;
  providerJobId?: string;
  providerStatusUrl?: string;
  creditCost?: number;
  creditReservationId?: string;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
};

const memoryStore = new Map<string, StoredGenerationJob>();

function getDatabase() {
  try {
    return getCloudflareBindings().DB;
  } catch {
    return undefined;
  }
}

function parseInput(inputJson: unknown) {
  if (typeof inputJson === "string") return JSON.parse(inputJson) as GenerateVideoInput;
  return inputJson as GenerateVideoInput;
}

function toTimestamp(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function parseProvider(value: string): GenerationJob["provider"] {
  if (value === "make" || value === "openrouter" || value === "demo") return value;
  return "demo";
}

function parseStatus(value: string): GenerationResult["status"] {
  if (
    value === "pending" ||
    value === "analyzing" ||
    value === "generating" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed"
  ) {
    return value;
  }
  return "processing";
}

function isTerminal(status: GenerationResult["status"]) {
  return status === "completed" || status === "failed";
}

function rowToJob(row: Record<string, unknown>): StoredGenerationJob {
  return {
    jobId: String(row.job_id),
    sessionId: String(row.user_id ?? row.session_id),
    provider: parseProvider(String(row.provider)),
    status: parseStatus(String(row.status)),
    input: parseInput(row.input_json),
    outputKey: row.output_key ? String(row.output_key) : undefined,
    providerJobId: row.provider_job_id ? String(row.provider_job_id) : undefined,
    providerStatusUrl: row.provider_status_url ? String(row.provider_status_url) : undefined,
    creditCost: row.credit_cost ? Number(row.credit_cost) : undefined,
    creditReservationId: row.credit_reservation_id ? String(row.credit_reservation_id) : undefined,
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  };
}

async function readFromSupabase(jobId: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return undefined;

  const { data, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToJob(data) : undefined;
}

async function readFromDatabase(jobId: string) {
  const database = getDatabase();
  if (!database) return undefined;

  try {
    const result = await database
      .prepare("SELECT * FROM generation_jobs WHERE job_id = ?1")
      .bind(jobId)
      .first<Record<string, unknown>>();
    return result ? rowToJob(result) : undefined;
  } catch {
    return undefined;
  }
}

export async function getGenerationJob(jobId: string) {
  if (createSupabaseAdminClient()) return readFromSupabase(jobId);
  return (await readFromDatabase(jobId)) ?? memoryStore.get(jobId);
}

export async function findGenerationByInput(input: GenerateVideoInput) {
  const serializedInput = JSON.stringify(input);
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("user_id", input.sessionId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const match = data
      .map((row) => rowToJob(row))
      .find((job) => JSON.stringify(job.input) === serializedInput);
    return match;
  }

  const database = getDatabase();
  if (database) {
    try {
      const result = await database
        .prepare(
          "SELECT * FROM generation_jobs WHERE session_id = ?1 AND input_json = ?2 ORDER BY created_at DESC LIMIT 1",
        )
        .bind(input.sessionId, serializedInput)
        .first<Record<string, unknown>>();
      if (result) return rowToJob(result);
    } catch {
      // The in-memory fallback keeps local preview usable before D1 migration.
    }
  }

  return [...memoryStore.values()]
    .filter((job) => job.sessionId === input.sessionId && JSON.stringify(job.input) === serializedInput)
    .sort((left, right) => right.createdAt - left.createdAt)[0];
}

export async function saveGenerationJob(
  input: GenerateVideoInput,
  result: GenerationJob,
) {
  const now = Date.now();
  const record: StoredGenerationJob = {
    jobId: result.jobId,
    sessionId: input.sessionId,
    provider: result.provider,
    status: result.status,
    input,
    providerJobId: result.jobId,
    providerStatusUrl: result.providerStatusUrl,
    creditCost: result.creditCost,
    creditReservationId: result.creditReservationId,
    createdAt: now,
    updatedAt: now,
  };
  memoryStore.set(record.jobId, record);

  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.from("generation_jobs").upsert(
      {
        job_id: record.jobId,
        user_id: record.sessionId,
        provider: record.provider,
        status: record.status,
        input_json: record.input,
        output_key: null,
        provider_job_id: record.providerJobId,
        provider_status_url: record.providerStatusUrl ?? null,
        error_message: null,
        credit_cost: record.creditCost ?? null,
        credit_reservation_id: record.creditReservationId ?? null,
        created_at: new Date(record.createdAt).toISOString(),
        updated_at: new Date(record.updatedAt).toISOString(),
      },
      { onConflict: "job_id" },
    );
    if (error) throw error;
    return record;
  }

  const database = getDatabase();
  if (!database) return record;

  try {
    await database
      .prepare(
        `INSERT OR REPLACE INTO generation_jobs
          (job_id, session_id, provider, status, input_json, output_key, provider_job_id, provider_status_url, error_message, credit_cost, credit_reservation_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
      )
      .bind(
        record.jobId,
        record.sessionId,
        record.provider,
        record.status,
        JSON.stringify(record.input),
        null,
        record.providerJobId,
        record.providerStatusUrl ?? null,
        null,
        record.creditCost ?? null,
        record.creditReservationId ?? null,
        record.createdAt,
        record.updatedAt,
      )
      .run();
  } catch {
    // The in-memory fallback keeps local preview usable before D1 migration.
  }

  return record;
}

export async function updateGenerationJob(
  jobId: string,
  result: Pick<GenerationResult, "status" | "message"> & { outputKey?: string },
) {
  const current = await getGenerationJob(jobId);
  if (!current) return undefined;

  if (isTerminal(current.status)) return current;

  if (current.creditCost && current.creditReservationId) {
    if (result.status === "completed") {
      await consumeReservedCredits(current.sessionId, current.creditCost, current.creditReservationId);
    } else if (result.status === "failed") {
      await releaseReservedCredits(current.sessionId, current.creditCost, current.creditReservationId);
    }
  }

  const updated: StoredGenerationJob = {
    ...current,
    status: result.status,
    outputKey: result.outputKey ?? current.outputKey,
    errorMessage: result.status === "failed" ? result.message : current.errorMessage,
    updatedAt: Date.now(),
  };
  memoryStore.set(jobId, updated);

  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase
      .from("generation_jobs")
      .update({
        status: updated.status,
        output_key: updated.outputKey ?? null,
        error_message: updated.errorMessage ?? null,
        updated_at: new Date(updated.updatedAt).toISOString(),
      })
      .eq("job_id", jobId);
    if (error) throw error;
    return updated;
  }

  const database = getDatabase();
  if (database) {
    try {
      await database
        .prepare(
          `UPDATE generation_jobs
           SET status = ?1, output_key = ?2, error_message = ?3, updated_at = ?4
           WHERE job_id = ?5`,
        )
        .bind(
          updated.status,
          updated.outputKey ?? null,
          updated.errorMessage ?? null,
          updated.updatedAt,
          jobId,
        )
        .run();
    } catch {
      // The in-memory copy remains the safe preview fallback.
    }
  }

  return updated;
}

export async function finalizeGeneration(jobId: string, result: GenerationResult) {
  const current = await getGenerationJob(jobId);
  if (!current) return result;

  const { videoDownloadHeaders: _videoDownloadHeaders, ...publicResult } = result;

  if (publicResult.status === "completed" && publicResult.videoUrl && !current.outputKey) {
    try {
      const storedVideo = await uploadTemporaryVideoFromUrl(
        current.sessionId,
        publicResult.videoUrl,
        _videoDownloadHeaders,
      );
      if (storedVideo.key) {
        await updateGenerationJob(jobId, { status: "completed", outputKey: storedVideo.key });
        const readUrl = await createTemporaryReadUrl(storedVideo.key);
        return { ...publicResult, videoUrl: readUrl.url };
      }
    } catch {
      // Keep the provider URL as a temporary fallback if R2 is unavailable.
    }
  }

  if (publicResult.status === "completed" || publicResult.status === "failed") {
    await updateGenerationJob(jobId, {
      status: publicResult.status,
      message: publicResult.message,
    });
  } else {
    await updateGenerationJob(jobId, { status: publicResult.status });
  }

  if (current.outputKey) {
    const readUrl = await createTemporaryReadUrl(current.outputKey);
    return { ...publicResult, videoUrl: readUrl.url };
  }

  return publicResult;
}
