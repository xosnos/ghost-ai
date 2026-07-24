import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toProject, type Project } from "@/lib/projects/types";

const PROJECT_SELECT =
  "id, owner_id, name, description, status, canvas_storage_path, created_at, updated_at";

export class ProjectQueryError extends Error {
  constructor(
    message: string,
    readonly operation: string,
    readonly detail: string
  ) {
    super(message);
    this.name = "ProjectQueryError";
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof ProjectQueryError) {
    console.error(`[projects] ${err.operation}: ${err.detail}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[projects] unexpected error:", err);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function listOwnedProjects(
  supabase: SupabaseClient,
  ownerId: string
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ProjectQueryError(
      "Failed to list projects",
      "list_owned_projects",
      error.message
    );
  }

  return (data ?? []).map(toProject);
}

export async function createProject(
  supabase: SupabaseClient,
  params: { ownerId: string; name: string }
): Promise<Project> {
  const trimmed = params.name.trim() || "Untitled Project";
  const { data, error } = await supabase
    .from("projects")
    .insert({ owner_id: params.ownerId, name: trimmed })
    .select(PROJECT_SELECT)
    .single();

  if (error) {
    throw new ProjectQueryError(
      "Failed to create project",
      "create_project",
      error.message
    );
  }

  return toProject(data);
}

export async function listSharedProjects(
  supabase: SupabaseClient,
  userEmail: string
): Promise<Project[]> {
  if (!userEmail) return [];

  const { data: collaboratorRows, error: collabError } = await supabase
    .from("project_collaborators")
    .select("project_id")
    .eq("email", userEmail);

  if (collabError) {
    throw new ProjectQueryError(
      "Failed to list shared projects",
      "list_shared_collaborators",
      collabError.message
    );
  }

  const projectIds = (collaboratorRows ?? [])
    .map((r) => r.project_id)
    .filter((id): id is string => id != null);

  if (projectIds.length === 0) return [];

  const { data: projectRows, error: projectError } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .in("id", projectIds)
    .order("created_at", { ascending: false });

  if (projectError) {
    throw new ProjectQueryError(
      "Failed to list shared projects",
      "list_shared_projects",
      projectError.message
    );
  }

  return (projectRows ?? []).map(toProject);
}

export async function getProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new ProjectQueryError(
      "Failed to fetch project",
      "get_project",
      error.message
    );
  }

  return data ? toProject(data) : null;
}

export async function renameProject(
  supabase: SupabaseClient,
  params: { projectId: string; name: string }
): Promise<Project> {
  const trimmed = params.name.trim();
  if (!trimmed) {
    throw new Error("Project name cannot be empty");
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", params.projectId)
    .select(PROJECT_SELECT)
    .single();

  if (error) {
    throw new ProjectQueryError(
      "Failed to rename project",
      "rename_project",
      error.message
    );
  }

  return toProject(data);
}

export async function deleteProject(
  supabase: SupabaseClient,
  projectId: string,
  ownerId: string
): Promise<void> {
  const { error } = await supabase.rpc("delete_project", {
    project_uuid: projectId,
    owner_uuid: ownerId,
  });

  if (error) {
    throw new ProjectQueryError(
      "Failed to delete project",
      "delete_project",
      error.message
    );
  }
}
