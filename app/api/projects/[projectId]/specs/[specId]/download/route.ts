import { NextResponse } from "next/server";
import { hasProjectAccess } from "@/lib/project-access";
import { errorResponse, getProject, StorageObjectNotFoundError } from "@/lib/projects/queries";
import { downloadSpecMarkdown, formatSpecFileName, getProjectSpec } from "@/lib/specs/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{
    projectId: string;
    specId: string;
  }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, specId } = await ctx.params;
    if (!projectId || !specId) {
      return NextResponse.json({ error: "Missing projectId or specId" }, { status: 400 });
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

    const spec = await getProjectSpec(supabase, projectId, specId);
    if (!spec) {
      return NextResponse.json({ error: "Spec not found" }, { status: 404 });
    }

    let markdownContent: string;
    try {
      markdownContent = await downloadSpecMarkdown(supabase, spec.filePath);
    } catch (storageErr) {
      if (storageErr instanceof StorageObjectNotFoundError) {
        return NextResponse.json({ error: "Spec file not found in storage" }, { status: 404 });
      }
      throw storageErr;
    }

    const fileName = formatSpecFileName({
      projectName: project.name,
      taskRunId: spec.taskRunId,
      createdAt: spec.createdAt,
    });

    return new Response(markdownContent, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-cache, no-transform",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
