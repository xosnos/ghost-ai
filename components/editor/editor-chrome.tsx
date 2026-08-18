"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { ShareProjectDialog } from "@/components/editor/share-project-dialog";
import { StarterTemplatesModal } from "@/components/editor/starter-templates-modal";
import {
  TemplateImportProvider,
  TemplateSelectionProvider,
} from "@/components/editor/template-import-context";
import {
  CanvasSaveProvider,
  type CanvasSaveContextValue,
} from "@/components/editor/canvas-save-context";
import {
  CanvasPresenceProvider,
  type CanvasPresenceContextValue,
} from "@/components/editor/canvas-presence-context";
import {
  AiStatusProvider,
  type AiStatusContextValue,
  type ActiveTaskRun,
} from "@/components/editor/ai-status-context";
import {
  AiChatProvider,
  type AiChatContextValue,
} from "@/components/editor/ai-chat-context";
import type { AiStatusMessage, AiChatMessage } from "@/types/tasks";
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
  const openCreate = dialogs.openCreate;
  const isWorkspace = Boolean(project);
  const isProjectOwner = Boolean(
    project && project.ownerId === currentUserId
  );
  const share = useShareDialog(project?.id, isProjectOwner);

  const templateImportRef = useRef<
    ((template: CanvasTemplate) => void) | null
  >(null);

  const [presenceOthers, setPresenceOthers] = useState<PresencePayload[]>([]);
  const presenceContextValue = useMemo<CanvasPresenceContextValue>(() => ({
    others: presenceOthers,
    setOthers: setPresenceOthers,
  }), [presenceOthers]);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveHandlerRef = useRef<(() => Promise<boolean>) | null>(null);

  const handleRegisterSave = useCallback((handler: (() => Promise<boolean>) | null) => {
    saveHandlerRef.current = handler;
  }, []);

  const handleSaveNow = useCallback(async () => {
    if (saveHandlerRef.current) {
      return saveHandlerRef.current();
    }
    return false;
  }, []);

  const saveContextValue = useMemo<CanvasSaveContextValue>(() => ({
    status: saveStatus,
    setStatus: setSaveStatus,
    registerSaveHandler: handleRegisterSave,
    saveNow: handleSaveNow,
  }), [saveStatus, handleRegisterSave, handleSaveNow]);

  const [isAiActive, setIsAiActive] = useState(false);
  const [latestAiStatus, setLatestAiStatus] = useState<AiStatusMessage | null>(null);
  const [activeTaskRun, setActiveTaskRun] = useState<ActiveTaskRun | null>(null);
  const trackRunRef = useRef<((runId: string) => Promise<void>) | null>(null);

  const handleRegisterTrackRun = useCallback(
    (handler: ((runId: string) => Promise<void>) | null) => {
      trackRunRef.current = handler;
    },
    []
  );

  const handleTrackRun = useCallback(async (runId: string) => {
    if (trackRunRef.current) {
      await trackRunRef.current(runId);
    }
  }, []);

  const aiStatusContextValue = useMemo<AiStatusContextValue>(() => ({
    isAiActive,
    latestStatus: latestAiStatus,
    activeTaskRun,
    currentRunId: activeTaskRun?.id ?? null,
    trackRun: handleTrackRun,
    registerTrackRun: handleRegisterTrackRun,
    setIsAiActive,
    setLatestStatus: setLatestAiStatus,
    setActiveTaskRun,
  }), [isAiActive, latestAiStatus, activeTaskRun, handleTrackRun, handleRegisterTrackRun]);

  const [chatMessages, setChatMessages] = useState<AiChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const sendChatRef = useRef<((content: string) => Promise<boolean>) | null>(null);
  const addChatRef = useRef<((message: AiChatMessage) => void) | null>(null);

  const handleRegisterChatSend = useCallback(
    (handler: ((content: string) => Promise<boolean>) | null) => {
      sendChatRef.current = handler;
    },
    [],
  );

  const handleSendChatMessage = useCallback(async (content: string) => {
    if (sendChatRef.current) {
      return sendChatRef.current(content);
    }
    return false;
  }, []);

  const handleRegisterAddMessage = useCallback(
    (handler: ((message: AiChatMessage) => void) | null) => {
      addChatRef.current = handler;
    },
    []
  );

  const handleAddChatMessage = useCallback((message: AiChatMessage) => {
    if (addChatRef.current) {
      addChatRef.current(message);
      return;
    }
    setChatMessages((prev) => [...prev, message]);
  }, []);

  const handleClearChatError = useCallback(() => {
    setChatError(null);
  }, []);

  const aiChatContextValue = useMemo<AiChatContextValue>(() => ({
    messages: chatMessages,
    sendMessage: handleSendChatMessage,
    sendError: chatError,
    clearSendError: handleClearChatError,
    setSendError: setChatError,
    registerSendHandler: handleRegisterChatSend,
    setMessages: setChatMessages,
    addMessage: handleAddChatMessage,
    registerAddMessage: handleRegisterAddMessage,
    currentUserId,
  }), [
    chatMessages,
    handleSendChatMessage,
    chatError,
    handleClearChatError,
    handleRegisterChatSend,
    handleAddChatMessage,
    handleRegisterAddMessage,
    currentUserId,
  ]);

  const contextValue = useMemo<ProjectDialogContextValue>(() => ({
    openCreate: dialogs.openCreate,
    openRename: dialogs.openRename,
    openDelete: dialogs.openDelete,
  }), [dialogs.openCreate, dialogs.openRename, dialogs.openDelete]);

  const handleTemplateSelect = useCallback(async (template: CanvasTemplate) => {
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
      openCreate("Could not create the template project. Please try again.");
      return;
    }
    openCreate("Could not create the template project. Please try again.");
  }, [isWorkspace, openCreate, router]);

  return (
    <ProjectDialogContext.Provider value={contextValue}>
      <TemplateImportProvider value={templateImportRef}>
        <TemplateSelectionProvider onOpen={() => setTemplatesOpen(true)}>
          <CanvasPresenceProvider value={presenceContextValue}>
            <CanvasSaveProvider value={saveContextValue}>
              <AiStatusProvider value={aiStatusContextValue}>
                <AiChatProvider value={aiChatContextValue}>
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
              projectId={project.id}
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

            <StarterTemplatesModal
              open={templatesOpen}
              onImport={(template) => {
                void handleTemplateSelect(template);
                setTemplatesOpen(false);
              }}
              onClose={() => setTemplatesOpen(false)}
            />
                </AiChatProvider>
              </AiStatusProvider>
            </CanvasSaveProvider>
          </CanvasPresenceProvider>
        </TemplateSelectionProvider>
      </TemplateImportProvider>
    </ProjectDialogContext.Provider>
  );
}

