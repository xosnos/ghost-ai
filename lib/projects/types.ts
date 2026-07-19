export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ARCHIVED";
  canvasStoragePath: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ARCHIVED";
  canvas_storage_path: string | null;
  created_at: string;
  updated_at: string;
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    status: row.status,
    canvasStoragePath: row.canvas_storage_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
