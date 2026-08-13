"use client";

import { Panel } from "@xyflow/react";
import { ZoomIn, ZoomOut, Maximize, Undo2, Redo2 } from "lucide-react";

interface CanvasControlBarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function ControlButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-30 disabled:hover:bg-transparent"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </button>
  );
}

export function CanvasControlBar({
  onZoomIn,
  onZoomOut,
  onFitView,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: CanvasControlBarProps) {
  return (
    <Panel
      position="bottom-left"
      className="m-0 flex items-center gap-1 rounded-full px-2 py-1.5"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
      }}
    >
      <ControlButton onClick={onZoomOut} disabled={false} label="Zoom out">
        <ZoomOut className="h-4 w-4" />
      </ControlButton>
      <ControlButton onClick={onFitView} disabled={false} label="Fit view">
        <Maximize className="h-4 w-4" />
      </ControlButton>
      <ControlButton onClick={onZoomIn} disabled={false} label="Zoom in">
        <ZoomIn className="h-4 w-4" />
      </ControlButton>

      <div
        className="mx-0.5 h-5 w-px"
        style={{ backgroundColor: "var(--border-default)" }}
      />

      <ControlButton onClick={onUndo} disabled={!canUndo} label="Undo">
        <Undo2 className="h-4 w-4" />
      </ControlButton>
      <ControlButton onClick={onRedo} disabled={!canRedo} label="Redo">
        <Redo2 className="h-4 w-4" />
      </ControlButton>
    </Panel>
  );
}
