import type { SupabaseClient } from "@supabase/supabase-js";
import { ProjectQueryError } from "@/lib/projects/queries";
import {
  type CanvasNode,
  type CanvasEdge,
  normalizeCanvasNode,
  normalizeCanvasEdges,
} from "@/types/canvas";

export const CANVAS_BUCKET = "canvas";

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export function getCanvasStorageKey(projectId: string): string {
  return `${projectId}.json`;
}

export function getCanvasStoragePath(projectId: string): string {
  return `${CANVAS_BUCKET}/${projectId}.json`;
}

export function parseStoragePath(storagePath: string): {
  bucket: string;
  path: string;
} {
  const normalized = storagePath.trim();
  if (normalized.startsWith(`${CANVAS_BUCKET}/`)) {
    return {
      bucket: CANVAS_BUCKET,
      path: normalized.slice(CANVAS_BUCKET.length + 1),
    };
  }
  return {
    bucket: CANVAS_BUCKET,
    path: normalized,
  };
}

export async function uploadCanvasSnapshot(
  supabase: SupabaseClient,
  projectId: string,
  canvasData: CanvasData
): Promise<string> {
  const filePath = getCanvasStorageKey(projectId);
  const jsonContent = JSON.stringify(canvasData);

  const { error: uploadError } = await supabase.storage
    .from(CANVAS_BUCKET)
    .upload(filePath, jsonContent, {
      contentType: "application/json",
      upsert: true,
    });

  if (uploadError) {
    throw new ProjectQueryError(
      "Failed to upload canvas snapshot",
      "upload_canvas_snapshot",
      uploadError.message
    );
  }

  const storagePath = getCanvasStoragePath(projectId);

  const { error: dbError } = await supabase
    .from("projects")
    .update({
      canvas_storage_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (dbError) {
    throw new ProjectQueryError(
      "Failed to update project canvas path",
      "update_project_canvas_path",
      dbError.message
    );
  }

  return storagePath;
}

export async function downloadCanvasSnapshot(
  supabase: SupabaseClient,
  storagePath: string
): Promise<CanvasData> {
  const { bucket, path } = parseStoragePath(storagePath);

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);

  if (error) {
    throw new ProjectQueryError(
      "Failed to download canvas snapshot",
      "download_canvas_snapshot",
      error.message
    );
  }

  try {
    const text = await data.text();
    const parsed = JSON.parse(text);
    const rawNodes: CanvasNode[] = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const rawEdges: CanvasEdge[] = Array.isArray(parsed.edges) ? parsed.edges : [];
    const nodes = rawNodes.map(normalizeCanvasNode);
    const edges = normalizeCanvasEdges(rawEdges, nodes);
    return {
      nodes,
      edges,
    };
  } catch (parseError) {
    const message =
      parseError instanceof Error ? parseError.message : "Invalid JSON";
    throw new ProjectQueryError(
      "Failed to parse canvas snapshot JSON",
      "parse_canvas_snapshot",
      message
    );
  }
}
