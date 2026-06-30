"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorNavbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function EditorNavbar({ sidebarOpen, onToggleSidebar }: EditorNavbarProps) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex h-12 items-center justify-between px-3"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      <div className="flex items-center">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          {sidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div className="flex items-center" />

      <div className="flex items-center" />
    </header>
  );
}
