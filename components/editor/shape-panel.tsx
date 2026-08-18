"use client";

import { Panel, useReactFlow } from "@xyflow/react";
import { Circle, Cylinder, Diamond, Hexagon, Pill, Square } from "lucide-react";
import { NODE_SHAPES, type NodeShape, SHAPE_DEFAULT_SIZES } from "@/types/canvas";

const SHAPE_ICONS: Record<NodeShape, typeof Square> = {
  rectangle: Square,
  diamond: Diamond,
  circle: Circle,
  pill: Pill,
  cylinder: Cylinder,
  hexagon: Hexagon,
};

function buildShapeSvg(shape: NodeShape, width: number, height: number): string {
  const fill = "var(--bg-elevated, #18181c)";
  const stroke = "var(--border-subtle, #3a3a42)";
  const sw = 1.5;

  if (shape === "diamond") {
    const hw = width / 2;
    const hh = height / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><polygon points="${hw},0 ${width},${hh} ${hw},${height} 0,${hh}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
  }
  if (shape === "hexagon") {
    const inset = width * 0.18;
    const hh = height / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><polygon points="${inset},0 ${width - inset},0 ${width},${hh} ${width - inset},${height} ${inset},${height} 0,${hh}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
  }
  if (shape === "cylinder") {
    const ry = height * 0.12;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="M 0 ${ry} A ${width / 2} ${ry} 0 0 1 ${width} ${ry} L ${width} ${height - ry} A ${width / 2} ${ry} 0 0 1 0 ${height - ry} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/><ellipse cx="${width / 2}" cy="${ry}" rx="${width / 2}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
  }
  return "";
}

function buildDragPreview(shape: NodeShape, width: number, height: number): HTMLElement {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.top = "-9999px";
  container.style.left = "-9999px";
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.opacity = "0.85";

  if (shape === "rectangle" || shape === "pill" || shape === "circle") {
    const inner = document.createElement("div");
    inner.style.width = "100%";
    inner.style.height = "100%";
    inner.style.backgroundColor = "var(--bg-elevated)";
    inner.style.border = "1.5px solid var(--border-subtle)";
    inner.style.borderRadius = shape === "rectangle" ? "12px" : shape === "pill" ? "999px" : "50%";
    container.appendChild(inner);
  } else {
    const svg = buildShapeSvg(shape, width, height);
    container.innerHTML = svg;
  }

  document.body.appendChild(container);
  return container;
}

export function ShapePanel() {
  const { getZoom } = useReactFlow();

  const onDragStart = (event: React.DragEvent<HTMLButtonElement>, shape: NodeShape) => {
    const size = SHAPE_DEFAULT_SIZES[shape];
    const payload = JSON.stringify({ shape, width: size.width, height: size.height });
    event.dataTransfer.setData("application/reactflow-shape", payload);
    event.dataTransfer.effectAllowed = "move";

    const zoom = getZoom() || 1;
    const previewWidth = Math.max(20, Math.round(size.width * zoom));
    const previewHeight = Math.max(20, Math.round(size.height * zoom));

    const preview = buildDragPreview(shape, previewWidth, previewHeight);
    event.dataTransfer.setDragImage(preview, previewWidth / 2, previewHeight / 2);
    setTimeout(() => preview.remove(), 0);
  };

  return (
    <Panel
      position="bottom-center"
      className="m-0 flex items-center gap-1 rounded-full px-2 py-1.5 shadow-xl backdrop-blur-md transition-colors bg-[var(--bg-surface)] border border-[var(--border-default)]"
    >
      {NODE_SHAPES.map((shape) => {
        const Icon = SHAPE_ICONS[shape];
        return (
          <button
            key={shape}
            type="button"
            draggable
            onDragStart={(e) => onDragStart(e, shape)}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
