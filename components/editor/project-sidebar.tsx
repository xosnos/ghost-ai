"use client";

import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  return (
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

          <TabsContent value="my-projects" className="flex flex-1 items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              No projects yet.
            </p>
          </TabsContent>

          <TabsContent value="shared" className="flex flex-1 items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              No shared projects.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="p-3" style={{ borderTop: "1px solid var(--border-default)" }}>
        <Button variant="secondary" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>
    </aside>
  );
}
