import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ProjectQueryError } from "@/lib/projects/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export interface Collaborator {
  id: string;
  projectId: string;
  email: string;
  createdAt: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface CollaboratorRow {
  id: string;
  project_id: string;
  email: string;
  created_at: string;
}

function toCollaboratorBase(row: CollaboratorRow): Omit<
  Collaborator,
  "displayName" | "avatarUrl"
> {
  return {
    id: row.id,
    projectId: row.project_id,
    email: row.email,
    createdAt: row.created_at,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // Practical validation — rejects empty/whitespace and obvious non-emails.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function displayNameFromUser(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const candidates = [
    meta.full_name,
    meta.name,
    meta.display_name,
    meta.preferred_username,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function avatarUrlFromUser(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const candidates = [meta.avatar_url, meta.picture];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Look up a single Auth user by email via the Admin API.
 * Uses GoTrue's `filter` query (substring match on email/phone), then exacts.
 * Returns null when no matching user exists.
 */
async function findAuthUserByEmail(email: string): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  const normalized = normalizeEmail(email);
  const endpoint = new URL(`${url}/auth/v1/admin/users`);
  endpoint.searchParams.set("page", "1");
  endpoint.searchParams.set("per_page", "50");
  endpoint.searchParams.set("filter", normalized);

  const res = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(
      `[collaborators] auth admin lookup failed (${res.status}):`,
      await res.text().catch(() => "")
    );
    return null;
  }

  const body = (await res.json()) as { users?: User[] };
  const users = body.users ?? [];
  const match = users.find(
    (u) => typeof u.email === "string" && normalizeEmail(u.email) === normalized
  );
  return match ?? null;
}

async function enrichCollaborator(
  base: Omit<Collaborator, "displayName" | "avatarUrl">
): Promise<Collaborator> {
  try {
    const user = await findAuthUserByEmail(base.email);
    if (!user) {
      return { ...base, displayName: null, avatarUrl: null };
    }
    return {
      ...base,
      displayName: displayNameFromUser(user),
      avatarUrl: avatarUrlFromUser(user),
    };
  } catch (err) {
    console.error("[collaborators] enrich failed:", err);
    return { ...base, displayName: null, avatarUrl: null };
  }
}

export async function listCollaborators(
  projectId: string
): Promise<Collaborator[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("project_collaborators")
    .select("id, project_id, email, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ProjectQueryError(
      "Failed to list collaborators",
      "list_collaborators",
      error.message
    );
  }

  const rows = (data ?? []) as CollaboratorRow[];
  return Promise.all(rows.map((row) => enrichCollaborator(toCollaboratorBase(row))));
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

  const { data, error } = await supabase
    .from("project_collaborators")
    .insert({ project_id: params.projectId, email })
    .select("id, project_id, email, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("That email is already a collaborator");
    }
    throw new ProjectQueryError(
      "Failed to invite collaborator",
      "invite_collaborator",
      error.message
    );
  }

  return enrichCollaborator(toCollaboratorBase(data as CollaboratorRow));
}

export async function removeCollaborator(
  supabase: SupabaseClient,
  params: { projectId: string; email: string }
): Promise<void> {
  const email = normalizeEmail(params.email);
  if (!isValidEmail(email)) {
    throw new Error("Enter a valid email address");
  }

  const { data, error } = await supabase
    .from("project_collaborators")
    .delete()
    .eq("project_id", params.projectId)
    .ilike("email", email)
    .select("id");

  if (error) {
    throw new ProjectQueryError(
      "Failed to remove collaborator",
      "remove_collaborator",
      error.message
    );
  }

  if (!data || data.length === 0) {
    throw new Error("Collaborator not found");
  }
}

export { isValidEmail, normalizeEmail };
