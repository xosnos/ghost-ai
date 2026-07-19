import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  deleteProject,
  getProject,
  renameProject,
} from "@/lib/projects/queries";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  }

  let body: { name?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) {
    return NextResponse.json({ error: "Project name cannot be empty" }, { status: 400 });
  }

  const existing = await getProject(projectId);
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const project = await renameProject({ projectId, name });
    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  }

  const existing = await getProject(projectId);
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteProject(projectId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
