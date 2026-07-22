import type { SupabaseClient } from "@supabase/supabase-js";
import { ProjectQueryError } from "@/lib/projects/queries";

export interface Collaborator {
  id: string;
  projectId: string;
  email: string;
  createdAt: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface CollaboratorRpcRow {
  id: string;
  project_id: string;
  email: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CollaboratorInsertRow {
  id: string;
  project_id: string;
  email: string;
  created_at: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function listCollaborators(
  supabase: SupabaseClient,
  projectId: string
): Promise<Collaborator[]> {
  const { data, error } = await supabase.rpc("get_project_collaborators", {
    project_uuid: projectId,
  });

  if (error) {
    throw new ProjectQueryError(
      "Failed to list collaborators",
      "list_collaborators",
      error.message
    );
  }

  const rows = (data ?? []) as CollaboratorRpcRow[];
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    email: row.email,
    createdAt: row.created_at,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  }));
}

export async function inviteCollaborator(
  supabase: SupabaseClient,
  params: { projectId: string; email: string; ownerEmail?: string }
): Promise<Collaborator> {
  const email = normalizeEmail(params.email);
  if (!isValidEmail(email)) {
    throw new Error("Enter a valid email address");
  }

  if (params.ownerEmail && normalizeEmail(params.ownerEmail) === email) {
    throw new Error("You already own this project");
  }

  const { data, error } = await supabase.rpc("add_project_collaborator", {
    project_uuid: params.projectId,
    collaborator_email: email,
  });

  if (error) {
    if (error.message === "That email is already a collaborator") {
      throw new Error("That email is already a collaborator");
    }
    throw new ProjectQueryError(
      "Failed to invite collaborator",
      "invite_collaborator",
      error.message
    );
  }

  const rows = (data as unknown) as CollaboratorInsertRow[];
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) {
    throw new ProjectQueryError(
      "Failed to invite collaborator",
      "invite_collaborator",
      "No row returned from add_project_collaborator"
    );
  }
  return {
    id: row.id,
    projectId: row.project_id,
    email: row.email,
    createdAt: row.created_at,
    displayName: null,
    avatarUrl: null,
  };
}

export async function removeCollaborator(
  supabase: SupabaseClient,
  params: { projectId: string; email: string }
): Promise<void> {
  const email = normalizeEmail(params.email);
  if (!isValidEmail(email)) {
    throw new Error("Enter a valid email address");
  }

  const { data, error } = await supabase.rpc("remove_project_collaborator", {
    project_uuid: params.projectId,
    collaborator_email: email,
  });

  if (error) {
    throw new ProjectQueryError(
      "Failed to remove collaborator",
      "remove_collaborator",
      error.message
    );
  }

  const deletedCount = (data as number) ?? 0;
  if (deletedCount === 0) {
    throw new Error("Collaborator not found");
  }
}
