"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { ShareProjectDialog } from "@/components/editor/share-project-dialog";
import { StarterTemplatesModal } from "@/components/editor/starter-templates-modal";
import { TemplateImportProvider } from "@/components/editor/template-import-context";
import {
  CanvasSaveProvider,
  type CanvasSaveContextValue,
} from "@/components/editor/canvas-save-context";
import {
  CanvasPresenceProvider,
  type CanvasPresenceContextValue,
} from "@/components/editor/canvas-presence-context";
import type { SaveStatus } from "@/hooks/use-canvas-autosave";
import { AiSidebar } from "@/components/editor/ai-sidebar";
import {
  ProjectDialogContext,
  type ProjectDialogContextValue,
} from "@/components/editor/project-dialog-context";
import { useProjectActions } from "@/hooks/use-project-actions";
import { useShareDialog } from "@/hooks/use-share-dialog";
import type { Project } from "@/lib/projects/types";
import type { CanvasTemplate } from "@/components/editor/starter-templates";
import type { PresencePayload } from "@/types/realtime";

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
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const dialogs = useProjectActions();
  const isWorkspace = Boolean(project);
  const isProjectOwner = Boolean(
    project && project.ownerId === currentUserId
  );
  const share = useShareDialog(project?.id, isProjectOwner);

  const templateImportRef = useRef<
    ((template: CanvasTemplate) => void) | null
  >(null);

  const [presenceOthers, setPresenceOthers] = useState<PresencePayload[]>([]);
  const presenceContextValue: CanvasPresenceContextValue = {
    others: presenceOthers,
    setOthers: setPresenceOthers,
  };

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveHandlerRef = useRef<(() => Promise<boolean>) | null>(null);

  const handleRegisterSave = (handler: (() => Promise<boolean>) | null) => {
    saveHandlerRef.current = handler;
  };

  const handleSaveNow = async () => {
    if (saveHandlerRef.current) {
      return saveHandlerRef.current();
    }
    return false;
  };

  const saveContextValue: CanvasSaveContextValue = {
    status: saveStatus,
    setStatus: setSaveStatus,
    registerSaveHandler: handleRegisterSave,
    saveNow: handleSaveNow,
  };

  const contextValue: ProjectDialogContextValue = {
    openCreate: dialogs.openCreate,
    openRename: dialogs.openRename,
    openDelete: dialogs.openDelete,
  };

  const handleTemplateSelect = async (template: CanvasTemplate) => {
    if (isWorkspace) {
      templateImportRef.current?.(template);
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: template.name }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.project?.id) {
          router.push(`/editor/${data.project.id}`);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to create project from template:", err);
    }
    dialogs.openCreate();
  };

  return (
    <ProjectDialogContext.Provider value={contextValue}>
      <TemplateImportProvider value={templateImportRef}>
        <CanvasPresenceProvider value={presenceContextValue}>
          <CanvasSaveProvider value={saveContextValue}>
            <div className="relative flex h-screen flex-col overflow-hidden bg-[var(--bg-base)]">
              <EditorNavbar
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen((v) => !v)}
                userEmail={userEmail}
                projectName={project?.name}
                aiSidebarOpen={aiSidebarOpen}
                onToggleAiSidebar={() => setAiSidebarOpen((v) => !v)}
                onShare={project ? share.openShare : undefined}
                onOpenTemplates={project ? () => setTemplatesOpen(true) : undefined}
                saveStatus={isWorkspace ? saveStatus : undefined}
                onSaveNow={isWorkspace ? handleSaveNow : undefined}
                presenceOthers={isWorkspace ? presenceOthers : undefined}
              />

          {/* Drawer Sidebar for Mobile or Workspace Overlay */}
          <ProjectSidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            currentUserId={currentUserId}
            ownedProjects={ownedProjects}
            sharedProjects={sharedProjects}
            currentRoomId={currentRoomId}
            onSelectTemplate={handleTemplateSelect}
          />

          {/* Main Area */}
          <main className="flex flex-1 overflow-hidden">
            {!isWorkspace ? (
              // Dashboard Google Stitch View: Left Panel Embedded + Center Hero Canvas
              <div className="flex flex-1 overflow-hidden p-3 md:p-4 pt-16 md:pt-16 gap-4">
                <ProjectSidebar
                  isOpen={true}
                  onClose={() => {}}
                  currentUserId={currentUserId}
                  ownedProjects={ownedProjects}
                  sharedProjects={sharedProjects}
                  currentRoomId={currentRoomId}
                  isEmbedded={true}
                  onSelectTemplate={handleTemplateSelect}
                />
                <div className="flex flex-1 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]/50 backdrop-blur-sm">
                  {children}
                </div>
              </div>
            ) : (
              // Full-viewport Canvas Workspace View (seamless behind floating navbar)
              <div className="flex flex-1 overflow-hidden">
                {children}
              </div>
            )}
          </main>

          {project && (
            <AiSidebar
              isOpen={aiSidebarOpen}
              onClose={() => setAiSidebarOpen(false)}
            />
          )}
        </div>

        <ProjectDialogs dialogs={dialogs} />

        {project && (
          <ShareProjectDialog
            open={share.open}
            projectName={project.name}
            isOwner={share.isOwner}
            collaborators={share.collaborators}
            inviteEmail={share.inviteEmail}
            loading={share.loading}
            inviting={share.inviting}
            removingEmail={share.removingEmail}
            error={share.error}
            copied={share.copied}
            projectLink={share.projectLink}
            onInviteEmailChange={share.setInviteEmail}
            onInvite={share.submitInvite}
            onRemove={share.removeCollaborator}
            onCopyLink={share.copyLink}
            onClose={share.closeShare}
          />
        )}

          {project && (
            <StarterTemplatesModal
              open={templatesOpen}
              onImport={(template) => {
                templateImportRef.current?.(template);
                setTemplatesOpen(false);
              }}
              onClose={() => setTemplatesOpen(false)}
            />
          )}
          </CanvasSaveProvider>
        </CanvasPresenceProvider>
      </TemplateImportProvider>
    </ProjectDialogContext.Provider>
  );
}

