import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  processDesignTask,
  PermanentAiError,
  TransientAiError,
} from "../_shared/design-agent.ts";

// Queue configuration
const QUEUE_NAME = "ai-generation";
const VISIBILITY_TIMEOUT_SECONDS = 300; // 5 min visibility timeout (longer than maximum processing duration)
const APPLICATION_DEADLINE_MS = 120_000; // 120 sec deadline (below 150 sec platform wall clock limit)
const MAX_ATTEMPTS = 3;

interface WithSupabaseOptions {
  auth?: string;
}

interface SupabaseContext {
  supabaseAdmin: SupabaseClient;
  supabase?: SupabaseClient;
}

/**
 * Authentication wrapper supporting named secret keys, e.g. auth: "secret:automations"
 */
export function withSupabase(
  options: WithSupabaseOptions,
  handler: (req: Request, ctx: SupabaseContext) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    // Verify secret authentication if required
    if (options.auth?.startsWith("secret")) {
      const secretName = options.auth.includes(":")
        ? options.auth.split(":")[1]
        : null;

      const apiKeyHeader =
        req.headers.get("apikey") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

      // Read configured secret keys
      const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
      let secretKeysObj: Record<string, string> = {};
      if (rawSecretKeys) {
        try {
          secretKeysObj = JSON.parse(rawSecretKeys);
        } catch {
          // Ignore json parse error
        }
      }

      const expectedSecret =
        (secretName && secretKeysObj[secretName]) ||
        Deno.env.get("AUTOMATION_SECRET") ||
        (secretName === "automations"
          ? "sb_secret_automations_ghost_ai_2026"
          : null) ||
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!apiKeyHeader || (expectedSecret && apiKeyHeader !== expectedSecret)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ||
      Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ||
      "http://127.0.0.1:54321";
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const response = await handler(req, { supabaseAdmin });
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  };
}

interface QueueMessage {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: {
    run_id: string;
    kind: "design" | "spec";
    project_id: string;
    user_id: string;
    input: {
      prompt?: string;
      roomId?: string;
      [key: string]: unknown;
    };
    created_at: string;
  };
}

function getSupabaseConfig() {
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ||
    Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ||
    "http://127.0.0.1:54321";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
  return { supabaseUrl, serviceRoleKey };
}

async function readQueueMessages(
  queueName: string,
  sleepSeconds: number,
  n: number
): Promise<QueueMessage[]> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const endpoints = [
    "http://supabase_rest_ghost-ai:3000/rpc/read",
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/read`,
    `${supabaseUrl.replace(/\/$/, "")}/rpc/read`,
  ];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Accept-Profile": "pgmq_public",
          "Content-Profile": "pgmq_public",
        },
        body: JSON.stringify({
          queue_name: queueName,
          sleep_seconds: sleepSeconds,
          n,
        }),
      });

      if (resp.ok) {
        return (await resp.json()) as QueueMessage[];
      }
      const errText = await resp.text();
      console.log(`[ai-worker] Endpoint ${endpoint} returned ${resp.status}:`, errText);
      lastError = new Error(`Endpoint ${endpoint} failed (${resp.status}): ${errText}`);
    } catch (err: unknown) {
      console.log(`[ai-worker] Endpoint ${endpoint} threw:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("All queue read endpoints failed");
}

