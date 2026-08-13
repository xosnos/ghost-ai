"use client";

import { memo, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { NODE_COLORS, type CanvasNodeData, type NodeColor } from "@/types/canvas";

interface NodeColorToolbarProps {
  id: string;
  data: CanvasNodeData;
  selected: boolean;
  width?: number;
  height?: number;
}

function isSameColor(a: NodeColor, b: NodeColor): boolean {
  return a.fill === b.fill && a.text === b.text;
}

function NodeColorToolbarInner({ id, data, selected, width, height }: NodeColorToolbarProps) {
  const { updateNodeData } = useReactFlow();
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
      className="nodrag nopan nowheel absolute z-30 flex items-center gap-1 rounded-lg border p-1.5"
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
        return (
          <button
            key={i}
            type="button"
            onClick={() => selectColor(color)}
            className="relative flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150"
            style={{
              backgroundColor: color.fill,
              border: isActive
                ? `2px solid ${color.text}`
                : "1px solid var(--border-default)",
              boxShadow: isActive ? `0 0 0 2px ${color.text}33` : "none",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.boxShadow = `0 0 6px 1px ${color.text}55`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.boxShadow = "none";
              }
            }}
            aria-label={`Set node color ${i + 1}`}
          >
            <span
              className="text-[10px] font-bold leading-none"
              style={{ color: color.text }}
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
