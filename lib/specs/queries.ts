import type { SupabaseClient } from "@supabase/supabase-js";
import { ProjectQueryError, StorageObjectNotFoundError } from "@/lib/projects/queries";
import {
  type ProjectSpec,
  type ProjectSpecRow,
  type ProjectSpecSummary,
} from "@/types/specs";

export const SPECS_BUCKET = "specs";

const SPEC_METADATA_SELECT = "id, task_run_id, project_id, created_at";
const SPEC_FULL_SELECT = "id, task_run_id, project_id, file_path, created_at";

export function slugifySpecName(name?: string | null): string {
  if (!name || !name.trim()) return "spec";
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "spec";
}

export function formatSpecFileName(params: {
  projectName?: string | null;
  taskRunId?: string;
  createdAt?: string;
}): string {
  const baseName = slugifySpecName(params.projectName);
  const shortRunId = params.taskRunId
    ? params.taskRunId.replace(/-/g, "").slice(0, 8)
    : "";

  if (baseName !== "spec" && shortRunId) {
    return `${baseName}-spec-${shortRunId}.md`;
  }
  if (baseName !== "spec") {
    return `${baseName}-spec.md`;
  }
  if (shortRunId) {
    return `spec-${shortRunId}.md`;
  }
  return "spec.md";
}

export function parseSpecStoragePath(storagePath: string): {
  bucket: string;
  path: string;
} {
  const normalized = storagePath.trim();
  if (normalized.startsWith(`${SPECS_BUCKET}/`)) {
    return {
      bucket: SPECS_BUCKET,
      path: normalized.slice(SPECS_BUCKET.length + 1),
    };
  }
  return {
    bucket: SPECS_BUCKET,
    path: normalized,
  };
}

export function toProjectSpec(row: ProjectSpecRow): ProjectSpec {
  return {
    id: row.id,
    taskRunId: row.task_run_id,
    projectId: row.project_id,
    filePath: row.file_path,
    createdAt: row.created_at,
  };
}

export function toProjectSpecSummary(
  row: { id: string; task_run_id: string; project_id: string; created_at: string },
  projectName?: string | null
): ProjectSpecSummary {
  return {
    id: row.id,
    taskRunId: row.task_run_id,
    projectId: row.project_id,
    createdAt: row.created_at,
    fileName: formatSpecFileName({
      projectName,
      taskRunId: row.task_run_id,
      createdAt: row.created_at,
    }),
  };
}

/**
 * Lists spec metadata for a project (newest first).
 * Does NOT select or expose internal storage paths (`file_path`).
 */
export async function listProjectSpecs(
  supabase: SupabaseClient,
  projectId: string,
  projectName?: string | null
): Promise<ProjectSpecSummary[]> {
  const { data, error } = await supabase
    .from("project_specs")
    .select(SPEC_METADATA_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ProjectQueryError(
      "Failed to list project specs",
      "list_project_specs",
      error.message
    );
  }

  return (data ?? []).map((row) => toProjectSpecSummary(row, projectName));
}

/**
 * Fetches a single project spec record with its storage path.
 * Verifies that the spec belongs to the specified project.
 */
export async function getProjectSpec(
  supabase: SupabaseClient,
  projectId: string,
  specId: string
): Promise<ProjectSpec | null> {
  const { data, error } = await supabase
    .from("project_specs")
    .select(SPEC_FULL_SELECT)
    .eq("id", specId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    throw new ProjectQueryError(
      "Failed to fetch project spec",
      "get_project_spec",
      error.message
    );
  }

  return data ? toProjectSpec(data as ProjectSpecRow) : null;
}

/**
 * Securely downloads the spec markdown content from Supabase Storage.
 */
export async function downloadSpecMarkdown(
  supabase: SupabaseClient,
  filePath: string
): Promise<string> {
  const { bucket, path } = parseSpecStoragePath(filePath);

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);

  if (error) {
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? String((error as { statusCode?: string | number }).statusCode ?? "")
        : "";
    const errorName =
      typeof error === "object" && error !== null && "name" in error
        ? String((error as { name?: string }).name ?? "")
        : "";
    const isNotFound =
      statusCode === "404" ||
      errorName === "StorageObjectNotFoundError" ||
      /not found|404/i.test(error.message);

    if (isNotFound) {
      throw new StorageObjectNotFoundError(
        "download_spec_markdown",
        error.message
      );
    }

    throw new ProjectQueryError(
      "Failed to download spec from storage",
      "download_spec_markdown",
      error.message
    );
  }

  if (!data) {
    throw new StorageObjectNotFoundError(
      "download_spec_markdown",
      `Storage file empty for path: ${filePath}`
    );
  }

  try {
    return await data.text();
  } catch (textErr) {
    const msg = textErr instanceof Error ? textErr.message : "Failed to read spec text";
    throw new ProjectQueryError(
      "Failed to read spec markdown content",
      "download_spec_markdown",
      msg
    );
  }
}
