"use client";

import { CreateProjectDialog } from "@/components/editor/create-project-dialog";
import { RenameProjectDialog } from "@/components/editor/rename-project-dialog";
import { DeleteProjectDialog } from "@/components/editor/delete-project-dialog";
import type { UseProjectActionsResult } from "@/hooks/use-project-actions";

interface ProjectDialogsProps {
  dialogs: UseProjectActionsResult;
}

export function ProjectDialogs({ dialogs }: ProjectDialogsProps) {
  return (
    <>
      <CreateProjectDialog
        open={dialogs.openDialog === "create"}
        name={dialogs.createName}
        slug={dialogs.createSlug}
        loading={dialogs.loading}
        error={dialogs.error}
        onNameChange={dialogs.setCreateName}
        onSubmit={dialogs.submitCreate}
        onClose={dialogs.closeDialog}
      />

      <RenameProjectDialog
        open={dialogs.openDialog === "rename"}
        currentName={dialogs.renameTarget?.currentName ?? ""}
        name={dialogs.renameName}
        slug={dialogs.renameSlug}
        loading={dialogs.loading}
        error={dialogs.error}
        onNameChange={dialogs.setRenameName}
        onSubmit={dialogs.submitRename}
        onClose={dialogs.closeDialog}
      />

      <DeleteProjectDialog
        open={dialogs.openDialog === "delete"}
        projectName={dialogs.deleteTarget?.projectName ?? ""}
        loading={dialogs.loading}
        error={dialogs.error}
        onSubmit={dialogs.submitDelete}
        onClose={dialogs.closeDialog}
      />
    </>
  );
}
