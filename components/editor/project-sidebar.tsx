"use client";

import {
  ArrowUpRight,
  Boxes,
  Calendar,
  Cpu,
  Database,
  Layers,
  LayoutGrid,
  Network,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useProjectDialogs } from "@/components/editor/project-dialog-context";
import { CANVAS_TEMPLATES, type CanvasTemplate } from "@/components/editor/starter-templates";
import { Button } from "@/components/ui/button";
import { GhostIcon } from "@/components/ui/ghost-logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Project } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  ownedProjects: Project[];
  sharedProjects: Project[];
  currentRoomId?: string;
  isEmbedded?: boolean;
  onSelectTemplate?: (template: CanvasTemplate) => void;
}

const THUMBNAIL_STYLES = [
  { bg: "bg-cyan-500/15 border-cyan-500/30 text-cyan-600 dark:text-cyan-400", icon: Network },
  { bg: "bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400", icon: Cpu },
  {
    bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    icon: Layers,
  },
  { bg: "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400", icon: Boxes },
  { bg: "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400", icon: Database },
];

function formatDate(dateStr?: string) {
  if (!dateStr) return "Date unavailable";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "Recently";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "Recently";
  }
}

export function ProjectSidebar({
  isOpen,
  onClose,
  currentUserId,
  ownedProjects,
  sharedProjects,
  currentRoomId,
  isEmbedded = false,
  onSelectTemplate,
}: ProjectSidebarProps) {
  const dialogs = useProjectDialogs();
  const [activeTab, setActiveTab] = useState<"owned" | "shared">("owned");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOwned = useMemo(() => {
    if (!searchQuery.trim()) return ownedProjects;
    const q = searchQuery.toLowerCase();
    return ownedProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [ownedProjects, searchQuery]);

  const filteredShared = useMemo(() => {
    if (!searchQuery.trim()) return sharedProjects;
    const q = searchQuery.toLowerCase();
    return sharedProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [sharedProjects, searchQuery]);

  const sidebarContent = (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Top Segmented Controls - Google Stitch Sliding Pill Style */}
      <div className="p-3 pb-2">
        <div className="relative grid grid-cols-2 items-center rounded-xl bg-[var(--bg-subtle)] p-1 border border-[var(--border-default)]">
          {/* Animated Slider Pill */}
          <div
            className="absolute left-1 top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-[var(--bg-surface)] shadow-sm border border-[var(--border-subtle)] transition-transform duration-200 ease-out pointer-events-none"
            style={{
              transform: activeTab === "owned" ? "translateX(0)" : "translateX(100%)",
            }}
          />

          <button
            type="button"
            onClick={() => setActiveTab("owned")}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 whitespace-nowrap",
              activeTab === "owned"
                ? "text-[var(--text-primary)] font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
            <span>My Projects</span>
            {ownedProjects.length > 0 && (
              <span className="ml-1 rounded-full bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[var(--text-faint)]">
                {ownedProjects.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("shared")}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 whitespace-nowrap",
              activeTab === "shared"
                ? "text-[var(--text-primary)] font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>Shared</span>
            {sharedProjects.length > 0 && (
              <span className="ml-1 rounded-full bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[var(--text-faint)]">
                {sharedProjects.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar - Google Stitch Style */}
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search projects"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ color: "var(--text-primary)" }}
            className="w-full rounded-xl bg-[var(--bg-base)]/80 py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-faint)] border border-[var(--border-default)] transition-colors focus:border-[var(--accent-primary)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/30"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear project search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main List Area */}
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-5 py-2">
          {/* Recent / User Projects Section */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                {activeTab === "owned" ? "Recent" : "Shared"}
              </span>
              <button
                type="button"
                onClick={() => dialogs.openCreate()}
                className="flex items-center gap-1 text-[11px] text-[var(--accent-primary)] hover:underline"
              >
                <Plus className="h-3 w-3" />
                New
              </button>
            </div>

            {activeTab === "owned" ? (
              <ProjectList
                projects={filteredOwned}
                currentUserId={currentUserId}
                currentRoomId={currentRoomId}
                emptyMessage={searchQuery ? "No matching projects." : "No projects created yet."}
                onRename={dialogs.openRename}
                onDelete={dialogs.openDelete}
              />
            ) : (
              <ProjectList
                projects={filteredShared}
                currentUserId={currentUserId}
                currentRoomId={currentRoomId}
                emptyMessage={searchQuery ? "No matching shared projects." : "No shared projects."}
              />
            )}
          </div>

          {/* Examples Section - Google Stitch Style */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-[var(--border-default)]">
            <div className="flex items-center justify-between px-1 pt-2">
              <span className="text-[11px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                Examples
              </span>
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
                <Sparkles className="h-3 w-3 text-[var(--accent-ai-text)]" />
                Curated
              </span>
            </div>

            <ul className="flex flex-col gap-1">
              {CANVAS_TEMPLATES.map((tmpl, idx) => {
                const style = THUMBNAIL_STYLES[idx % THUMBNAIL_STYLES.length];
                const Icon = style.icon;

                return (
                  <li key={tmpl.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectTemplate) {
                          onSelectTemplate(tmpl);
                        } else {
                          dialogs.openCreate();
                        }
                      }}
                      className="group flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-all hover:bg-[var(--bg-elevated)] border border-transparent hover:border-[var(--border-default)]"
                    >
                      {/* Mini visual thumbnail */}
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                          style.bg,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                          {tmpl.name}
                        </span>
                      </div>

                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)] opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-[var(--text-secondary)]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </ScrollArea>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
        <Button
          variant="secondary"
          className="w-full gap-2 text-xs font-semibold h-9 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-elevated)]"
          onClick={() => dialogs.openCreate()}
        >
          <Plus className="h-4 w-4 text-[var(--accent-primary)]" />
          Create New Project
        </Button>
      </div>
    </div>
  );

  // If embedded in desktop dashboard layout:
  if (isEmbedded) {
    return (
      <aside className="hidden md:flex h-[calc(100vh-4.5rem)] w-80 shrink-0 flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl overflow-hidden backdrop-blur-md transition-colors">
        {sidebarContent}
      </aside>
    );
  }

  // Otherwise, drawer mode (for mobile or inside active workspace /editor/[roomId]):
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className="fixed top-0 bottom-0 left-0 z-50 flex h-screen w-80 flex-col transition-transform duration-200 shadow-2xl backdrop-blur-md bg-[var(--bg-surface)] border-r border-[var(--border-default)]"
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <GhostIcon size={16} glow />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Projects & Examples
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close sidebar"
            className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {sidebarContent}
      </aside>
    </>
  );
}

interface ProjectListProps {
  projects: Project[];
  currentUserId: string;
  currentRoomId?: string;
  emptyMessage: string;
  onRename?: (projectId: string, currentName: string) => void;
  onDelete?: (projectId: string, projectName: string) => void;
}

function ProjectList({
  projects,
  currentUserId,
  currentRoomId,
  emptyMessage,
  onRename,
  onDelete,
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-3 text-center">
        <p className="text-xs text-[var(--text-faint)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1 animate-in fade-in duration-200">
      {projects.map((project) => (
        <ProjectListItem
          key={project.id}
          project={project}
          currentUserId={currentUserId}
          isActive={project.id === currentRoomId}
          colorIndex={stableColorIndex(project.id)}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function stableColorIndex(projectId: string): number {
  let hash = 0;
  for (const character of projectId) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

interface ProjectListItemProps {
  project: Project;
  currentUserId: string;
  isActive?: boolean;
  colorIndex?: number;
  onRename?: (projectId: string, currentName: string) => void;
  onDelete?: (projectId: string, projectName: string) => void;
}

function ProjectListItem({
  project,
  currentUserId,
  isActive,
  colorIndex = 0,
  onRename,
  onDelete,
}: ProjectListItemProps) {
  const isOwner = project.ownerId === currentUserId;
  const canManage = isOwner && Boolean(onRename && onDelete);
  const style = THUMBNAIL_STYLES[colorIndex % THUMBNAIL_STYLES.length];
  const Icon = style.icon;

  return (
    <li>
      <div
        className={cn(
          "group relative flex items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-[var(--bg-elevated)] border border-transparent hover:border-[var(--border-default)]",
          isActive && "bg-[var(--accent-primary-dim)] border-[var(--accent-primary)]/30",
        )}
      >
        <Link href={`/editor/${project.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          {/* Mini diagram thumbnail */}
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
              style.bg,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <span
              className={cn(
                "truncate text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors",
                isActive && "text-[var(--accent-primary)]",
              )}
            >
              {project.name}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              <Calendar className="h-3 w-3 text-[var(--text-faint)]" />
              <span>{formatDate(project.updatedAt || project.createdAt)}</span>
              {!isOwner && (
                <span className="rounded bg-[var(--accent-ai)]/20 px-1 py-0.2 text-[9px] text-[var(--accent-ai-text)]">
                  Shared
                </span>
              )}
            </div>
          </div>
        </Link>

        {canManage && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={() => onRename?.(project.id, project.name)}
              aria-label={`Rename ${project.name}`}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-[var(--text-muted)] hover:text-[var(--state-error)] hover:bg-[var(--state-error)]/10"
              onClick={() => onDelete?.(project.id, project.name)}
              aria-label={`Delete ${project.name}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
