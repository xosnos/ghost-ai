"use client";

import { useState } from "react";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { AiSidebarPlaceholder } from "@/components/editor/ai-sidebar-placeholder";
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
  project?: Project;
  currentRoomId?: string;
}

export function EditorChrome({
  children,
  userEmail,
  currentUserId,
  ownedProjects,
  sharedProjects,
  project,
  currentRoomId,
}: EditorChromeProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
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
          projectName={project?.name}
          aiSidebarOpen={aiSidebarOpen}
          onToggleAiSidebar={() => setAiSidebarOpen((v) => !v)}
          onShare={() => {}}
        />
        <ProjectSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentUserId={currentUserId}
          ownedProjects={ownedProjects}
          sharedProjects={sharedProjects}
          currentRoomId={currentRoomId}
        />
        <main className="flex flex-1 overflow-hidden pt-12">{children}</main>
        {project && (
          <AiSidebarPlaceholder
            isOpen={aiSidebarOpen}
            onClose={() => setAiSidebarOpen(false)}
          />
        )}
      </div>

      <ProjectDialogs dialogs={dialogs} />
    </ProjectDialogContext.Provider>
  );
}
