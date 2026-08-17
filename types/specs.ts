export interface ProjectSpec {
  id: string;
  taskRunId: string;
  projectId: string;
  filePath: string;
  createdAt: string;
}

export interface ProjectSpecRow {
  id: string;
  task_run_id: string;
  project_id: string;
  file_path: string;
  created_at: string;
}

export interface ProjectSpecSummary {
  id: string;
  taskRunId: string;
  projectId: string;
  createdAt: string;
  fileName: string;
}

export interface ProjectSpecDetail extends ProjectSpecSummary {
  content: string;
}

export interface SpecGenerationInput {
  roomId: string;
  chatHistory?: unknown[];
  nodes?: unknown[];
  edges?: unknown[];
  [key: string]: unknown;
}
