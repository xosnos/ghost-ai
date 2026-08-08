"use client";

import { Square, Diamond, Circle, Pill, Cylinder, Hexagon } from "lucide-react";
import { Panel } from "@xyflow/react";
import { NODE_SHAPES, SHAPE_DEFAULT_SIZES, type NodeShape } from "@/types/canvas";

const SHAPE_ICONS: Record<NodeShape, typeof Square> = {
  rectangle: Square,
  diamond: Diamond,
  circle: Circle,
  pill: Pill,
  cylinder: Cylinder,
  hexagon: Hexagon,
};

export function ShapePanel() {
  const onDragStart = (event: React.DragEvent<HTMLButtonElement>, shape: NodeShape) => {
    const size = SHAPE_DEFAULT_SIZES[shape];
    const payload = JSON.stringify({ shape, width: size.width, height: size.height });
    event.dataTransfer.setData("application/reactflow-shape", payload);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <Panel
      position="bottom-center"
      className="m-0 flex items-center gap-1 rounded-full px-2 py-1.5"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
      }}
    >
      {NODE_SHAPES.map((shape) => {
        const Icon = SHAPE_ICONS[shape];
        return (
          <button
            key={shape}
            draggable
            onDragStart={(e) => onDragStart(e, shape)}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ color: "var(--text-secondary)" }}
            title={shape}
            aria-label={shape}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </Panel>
  );
}
