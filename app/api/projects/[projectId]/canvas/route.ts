import { NextResponse } from "next/server";
import {
  type CanvasData,
  downloadCanvasSnapshot,
  uploadCanvasSnapshot,
} from "@/lib/canvas-storage";
import { hasProjectAccess } from "@/lib/project-access";
import { errorResponse, getProject } from "@/lib/projects/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { type CanvasEdge, type CanvasNode, NODE_SHAPES } from "@/types/canvas";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

const MAX_CANVAS_ITEMS = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCanvasNode(value: unknown): value is CanvasNode {
  if (!isRecord(value) || typeof value.id !== "string") return false;
  if (!isRecord(value.position)) return false;
  if (typeof value.position.x !== "number" || typeof value.position.y !== "number") {
    return false;
  }
  if (!isRecord(value.data)) return false;
  return (
    typeof value.data.label === "string" &&
    isRecord(value.data.color) &&
    typeof value.data.color.fill === "string" &&
    typeof value.data.color.text === "string" &&
    typeof value.data.shape === "string" &&
    NODE_SHAPES.includes(value.data.shape as (typeof NODE_SHAPES)[number])
  );
}

function isCanvasEdge(value: unknown): value is CanvasEdge {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.source === "string" &&
    typeof value.target === "string"
  );
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await ctx.params;
    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    const identity = { userId: user.id, email: user.email ?? "" };
    const allowed = await hasProjectAccess(supabase, projectId, identity);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await getProject(supabase, projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.canvasStoragePath) {
      return NextResponse.json({ nodes: [], edges: [] });
    }

    try {
      const canvasData = await downloadCanvasSnapshot(supabase, project.canvasStoragePath);
      return NextResponse.json(canvasData);
    } catch (downloadErr) {
      console.warn(
        `[canvas-route] could not download saved canvas at "${project.canvasStoragePath}", returning empty canvas`,
        downloadErr,
      );
      return NextResponse.json({ nodes: [], edges: [] });
    }
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request, ctx: RouteContext) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await ctx.params;
    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    const identity = { userId: user.id, email: user.email ?? "" };
    const allowed = await hasProjectAccess(supabase, projectId, identity);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { nodes?: unknown; edges?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    if (
      !Array.isArray(body.nodes) ||
      !Array.isArray(body.edges) ||
      body.nodes.length > MAX_CANVAS_ITEMS ||
      body.edges.length > MAX_CANVAS_ITEMS ||
      !body.nodes.every(isCanvasNode) ||
      !body.edges.every(isCanvasEdge)
    ) {
      return NextResponse.json({ error: "Invalid canvas data" }, { status: 400 });
    }

    const nodes = body.nodes;
    const edges = body.edges;

    const canvasData: CanvasData = { nodes, edges };
    const storagePath = await uploadCanvasSnapshot(supabase, projectId, canvasData);

    return NextResponse.json({ ok: true, storagePath });
  } catch (err) {
    return errorResponse(err);
  }
}
