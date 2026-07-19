"use client";

import { useCallback, useMemo, useState } from "react";
import { slugify } from "@/lib/utils";
import type { DialogKind } from "@/components/editor/project-dialog-context";

export interface RenameTarget {
  projectId: string;
  currentName: string;
}

export interface DeleteTarget {
  projectId: string;
  projectName: string;
}

export interface UseProjectDialogsResult {
  openDialog: DialogKind;
  createName: string;
  createSlug: string;
  renameTarget: RenameTarget | null;
  renameName: string;
  deleteTarget: DeleteTarget | null;
  loading: boolean;
  openCreate: () => void;
  openRename: (projectId: string, currentName: string) => void;
  openDelete: (projectId: string, projectName: string) => void;
  closeDialog: () => void;
  setCreateName: (value: string) => void;
  setRenameName: (value: string) => void;
  submitCreate: () => Promise<void>;
  submitRename: () => Promise<void>;
  submitDelete: () => Promise<void>;
}

export function useProjectDialogs(): UseProjectDialogsResult {
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [createName, setCreateName] = useState("");
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [loading, setLoading] = useState(false);

  const createSlug = useMemo(() => slugify(createName), [createName]);

  const openCreate = useCallback(() => {
    setCreateName("");
    setOpenDialog("create");
  }, []);

  const openRename = useCallback((projectId: string, currentName: string) => {
    setRenameTarget({ projectId, currentName });
    setRenameName(currentName);
    setOpenDialog("rename");
  }, []);

  const openDelete = useCallback((projectId: string, projectName: string) => {
    setDeleteTarget({ projectId, projectName });
    setOpenDialog("delete");
  }, []);

  const closeDialog = useCallback(() => {
    setOpenDialog(null);
    setLoading(false);
  }, []);

  const submitCreate = useCallback(async () => {
    if (!createName.trim()) return;
    setLoading(true);
    // Mock only: spec 07 will replace this with POST /api/projects.
    await new Promise((r) => setTimeout(r, 400));
    setLoading(false);
    closeDialog();
  }, [createName, closeDialog]);

  const submitRename = useCallback(async () => {
    if (!renameTarget || !renameName.trim()) return;
    setLoading(true);
    // Mock only: spec 07 will replace this with PATCH /api/projects/[id].
    await new Promise((r) => setTimeout(r, 400));
    setLoading(false);
    closeDialog();
  }, [renameTarget, renameName, closeDialog]);

  const submitDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setLoading(true);
    // Mock only: spec 07 will replace this with DELETE /api/projects/[id].
    await new Promise((r) => setTimeout(r, 400));
    setLoading(false);
    closeDialog();
  }, [deleteTarget, closeDialog]);

  return {
    openDialog,
    createName,
    createSlug,
    renameTarget,
    renameName,
    deleteTarget,
    loading,
    openCreate,
    openRename,
    openDelete,
    closeDialog,
    setCreateName,
    setRenameName,
    submitCreate,
    submitRename,
    submitDelete,
  };
}
