"use client";

import { memo, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { NODE_COLORS, resolveNodeColor, type CanvasNodeData, type NodeColor } from "@/types/canvas";
import { useTheme } from "@/lib/theme-provider";

interface NodeColorToolbarProps {
  id: string;
  data: CanvasNodeData;
  selected: boolean;
  width?: number;
  height?: number;
}

function isSameColor(a: NodeColor, b: NodeColor): boolean {
  return (
    a.fill.toLowerCase() === b.fill.toLowerCase() ||
    a.name === b.name ||
    a.text.toLowerCase() === b.text.toLowerCase()
  );
}

function NodeColorToolbarInner({ id, data, selected, width, height }: NodeColorToolbarProps) {
  const { updateNodeData } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const activeColor = data.color ?? NODE_COLORS[0];
  const w = width ?? 176;
  const h = height ?? 64;

  const selectColor = useCallback(
    (color: NodeColor) => {
      updateNodeData(id, { color });
    },
    [id, updateNodeData],
  );

  if (!selected) return null;

  const toolbarWidth = NODE_COLORS.length * 28 + (NODE_COLORS.length - 1) * 4;
  const left = (w - toolbarWidth) / 2;
  const top = -h / 2 - 40;

  return (
    <div
      className="nodrag nopan nowheel absolute z-30 flex items-center gap-1 rounded-xl border p-1.5 shadow-xl backdrop-blur-md transition-colors"
      style={{
        left,
        top,
        backgroundColor: "var(--bg-elevated)",
        borderColor: "var(--border-default)",
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
    >
      {NODE_COLORS.map((color, i) => {
        const isActive = isSameColor(color, activeColor);
        const resolved = resolveNodeColor(color, resolvedTheme);

        return (
          <button
            key={i}
            type="button"
            onClick={() => selectColor(color)}
            className="relative flex h-6 w-6 items-center justify-center rounded-lg transition-all duration-150"
            style={{
              backgroundColor: resolved.fill,
              border: isActive
                ? `2px solid ${resolved.text}`
                : `1px solid ${resolvedTheme === "light" ? resolved.border : "var(--border-default)"}`,
              boxShadow: isActive ? `0 0 0 2px ${resolved.text}33` : "none",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.boxShadow = `0 0 6px 1px ${resolved.text}55`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.boxShadow = "none";
              }
            }}
            aria-label={`Set node color ${color.name ?? i + 1}`}
          >
            <span
              className="text-[10px] font-bold leading-none"
              style={{ color: resolved.text }}
            >
              A
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const NodeColorToolbar = memo(NodeColorToolbarInner);
