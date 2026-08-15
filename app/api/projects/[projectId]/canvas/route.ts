import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getProject, errorResponse } from "@/lib/projects/queries";
import { hasProjectAccess } from "@/lib/project-access";
import {
  uploadCanvasSnapshot,
  downloadCanvasSnapshot,
  type CanvasData,
} from "@/lib/canvas-storage";
import type { CanvasNode, CanvasEdge } from "@/types/canvas";

interface RouteContext {
  params: Promise<{ projectId: string }>;
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
      const canvasData = await downloadCanvasSnapshot(
        supabase,
        project.canvasStoragePath
      );
      return NextResponse.json(canvasData);
    } catch (downloadErr) {
      console.warn(
        `[canvas-route] could not download saved canvas at "${project.canvasStoragePath}", returning empty canvas`,
        downloadErr
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
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const nodes = (Array.isArray(body.nodes) ? body.nodes : []) as CanvasNode[];
    const edges = (Array.isArray(body.edges) ? body.edges : []) as CanvasEdge[];

    const canvasData: CanvasData = { nodes, edges };
    const storagePath = await uploadCanvasSnapshot(
      supabase,
      projectId,
      canvasData
    );

    return NextResponse.json({ ok: true, storagePath });
  } catch (err) {
    return errorResponse(err);
  }
}
