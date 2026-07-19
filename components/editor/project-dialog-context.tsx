"use client";

import { createContext, useContext } from "react";

export type DialogKind = "create" | "rename" | "delete" | null;

export interface ProjectDialogContextValue {
  openCreate: () => void;
  openRename: (projectId: string, currentName: string) => void;
  openDelete: (projectId: string, projectName: string) => void;
}

export const ProjectDialogContext = createContext<ProjectDialogContextValue | null>(null);

export function useProjectDialogs(): ProjectDialogContextValue {
  const ctx = useContext(ProjectDialogContext);
  if (!ctx) {
    throw new Error("useProjectDialogs must be used within a ProjectDialogContext provider");
  }
  return ctx;
}
