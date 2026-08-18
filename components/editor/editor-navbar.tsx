"use client";

import {
  AlertCircle,
  BookOpen,
  Check,
  Cloud,
  Gift,
  LayoutTemplate,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { PresenceAvatars } from "@/components/editor/presence-avatars";
import { UserMenu } from "@/components/editor/user-menu";
import { Button } from "@/components/ui/button";
import { GhostIcon, GhostLogo } from "@/components/ui/ghost-logo";
import type { SaveStatus } from "@/hooks/use-canvas-autosave";
import { cn } from "@/lib/utils";
import type { PresencePayload } from "@/types/realtime";

interface EditorNavbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  userEmail: string;
  projectName?: string;
  aiSidebarOpen?: boolean;
  onToggleAiSidebar?: () => void;
  onShare?: () => void;
  onOpenTemplates?: () => void;
  saveStatus?: SaveStatus;
  onSaveNow?: () => void;
  presenceOthers?: PresencePayload[];
}

export function EditorNavbar({
  sidebarOpen,
  onToggleSidebar,
  userEmail,
  projectName,
  aiSidebarOpen,
  onToggleAiSidebar,
  onShare,
  onOpenTemplates,
  saveStatus,
  onSaveNow,
  presenceOthers,
}: EditorNavbarProps) {
  const isWorkspace = Boolean(projectName);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between px-3 md:px-4 pointer-events-none bg-transparent transition-colors">
      {/* Left island: Brand / Workspace project title */}
      <div className="pointer-events-auto flex min-w-0 items-center">
        {isWorkspace ? (
          <div className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/80 px-2.5 py-1 shadow-sm backdrop-blur-md transition-all hover:border-[var(--border-subtle)]">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar"
              className="h-7 w-7 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>

            <Link
              href="/editor"
              className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
              title="Ghost AI Home"
            >
              <GhostLogo size="xs" variant="mark" glow />
            </Link>

            <span
              className="hidden sm:inline-block h-3.5 w-px bg-[var(--border-default)]"
              aria-hidden="true"
            />

            <span
              className="truncate text-xs font-semibold max-w-[140px] sm:max-w-[220px] md:max-w-[280px]"
              style={{ color: "var(--text-primary)" }}
            >
              {projectName}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/80 px-3 py-1.5 shadow-sm backdrop-blur-md transition-all hover:border-[var(--border-subtle)]">
            <Link
              href="/editor"
              className="flex items-center gap-2 transition-opacity hover:opacity-90"
            >
              <GhostLogo size="xs" variant="mark" glow />
              <span
                className="font-semibold tracking-tight text-xs md:text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                Ghost AI
              </span>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                BETA
              </span>
            </Link>
          </div>
        )}
      </div>

      {/* Center floating action pill (Workspace mode) */}
      {isWorkspace && (
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/80 p-1 shadow-sm backdrop-blur-md">
          {saveStatus && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 h-7 px-2.5 text-xs rounded-full transition-colors",
                saveStatus === "saving" && "text-[var(--accent-primary)]",
                saveStatus === "saved" && "text-emerald-500 hover:text-emerald-400",
                saveStatus === "error" && "text-[var(--state-error)] hover:text-red-400",
                saveStatus === "idle" &&
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
              onClick={onSaveNow}
              disabled={saveStatus === "saving"}
              title={
                saveStatus === "saving"
                  ? "Saving canvas..."
                  : saveStatus === "saved"
                    ? "All changes saved"
                    : saveStatus === "error"
                      ? "Save failed. Click to retry"
                      : "Save canvas"
              }
            >
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="hidden sm:inline">Saving…</span>
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="hidden text-emerald-500 sm:inline">Saved</span>
                </>
              ) : saveStatus === "error" ? (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-[var(--state-error)]" />
                  <span className="hidden text-[var(--state-error)] sm:inline">Save error</span>
                </>
              ) : (
                <>
                  <Cloud className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Save</span>
                </>
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 px-2.5 text-xs rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            onClick={onShare}
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          {onOpenTemplates && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-7 px-2.5 text-xs rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              onClick={onOpenTemplates}
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Templates</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all",
              aiSidebarOpen &&
                "bg-[var(--accent-ai)]/20 text-[var(--accent-ai-text)] ring-1 ring-[var(--accent-ai)]/40",
            )}
            onClick={onToggleAiSidebar}
            aria-label="Toggle AI sidebar"
            aria-pressed={aiSidebarOpen}
          >
            <GhostIcon size={14} glow={aiSidebarOpen} />
          </Button>
        </div>
      )}

      {/* Right floating utility island with consolidated User Avatar and active collaborators */}
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/80 px-2 py-1 shadow-sm backdrop-blur-md">
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="hidden md:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Docs</span>
        </a>

        {!isWorkspace && (
          <>
            {/* Discord / Community */}
            <button
              type="button"
              aria-label="Community Discord"
              className="hidden sm:flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </button>

            {/* X / Twitter */}
            <button
              type="button"
              aria-label="Twitter X"
              className="hidden sm:flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </button>

            {/* What's new / Gift with notification dot */}
            <button
              type="button"
              aria-label="What's new"
              className="relative flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              <Gift className="h-3.5 w-3.5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[var(--accent-ai)] ring-2 ring-[var(--bg-surface)]" />
            </button>
          </>
        )}

        {isWorkspace && presenceOthers && presenceOthers.length > 0 && (
          <PresenceAvatars others={presenceOthers} />
        )}

        {/* Single consolidated user avatar menu */}
        <UserMenu email={userEmail} />
      </div>
    </header>
  );
}
