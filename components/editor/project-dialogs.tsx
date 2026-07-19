"use client";

import { CreateProjectDialog } from "@/components/editor/create-project-dialog";
import { RenameProjectDialog } from "@/components/editor/rename-project-dialog";
import { DeleteProjectDialog } from "@/components/editor/delete-project-dialog";
import type { UseProjectDialogsResult } from "@/hooks/use-project-dialogs";

interface ProjectDialogsProps {
  dialogs: UseProjectDialogsResult;
}

export function ProjectDialogs({ dialogs }: ProjectDialogsProps) {
  return (
    <>
      <CreateProjectDialog
        open={dialogs.openDialog === "create"}
        name={dialogs.createName}
        slug={dialogs.createSlug}
        loading={dialogs.loading}
        onNameChange={dialogs.setCreateName}
        onSubmit={dialogs.submitCreate}
        onClose={dialogs.closeDialog}
      />

      <RenameProjectDialog
        open={dialogs.openDialog === "rename"}
        currentName={dialogs.renameTarget?.currentName ?? ""}
        name={dialogs.renameName}
        loading={dialogs.loading}
        onNameChange={dialogs.setRenameName}
        onSubmit={dialogs.submitRename}
        onClose={dialogs.closeDialog}
      />

      <DeleteProjectDialog
        open={dialogs.openDialog === "delete"}
        projectName={dialogs.deleteTarget?.projectName ?? ""}
        loading={dialogs.loading}
        onSubmit={dialogs.submitDelete}
        onClose={dialogs.closeDialog}
      />
    </>
  );
}
