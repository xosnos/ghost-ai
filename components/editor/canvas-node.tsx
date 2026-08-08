"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { DEFAULT_NODE_COLOR, type CanvasNodeData } from "@/types/canvas";

function CanvasNodeInner({ data }: NodeProps) {
  const nodeData = data as CanvasNodeData;
  const color = nodeData.color ?? DEFAULT_NODE_COLOR;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: color.fill,
        border: "1px solid var(--border-default)",
        borderRadius: 12,
      }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <span
        className="px-3 text-center text-sm font-medium"
        style={{ color: color.text }}
      >
        {nodeData.label}
      </span>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

export const CanvasNodeComponent = memo(CanvasNodeInner);
