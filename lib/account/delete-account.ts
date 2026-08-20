import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CANVAS_BUCKET, getCanvasStorageKey } from "@/lib/canvas-storage";
import { listOwnedProjects } from "@/lib/projects/queries";
import { SPECS_BUCKET } from "@/lib/specs/queries";

const SPEC_LIST_PAGE_SIZE = 100;
const SPEC_REMOVE_BATCH_SIZE = 100;

async function listAllSpecPaths(admin: SupabaseClient, projectId: string): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage.from(SPECS_BUCKET).list(projectId, {
      limit: SPEC_LIST_PAGE_SIZE,
      offset,
    });

    if (error) {
      throw new Error(`Failed to list spec storage for project ${projectId}: ${error.message}`);
    }

    if (!data?.length) {
      break;
    }

    for (const file of data) {
      if (file.name) {
        paths.push(`${projectId}/${file.name}`);
      }
    }

    if (data.length < SPEC_LIST_PAGE_SIZE) {
      break;
    }

    offset += data.length;
  }

  return paths;
}

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

    const specPaths = await listAllSpecPaths(admin, projectId);

    for (let index = 0; index < specPaths.length; index += SPEC_REMOVE_BATCH_SIZE) {
      const batch = specPaths.slice(index, index + SPEC_REMOVE_BATCH_SIZE);
      const { error: specError } = await admin.storage.from(SPECS_BUCKET).remove(batch);

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
