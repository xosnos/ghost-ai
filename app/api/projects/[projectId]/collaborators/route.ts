import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getProject, errorResponse } from "@/lib/projects/queries";
import {
  inviteCollaborator,
  listCollaborators,
  removeCollaborator,
  normalizeEmail,
} from "@/lib/projects/collaborators";
import { hasProjectAccess } from "@/lib/project-access";

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

    const project = await getProject(supabase, projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const identity = {
      userId: user.id,
      email: user.email ?? "",
    };
    const allowed = await hasProjectAccess(supabase, projectId, identity);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const collaborators = await listCollaborators(supabase, projectId);
    const isOwner = project.ownerId === user.id;

    return NextResponse.json({ collaborators, isOwner });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, ctx: RouteContext) {
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

    let body: { email?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const email = typeof body.email === "string" ? body.email : "";
    if (!email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const project = await getProject(supabase, projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const collaborator = await inviteCollaborator(supabase, {
        projectId,
        email,
        ownerEmail: user.email ?? undefined,
        ownerId: user.id,
      });
      return NextResponse.json({ collaborator }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invite failed";
      if (
        message === "Enter a valid email address" ||
        message === "You already own this project" ||
        message === "That email is already a collaborator"
      ) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
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

    let body: { email?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const email = typeof body.email === "string" ? body.email : "";
    if (!normalizeEmail(email)) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const project = await getProject(supabase, projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      await removeCollaborator(supabase, { projectId, email, ownerId: user.id });
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Remove failed";
      if (message === "Collaborator not found") {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (message === "Enter a valid email address") {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
