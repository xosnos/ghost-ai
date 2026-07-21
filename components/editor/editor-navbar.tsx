"use client";

import { PanelLeftClose, PanelLeftOpen, Share2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/editor/user-menu";

interface EditorNavbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  userEmail: string;
  projectName?: string;
  aiSidebarOpen?: boolean;
  onToggleAiSidebar?: () => void;
  onShare?: () => void;
}

export function EditorNavbar({
  sidebarOpen,
  onToggleSidebar,
  userEmail,
  projectName,
  aiSidebarOpen,
  onToggleAiSidebar,
  onShare,
}: EditorNavbarProps) {
  const isWorkspace = Boolean(projectName);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex h-12 items-center justify-between px-3"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          {sidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </Button>
        {isWorkspace && (
          <span
            className="truncate text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {projectName}
          </span>
        )}
      </div>

      {isWorkspace && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="gap-2" onClick={onShare}>
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleAiSidebar}
            aria-label="Toggle AI sidebar"
            aria-pressed={aiSidebarOpen}
          >
            <Bot className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className="flex flex-1 items-center justify-end">
        <UserMenu email={userEmail} />
      </div>
    </header>
  );
}
