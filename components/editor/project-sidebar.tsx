"use client";

import { X, Plus, Pencil, Trash2, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectDialogs } from "@/components/editor/project-dialog-context";
import { projectSlug } from "@/lib/utils";
import type { Project } from "@/lib/projects/types";

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  ownedProjects: Project[];
  sharedProjects: Project[];
}

export function ProjectSidebar({
  isOpen,
  onClose,
  currentUserId,
  ownedProjects,
  sharedProjects,
}: ProjectSidebarProps) {
  const dialogs = useProjectDialogs();

  return (
    <>
      {/* Mobile backdrop scrim: visible only on small screens when the sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 top-12 z-20 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className="fixed top-12 left-0 z-30 flex h-[calc(100vh-3rem)] w-72 flex-col transition-transform duration-200"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderRight: "1px solid var(--border-default)",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Projects
          </span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex flex-1 flex-col overflow-hidden px-3 pt-3">
          <Tabs defaultValue="my-projects" className="flex flex-1 flex-col">
            <TabsList className="w-full">
              <TabsTrigger value="my-projects" className="flex-1">
                My Projects
              </TabsTrigger>
              <TabsTrigger value="shared" className="flex-1">
                Shared
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my-projects" className="flex flex-1 flex-col">
              <ProjectList
                projects={ownedProjects}
                currentUserId={currentUserId}
                emptyMessage="No projects yet."
                onRename={dialogs.openRename}
                onDelete={dialogs.openDelete}
              />
            </TabsContent>

            <TabsContent value="shared" className="flex flex-1 flex-col">
              <ProjectList
                projects={sharedProjects}
                currentUserId={currentUserId}
                emptyMessage="No shared projects."
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="p-3" style={{ borderTop: "1px solid var(--border-default)" }}>
          <Button variant="secondary" className="w-full gap-2" onClick={dialogs.openCreate}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </aside>
    </>
  );
}

interface ProjectListProps {
  projects: Project[];
  currentUserId: string;
  emptyMessage: string;
  onRename?: (projectId: string, currentName: string) => void;
  onDelete?: (projectId: string, projectName: string) => void;
}

function ProjectList({ projects, currentUserId, emptyMessage, onRename, onDelete }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-8">
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <ul className="flex flex-col gap-1 py-2">
        {projects.map((project) => (
          <ProjectListItem
            key={project.id}
            project={project}
            currentUserId={currentUserId}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </ScrollArea>
  );
}

interface ProjectListItemProps {
  project: Project;
  currentUserId: string;
  onRename?: (projectId: string, currentName: string) => void;
  onDelete?: (projectId: string, projectName: string) => void;
}

function ProjectListItem({ project, currentUserId, onRename, onDelete }: ProjectListItemProps) {
  const isOwner = project.ownerId === currentUserId;
  const canManage = isOwner && Boolean(onRename && onDelete);

  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--bg-elevated)]"
      >
        <Folder
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--text-muted)" }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className="truncate text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            {project.name}
          </span>
          <span
            className="truncate font-mono text-xs"
            style={{ color: "var(--text-faint)" }}
          >
            {projectSlug(project.name, project.id)}
          </span>
        </div>

        {canManage && (
          <div className="flex items-center gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onRename?.(project.id, project.name)}
              aria-label={`Rename ${project.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-[var(--state-error)]/10 hover:text-[var(--state-error)]"
              onClick={() => onDelete?.(project.id, project.name)}
              aria-label={`Delete ${project.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
