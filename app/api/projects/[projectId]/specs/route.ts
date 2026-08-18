import { NextResponse } from "next/server";
import { hasProjectAccess } from "@/lib/project-access";
import { errorResponse, getProject } from "@/lib/projects/queries";
import { listProjectSpecs } from "@/lib/specs/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

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

    const specs = await listProjectSpecs(supabase, projectId, project.name);
    return NextResponse.json({ specs });
  } catch (err) {
    return errorResponse(err);
  }
}
