"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectDialogs } from "@/components/editor/project-dialog-context";

export function EditorHome() {
  const { openCreate } = useProjectDialogs();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 text-center">
      <div className="flex flex-col gap-4">
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Create a project or open an existing one
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Start a new architecture workspace, or choose a project from the sidebar.
        </p>
      </div>

      <Button onClick={openCreate} className="gap-2">
        <Plus className="h-4 w-4" />
        New Project
      </Button>
    </div>
  );
}
