import type { SupabaseClient } from "@supabase/supabase-js";
import { toProject, type Project } from "@/lib/projects/types";

const PROJECT_SELECT =
  "id, owner_id, name, description, status, canvas_storage_path, created_at, updated_at";

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
    throw new Error(`Failed to list projects: ${error.message}`);
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
    throw new Error(`Failed to create project: ${error.message}`);
  }

  return toProject(data);
}

export async function listSharedProjects(
  supabase: SupabaseClient,
  userEmail: string
): Promise<Project[]> {
  if (!userEmail) return [];
  const { data, error } = await supabase
    .from("project_collaborators")
    .select(`project:${PROJECT_SELECT}`)
    .eq("email", userEmail)
    .order("created_at", { ascending: false, referencedTable: "project" });

  if (error) {
    throw new Error(`Failed to list shared projects: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => (row as { project: unknown }).project)
    .filter((p): p is NonNullable<typeof p> => p != null)
    .map((row) => toProject(row as Parameters<typeof toProject>[0]));
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
    throw new Error(`Failed to fetch project: ${error.message}`);
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
    throw new Error(`Failed to rename project: ${error.message}`);
  }

  return toProject(data);
}

export async function deleteProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }
}
