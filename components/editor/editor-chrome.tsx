"use client";

import { useState } from "react";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import {
  ProjectDialogContext,
  type ProjectDialogContextValue,
} from "@/components/editor/project-dialog-context";
import { useProjectActions } from "@/hooks/use-project-actions";
import type { Project } from "@/lib/projects/types";

interface EditorChromeProps {
  children: React.ReactNode;
  userEmail: string;
  currentUserId: string;
  ownedProjects: Project[];
  sharedProjects: Project[];
}

export function EditorChrome({
  children,
  userEmail,
  currentUserId,
  ownedProjects,
  sharedProjects,
}: EditorChromeProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dialogs = useProjectActions();

  const contextValue: ProjectDialogContextValue = {
    openCreate: dialogs.openCreate,
    openRename: dialogs.openRename,
    openDelete: dialogs.openDelete,
  };

  return (
    <ProjectDialogContext.Provider value={contextValue}>
      <div className="relative flex h-screen flex-col overflow-hidden">
        <EditorNavbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          userEmail={userEmail}
        />
        <ProjectSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentUserId={currentUserId}
          ownedProjects={ownedProjects}
          sharedProjects={sharedProjects}
        />
        <main className="flex flex-1 overflow-hidden pt-12">{children}</main>
      </div>

      <ProjectDialogs dialogs={dialogs} />
    </ProjectDialogContext.Provider>
  );
}
