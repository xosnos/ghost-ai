"use client";

import { useState } from "react";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import {
  ProjectDialogContext,
  type ProjectDialogContextValue,
} from "@/components/editor/project-dialog-context";
import { useProjectDialogs } from "@/hooks/use-project-dialogs";

interface EditorChromeProps {
  children: React.ReactNode;
  userEmail: string;
}

export function EditorChrome({ children, userEmail }: EditorChromeProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dialogs = useProjectDialogs();

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
        />
        <main className="flex flex-1 overflow-hidden pt-12">{children}</main>
      </div>

      <ProjectDialogs dialogs={dialogs} />
    </ProjectDialogContext.Provider>
  );
}
