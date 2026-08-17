import { createAdminClient } from "@/lib/supabase/admin";

export type TaskRunKind = "design" | "spec";
export type TaskRunStatus = "queued" | "running" | "retrying" | "completed" | "failed";

export interface TaskRun {
  id: string;
  projectId: string;
  userId: string;
  kind: TaskRunKind;
  status: TaskRunStatus;
  attemptCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export class ActiveTaskRunConflictError extends Error {
  constructor(message = "An AI task is already active for this project") {
    super(message);
    this.name = "ActiveTaskRunConflictError";
  }
}

export interface EnqueueTaskParams {
  projectId: string;
  userId: string;
  kind: TaskRunKind;
  input: Record<string, unknown>;
}

/**
 * Transactionally creates a task_runs row and sends an ai-generation queue message.
 * Throws ActiveTaskRunConflictError if an active task already exists for this project.
 */
export async function enqueueTaskRun(params: EnqueueTaskParams): Promise<string> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("enqueue_task_run", {
    p_project_id: params.projectId,
    p_user_id: params.userId,
    p_kind: params.kind,
    p_input: params.input,
  });

  if (error) {
    // Postgres error 23505 is unique_violation (from task_runs_active_project_idx)
    if (
      error.code === "23505" ||
      error.message?.includes("task_runs_active_project_idx") ||
      error.message?.includes("duplicate key value violates unique constraint")
    ) {
      throw new ActiveTaskRunConflictError();
    }
    throw new Error(`Failed to enqueue task run: ${error.message}`);
  }

  if (!data || typeof data !== "string") {
    throw new Error("Invalid response from enqueue_task_run database function");
  }

  return data;
}

/**
 * Best-effort fast-path invocation of the ai-worker Edge Function.
 * If this call fails or times out, the queued message will still be processed
 * by the Supabase Cron recovery runner.
 */
export async function invokeAiWorkerFastPath(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const automationSecret =
    process.env.AUTOMATION_SECRET || "sb_secret_automations_ghost_ai_2026";

  const workerUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/ai-worker`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: automationSecret,
        Authorization: `Bearer ${automationSecret}`,
      },
      body: JSON.stringify({ trigger: "api-fast-path" }),
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    if (!response.ok && response.status !== 202) {
      console.warn(
        `[ai-worker fast-path] Worker returned status ${response.status}; Cron recovery will handle queue.`
      );
    }
  } catch (err: unknown) {
    // Fast path is best-effort: log warning and let Cron recovery handle queue
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[ai-worker fast-path] Fast-path invocation skipped or timed out (${message}); Cron recovery will handle queue.`
    );
  }
}
