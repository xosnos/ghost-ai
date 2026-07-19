"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteProjectDialogProps {
  open: boolean;
  projectName: string;
  loading: boolean;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
}

export function DeleteProjectDialog({
  open,
  projectName,
  loading,
  error,
  onSubmit,
  onClose,
}: DeleteProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span style={{ color: "var(--text-secondary)" }}>{projectName}</span>? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onSubmit} disabled={loading}>
            {loading ? "Deleting..." : "Delete project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
