import type { SupabaseClient } from "@supabase/supabase-js";
import { ProjectQueryError } from "@/lib/projects/queries";

export interface Collaborator {
  id: string;
  projectId: string;
  email: string;
  createdAt: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: "owner" | "collaborator";
}

interface CollaboratorRpcRow {
  id: string;
  project_id: string;
  email: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
  role?: string | null;
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

function metadataString(meta: unknown, keys: string[]): string | null {
  if (!meta || typeof meta !== "object") return null;
  const record = meta as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function withProjectOwner(
  collaborators: Collaborator[],
  params: {
    ownerId: string;
    projectId: string;
    createdAt: string;
    currentUser: {
      id: string;
      email?: string | null;
      user_metadata?: unknown;
    };
  }
): Collaborator[] {
  const tagged = collaborators.map((person) =>
    person.id === params.ownerId || person.role === "owner"
      ? { ...person, role: "owner" as const }
      : { ...person, role: "collaborator" as const }
  );

  if (tagged.some((person) => person.role === "owner")) {
    return [
      ...tagged.filter((person) => person.role === "owner"),
      ...tagged.filter((person) => person.role !== "owner"),
    ];
  }

  if (params.currentUser.id !== params.ownerId) {
    return tagged;
  }

  const meta = params.currentUser.user_metadata;
  return [
    {
      id: params.ownerId,
      projectId: params.projectId,
      email: params.currentUser.email ?? "",
      createdAt: params.createdAt,
      displayName: metadataString(meta, [
        "full_name",
        "name",
        "display_name",
        "preferred_username",
      ]),
      avatarUrl: metadataString(meta, ["avatar_url", "picture"]),
      role: "owner",
    },
    ...tagged,
  ];
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
    email: row.email ?? "",
    createdAt: row.created_at,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role === "owner" ? "owner" : "collaborator",
  }));
}

export async function inviteCollaborator(
  supabase: SupabaseClient,
  params: { projectId: string; email: string; ownerEmail?: string; ownerId: string }
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
    owner_uuid: params.ownerId,
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
    role: "collaborator",
  };
}

export async function removeCollaborator(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    email: string;
    ownerId: string;
    ownerEmail?: string;
  }
): Promise<void> {
  const email = normalizeEmail(params.email);
  if (!isValidEmail(email)) {
    throw new Error("Enter a valid email address");
  }

  if (params.ownerEmail && normalizeEmail(params.ownerEmail) === email) {
    throw new Error("Cannot remove the project owner");
  }

  const { data, error } = await supabase.rpc("remove_project_collaborator", {
    project_uuid: params.projectId,
    collaborator_email: email,
    owner_uuid: params.ownerId,
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
