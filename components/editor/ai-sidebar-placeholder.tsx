"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AiSidebarPlaceholderProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiSidebarPlaceholder({ isOpen, onClose }: AiSidebarPlaceholderProps) {
  return (
    <aside
      className="fixed top-12 right-0 z-30 flex h-[calc(100vh-3rem)] w-80 flex-col transition-transform duration-200"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-default)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          AI Workspace
        </span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close AI sidebar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-center text-sm" style={{ color: "var(--text-faint)" }}>
          AI chat coming soon
        </p>
      </div>
    </aside>
  );
}
