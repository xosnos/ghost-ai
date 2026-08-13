"use client";

import { useEffect } from "react";
interface UseKeyboardShortcutsOptions {
  zoomIn: () => void;
  zoomOut: () => void;
  undo: () => void;
  redo: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

export function useKeyboardShortcuts({
  zoomIn,
  zoomOut,
  undo,
  redo,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const cmd = event.metaKey || event.ctrlKey;

      if (cmd && event.shiftKey && (event.key === "z" || event.key === "Z")) {
        event.preventDefault();
        redo();
        return;
      }

      if (cmd && (event.key === "y" || event.key === "Y")) {
        event.preventDefault();
        redo();
        return;
      }

      if (cmd && (event.key === "z" || event.key === "Z")) {
        event.preventDefault();
        undo();
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomIn();
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        zoomOut();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, undo, redo]);
}
