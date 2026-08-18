import { NextRequest, NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { hasProjectAccess } from "@/lib/project-access";
import {
  enqueueTaskRun,
  invokeAiWorkerFastPath,
  ActiveTaskRunConflictError,
} from "@/lib/ai/task-runs";

const MAX_SPEC_NODES = 250;
const MAX_SPEC_EDGES = 500;
const MAX_SPEC_CHAT_HISTORY = 50;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const { roomId, chatHistory, nodes, edges } = body as {
    roomId?: unknown;
    chatHistory?: unknown;
    nodes?: unknown;
    edges?: unknown;
  };

  if (typeof roomId !== "string" || !roomId.trim()) {
    return NextResponse.json(
      { error: "A valid roomId is required" },
      { status: 400 }
    );
  }

  if (chatHistory !== undefined && !Array.isArray(chatHistory)) {
    return NextResponse.json(
      { error: "chatHistory must be an array if provided" },
      { status: 400 }
    );
  }

  if (nodes !== undefined && !Array.isArray(nodes)) {
    return NextResponse.json(
      { error: "nodes must be an array if provided" },
      { status: 400 }
    );
  }

  if (edges !== undefined && !Array.isArray(edges)) {
    return NextResponse.json(
      { error: "edges must be an array if provided" },
      { status: 400 }
    );
  }

  const normalizedChatHistory = Array.isArray(chatHistory)
    ? chatHistory.slice(-MAX_SPEC_CHAT_HISTORY)
    : [];
  const normalizedNodes = Array.isArray(nodes) ? nodes : [];
  const normalizedEdges = Array.isArray(edges) ? edges : [];

  if (normalizedNodes.length > MAX_SPEC_NODES) {
    return NextResponse.json(
      { error: `nodes must contain ${MAX_SPEC_NODES} items or fewer` },
      { status: 400 }
    );
  }

  if (normalizedEdges.length > MAX_SPEC_EDGES) {
    return NextResponse.json(
      { error: `edges must contain ${MAX_SPEC_EDGES} items or fewer` },
      { status: 400 }
    );
  }

  const trimmedRoomId = roomId.trim();

  // 1. Authenticate current user
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Resolve project access from roomId (projectId); do not trust client-supplied project IDs
  const hasAccess = await hasProjectAccess(supabase, trimmedRoomId, {
    userId: user.id,
    email: user.email ?? "",
  });

  if (!hasAccess) {
    return NextResponse.json(
      { error: "Project not found or access denied" },
      { status: 403 }
    );
  }

  // 3. Transactionally enqueue spec task run and send payload to ai-generation queue
  let runId: string;
  try {
    runId = await enqueueTaskRun({
      projectId: trimmedRoomId,
      userId: user.id,
      kind: "spec",
      input: {
        roomId: trimmedRoomId,
        chatHistory: normalizedChatHistory,
        nodes: normalizedNodes,
        edges: normalizedEdges,
      },
    });
  } catch (err: unknown) {
    if (err instanceof ActiveTaskRunConflictError) {
      return NextResponse.json(
        { error: "An AI generation task is already active for this project" },
        { status: 409 }
      );
    }
    console.error("[POST /api/ai/spec] Enqueue error:", err);
    return NextResponse.json(
      { error: "Failed to enqueue spec generation task" },
      { status: 500 }
    );
  }

  // 4. Best-effort fast-path Edge Function invocation after transaction commits
  invokeAiWorkerFastPath().catch((err) => {
    console.error("[POST /api/ai/spec] Fast-path invocation failed:", err);
  });

  // 5. Return run ID with HTTP 202 Accepted
  return NextResponse.json(
    { runId },
    { status: 202 }
  );
}
