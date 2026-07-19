"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CreateProjectDialogProps {
  open: boolean;
  name: string;
  slug: string;
  loading: boolean;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function CreateProjectDialog({
  open,
  name,
  slug,
  loading,
  onNameChange,
  onSubmit,
  onClose,
}: CreateProjectDialogProps) {
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const el = document.getElementById("create-project-name");
      el?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Give your architecture workspace a name. A slug is generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-6">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="create-project-name"
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Project name
            </label>
            <Input
              id="create-project-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Payments Service"
              autoComplete="off"
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Slug preview
            </span>
            <div
              className="flex h-9 items-center rounded-xl px-3 font-mono text-sm"
              style={{
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                color: slug ? "var(--text-secondary)" : "var(--text-faint)",
              }}
            >
              {slug || "payments-service"}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={loading || !name.trim()}>
            {loading ? "Creating..." : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
