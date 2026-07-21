import type { SupabaseClient } from "@supabase/supabase-js";
import { getProject } from "@/lib/projects/queries";
import { getCurrentUser } from "@/lib/supabase/server";

export interface AuthIdentity {
  userId: string;
  email: string;
}

export async function getAuthIdentity(
  supabase: SupabaseClient
): Promise<AuthIdentity | null> {
  const user = await getCurrentUser(supabase);
  if (!user) return null;
  return {
    userId: user.id,
    email: user.email ?? "",
  };
}

async function isProjectCollaborator(
  supabase: SupabaseClient,
  projectId: string,
  email: string
): Promise<boolean> {
  if (!email) return false;

  const { data, error } = await supabase
    .from("project_collaborators")
    .select("id")
    .eq("project_id", projectId)
    .ilike("email", email)
    .maybeSingle();

  if (error) return false;
  return data != null;
}

export async function hasProjectAccess(
  supabase: SupabaseClient,
  projectId: string,
  identity: AuthIdentity
): Promise<boolean> {
  const project = await getProject(supabase, projectId);
  if (!project) return false;
  if (project.ownerId === identity.userId) return true;
  return isProjectCollaborator(supabase, projectId, identity.email);
}
