"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { slugify, projectSlug } from "@/lib/utils";
import type { DialogKind } from "@/components/editor/project-dialog-context";

function unwrapErrorMessage(err: unknown, fallback: string): string {
  let current: unknown = err;
  let message = fallback;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    if (current.message && current.message !== "fetch failed") {
      message = current.message;
      break;
    }
    current = (current as Error & { cause?: unknown }).cause;
  }
  if (current instanceof Error && current.message && current.message !== "fetch failed") {
    message = current.message;
  }
  if (err instanceof Error) {
    console.error("[useProjectActions]", err.message, err.cause, err.stack);
  }
  return message;
}

export interface RenameTarget {
  projectId: string;
  currentName: string;
}

export interface DeleteTarget {
  projectId: string;
  projectName: string;
}

export interface UseProjectActionsResult {
  openDialog: DialogKind;
  createName: string;
  createSlug: string;
  renameTarget: RenameTarget | null;
  renameName: string;
  renameSlug: string;
  deleteTarget: DeleteTarget | null;
  loading: boolean;
  error: string | null;
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

async function parseJsonError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  if (body && typeof body.error === "string") return body.error;
  return `Request failed (${res.status})`;
}

export function useProjectActions(): UseProjectActionsResult {
  const router = useRouter();
  const pathname = usePathname();
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [createName, setCreateName] = useState("");
  const [createSuffix, setCreateSuffix] = useState("");
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSlug = useMemo(() => {
    const base = slugify(createName);
    if (!base && !createSuffix) return "untitled";
    if (!base) return createSuffix;
    if (!createSuffix) return base;
    return `${base}-${createSuffix}`;
  }, [createName, createSuffix]);

  const renameSlug = useMemo(() => {
    if (!renameTarget) return "";
    return projectSlug(renameName, renameTarget.projectId);
  }, [renameName, renameTarget]);

  const openCreate = useCallback(() => {
    setCreateName("");
    setCreateSuffix(Math.random().toString(36).slice(2, 8));
    setError(null);
    setOpenDialog("create");
  }, []);

  const openRename = useCallback((projectId: string, currentName: string) => {
    setRenameTarget({ projectId, currentName });
    setRenameName(currentName);
    setError(null);
    setOpenDialog("rename");
  }, []);

  const openDelete = useCallback((projectId: string, projectName: string) => {
    setDeleteTarget({ projectId, projectName });
    setError(null);
    setOpenDialog("delete");
  }, []);

  const closeDialog = useCallback(() => {
    setOpenDialog(null);
    setLoading(false);
    setError(null);
  }, []);

  const submitCreate = useCallback(async () => {
    if (!createName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim() }),
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      const data = await res.json();
      if (!data.project?.id) throw new Error("Invalid response from server");
      const projectId: string = data.project.id;
      closeDialog();
      router.push(`/editor/${projectId}`);
    } catch (err) {
      setError(unwrapErrorMessage(err, "Failed to create project"));
      setLoading(false);
    }
  }, [createName, closeDialog, router]);

  const submitRename = useCallback(async () => {
    if (!renameTarget || !renameName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${renameTarget.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      closeDialog();
      router.refresh();
    } catch (err) {
      setError(unwrapErrorMessage(err, "Failed to rename project"));
      setLoading(false);
    }
  }, [renameTarget, renameName, closeDialog, router]);

  const submitDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setLoading(true);
    setError(null);
    const isActive = pathname === `/editor/${deleteTarget.projectId}`;
    try {
      const res = await fetch(`/api/projects/${deleteTarget.projectId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      closeDialog();
      if (isActive) {
        router.push("/editor");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(unwrapErrorMessage(err, "Failed to delete project"));
      setLoading(false);
    }
  }, [deleteTarget, closeDialog, router, pathname]);

  return {
    openDialog,
    createName,
    createSlug,
    renameTarget,
    renameName,
    renameSlug,
    deleteTarget,
    loading,
    error,
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
