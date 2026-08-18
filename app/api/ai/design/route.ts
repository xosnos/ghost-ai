import { type NextRequest, NextResponse } from "next/server";
import {
  ActiveTaskRunConflictError,
  enqueueTaskRun,
  invokeAiWorkerFastPath,
} from "@/lib/ai/task-runs";
import { hasProjectAccess } from "@/lib/project-access";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

const MAX_DESIGN_PROMPT_LENGTH = 8_000;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const { prompt, roomId } = body as { prompt?: unknown; roomId?: unknown };

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "A non-empty prompt is required" }, { status: 400 });
  }

  if (typeof roomId !== "string" || !roomId.trim()) {
    return NextResponse.json({ error: "A valid roomId is required" }, { status: 400 });
  }

  const trimmedPrompt = prompt.trim();
  const trimmedRoomId = roomId.trim();

  if (trimmedPrompt.length > MAX_DESIGN_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt must be ${MAX_DESIGN_PROMPT_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  // 1. Authenticate user
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Resolve project access from roomId (projectId)
  const hasAccess = await hasProjectAccess(supabase, trimmedRoomId, {
    userId: user.id,
    email: user.email ?? "",
  });

  if (!hasAccess) {
    return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
  }

  // 3. Transactionally enqueue task run
  let runId: string;
  try {
    runId = await enqueueTaskRun({
      projectId: trimmedRoomId,
      userId: user.id,
      kind: "design",
      input: {
        prompt: trimmedPrompt,
        roomId: trimmedRoomId,
      },
    });
  } catch (err: unknown) {
    if (err instanceof ActiveTaskRunConflictError) {
      return NextResponse.json(
        { error: "An AI generation task is already active for this project" },
        { status: 409 },
      );
    }
    console.error("[POST /api/ai/design] Enqueue error:", err);
    return NextResponse.json(
      { error: "Failed to enqueue design generation task" },
      { status: 500 },
    );
  }

  // 4. Best-effort fast-path Edge Function invocation
  // Fast-path invocation does not block or fail durability
  invokeAiWorkerFastPath().catch((err) => {
    console.error("[POST /api/ai/design] Fast-path invocation failed:", err);
  });

  // 5. Return run ID with HTTP 202 Accepted
  return NextResponse.json({ runId }, { status: 202 });
}