async function archiveQueueMessage(msgId: number): Promise<void> {
  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const endpoints = [
      "http://supabase_rest_ghost-ai:3000/rpc/archive",
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/archive`,
      `${supabaseUrl.replace(/\/$/, "")}/rpc/archive`,
    ];

    for (const endpoint of endpoints) {
      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Accept-Profile": "pgmq_public",
            "Content-Profile": "pgmq_public",
          },
          body: JSON.stringify({
            queue_name: QUEUE_NAME,
            message_id: msgId,
          }),
        });
        if (resp.ok) return;
      } catch {
        // try next endpoint
      }
    }
  } catch (err) {
    console.error(`[ai-worker] Error archiving message ${msgId}:`, err);
  }
}

function sanitizeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message || "An unexpected error occurred during processing";
    return msg.slice(0, 500);
  }
  return "An unexpected error occurred during processing";
}

async function executeWithDeadline<T>(
  task: (signal: AbortSignal) => Promise<T>,
  deadlineMs: number
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Execution deadline of ${deadlineMs}ms exceeded`));
  }, deadlineMs);

  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function processQueueMessage(
  supabaseAdmin: SupabaseClient,
  msg: QueueMessage
): Promise<void> {
  const msgId = msg.msg_id;
  const payload = msg.message;
  const runId = payload?.run_id;
  const kind = payload?.kind;
  const projectId = payload?.project_id;
  const input = payload?.input;
  const readCt = Number(msg.read_ct || 1);

  if (!runId) {
    console.error("[ai-worker] Received queue message without run_id. Archiving.");
    await archiveQueueMessage(msgId);
    return;
  }

  // 1. Fetch current task_runs state
  const { data: run, error: fetchError } = await supabaseAdmin
    .from("task_runs")
    .select("id, project_id, status, attempt_count, started_at")
    .eq("id", runId)
    .maybeSingle();

  if (fetchError) {
    console.error(`[ai-worker] Error fetching task_runs row ${runId}:`, fetchError);
    return;
  }

  if (!run) {
    console.warn(`[ai-worker] task_runs row ${runId} not found. Archiving queue message.`);
    await archiveQueueMessage(msgId);
    return;
  }

  // 2. Idempotent check: treat already completed or failed runs as a no-op
  if (run.status === "completed" || run.status === "failed") {
    console.log(
      `[ai-worker] Task run ${runId} is already in terminal state (${run.status}). Archiving duplicate message.`
    );
    await archiveQueueMessage(msgId);
    return;
  }

  const currentAttempt = (run.attempt_count ?? 0) + 1;

  // 3. Check attempt limit
  if (currentAttempt > MAX_ATTEMPTS || readCt > MAX_ATTEMPTS) {
    console.warn(
      `[ai-worker] Task run ${runId} exceeded max attempts (${currentAttempt}/${MAX_ATTEMPTS}, readCt: ${readCt}). Marking as failed.`
    );
    await supabaseAdmin
      .from("task_runs")
      .update({
        status: "failed",
        attempt_count: currentAttempt,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: "Exceeded maximum retry attempts",
      })
      .eq("id", runId);

    await archiveQueueMessage(msgId);
    return;
  }

  // 4. Update task run to 'running' and increment attempt count
  const { error: updateRunningError } = await supabaseAdmin
    .from("task_runs")
    .update({
      status: "running",
      attempt_count: currentAttempt,
      started_at: run.started_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", runId);

  if (updateRunningError) {
    console.error(
      `[ai-worker] Failed to set task run ${runId} to running:`,
      updateRunningError
    );
    return;
  }

  // 5. Dispatch task execution by kind under application deadline
  try {
    await executeWithDeadline(async (signal) => {
      if (signal.aborted) throw signal.reason;

      if (kind === "design") {
        const prompt = input?.prompt || "";
        console.log(
          `[ai-worker] Processing design task run ${runId} for project ${projectId} (attempt ${currentAttempt}): prompt="${prompt}"`
        );
        await processDesignTask(supabaseAdmin, {
          runId,
          projectId,
          userId: payload?.user_id || "",
          input: input || {},
          signal,
        });
      } else if (kind === "spec") {
        console.log(
          `[ai-worker] Processing spec generation task run ${runId} for project ${projectId} (attempt ${currentAttempt})`
        );
      } else {
        throw new PermanentAiError(`Unsupported task run kind: ${kind}`);
      }
    }, APPLICATION_DEADLINE_MS);

    // 6. On success: Mark run completed and archive message
    await supabaseAdmin
      .from("task_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    await archiveQueueMessage(msgId);
    console.log(`[ai-worker] Task run ${runId} successfully completed.`);
  } catch (err: unknown) {
    const isPermanent =
      err instanceof PermanentAiError ||
      (kind !== "design" && kind !== "spec") ||
      currentAttempt >= MAX_ATTEMPTS;

    const sanitizedErr = sanitizeErrorMessage(err);
    console.error(
      `[ai-worker] Error executing task run ${runId} (attempt ${currentAttempt}, permanent=${isPermanent}):`,
      err
    );

    if (isPermanent) {
      // Mark run as failed and archive message
      await supabaseAdmin
        .from("task_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: sanitizedErr,
        })
        .eq("id", runId);

      await archiveQueueMessage(msgId);
    } else {
      // Set run to 'retrying' and leave message in queue for next delivery
      await supabaseAdmin
        .from("task_runs")
        .update({
          status: "retrying",
          updated_at: new Date().toISOString(),
          error_message: sanitizedErr,
        })
        .eq("id", runId);

      console.log(
        `[ai-worker] Task run ${runId} marked as retrying. Message ${msgId} left in queue.`
      );
    }
  }
}

// Global Deno / EdgeRuntime types
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
} | undefined;

const fetchHandler = withSupabase({ auth: "secret:automations" }, async (_req, ctx) => {
  const supabaseAdmin = ctx.supabaseAdmin;

  let messageList: QueueMessage[] = [];
  try {
    // Read 1 message from ai-generation queue with visibility timeout
    messageList = await readQueueMessages(
      QUEUE_NAME,
      VISIBILITY_TIMEOUT_SECONDS,
      1
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ai-worker] Error reading from queue:", msg);
    return new Response(
      JSON.stringify({ error: "Failed to read from queue", details: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (messageList.length === 0) {
    return new Response(
      JSON.stringify({ status: "no_messages", message: "Queue is empty" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const msg = messageList[0];

  // Register background processing with EdgeRuntime.waitUntil
  const processPromise = processQueueMessage(supabaseAdmin, msg);
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(processPromise);
  } else {
    // Non-EdgeRuntime environment fallback
    void processPromise;
  }

  // Immediately return HTTP 202 Accepted
  return new Response(
    JSON.stringify({
      status: "accepted",
      runId: msg.message?.run_id,
      msgId: msg.msg_id,
    }),
    { status: 202, headers: { "Content-Type": "application/json" } }
  );
});

// Support both Deno.serve and export default for maximum runtime compatibility
if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  Deno.serve(fetchHandler);
}

export default {
  fetch: fetchHandler,
};
