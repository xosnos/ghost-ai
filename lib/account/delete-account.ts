import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CANVAS_BUCKET, getCanvasStorageKey } from "@/lib/canvas-storage";
import { listOwnedProjects } from "@/lib/projects/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const SPECS_BUCKET = "specs";

export async function deleteOwnedProjectStorage(
  admin: SupabaseClient,
  projectIds: string[],
): Promise<void> {
  for (const projectId of projectIds) {
    const canvasKey = getCanvasStorageKey(projectId);
    const canvasPrefixedKey = `${CANVAS_BUCKET}/${projectId}.json`;

    await admin.storage.from(CANVAS_BUCKET).remove([canvasKey, canvasPrefixedKey]);

    const { data: specFiles } = await admin.storage.from(SPECS_BUCKET).list(projectId);

    if (specFiles?.length) {
      const specPaths = specFiles.map((file) => `${projectId}/${file.name}`);
      await admin.storage.from(SPECS_BUCKET).remove(specPaths);
    }
  }
}

export async function deleteAccountForUser(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<void> {
  const ownedProjects = await listOwnedProjects(admin, userId);
  const projectIds = ownedProjects.map((project) => project.id);

  await deleteOwnedProjectStorage(admin, projectIds);

  const { error: collaboratorError } = await admin.rpc("delete_collaborator_rows_for_email", {
    p_email: email,
  });

  if (collaboratorError) {
    throw new Error(`Failed to remove collaborator rows: ${collaboratorError.message}`);
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    throw new Error(`Failed to delete user: ${deleteUserError.message}`);
  }
}

export function getAdminClientOrThrow(): SupabaseClient {
  return createAdminClient();
}
