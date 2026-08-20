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

    const { error: canvasError } = await admin.storage
      .from(CANVAS_BUCKET)
      .remove([canvasKey, canvasPrefixedKey]);

    if (canvasError) {
      throw new Error(
        `Failed to delete canvas storage for project ${projectId}: ${canvasError.message}`,
      );
    }

    const { data: specFiles, error: listError } = await admin.storage
      .from(SPECS_BUCKET)
      .list(projectId);

    if (listError) {
      throw new Error(`Failed to list spec storage for project ${projectId}: ${listError.message}`);
    }

    if (specFiles?.length) {
      const specPaths = specFiles.map((file) => `${projectId}/${file.name}`);
      const { error: specError } = await admin.storage.from(SPECS_BUCKET).remove(specPaths);

      if (specError) {
        throw new Error(
          `Failed to delete spec storage for project ${projectId}: ${specError.message}`,
        );
      }
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
