"use client";

import { Download } from "lucide-react";
import { useMemo } from "react";
import { CANVAS_TEMPLATES, type CanvasTemplate } from "@/components/editor/starter-templates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/lib/theme-provider";
import { type CanvasNode, type NodeShape, resolveNodeColor } from "@/types/canvas";

const PREVIEW_W = 280;
const PREVIEW_H = 184;
const PADDING = 16;

interface StarterTemplatesModalProps {
  open: boolean;
  onImport: (template: CanvasTemplate) => void;
  onClose: () => void;
}

function shapeSvg(shape: NodeShape, width: number, height: number, fill: string, stroke: string) {
  const strokeWidth = 1;
  switch (shape) {
    case "rectangle":
      return (
        <rect
          width={width}
          height={height}
          rx={5}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case "pill":
      return (
        <rect
          width={width}
          height={height}
          rx={height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case "circle":
      return (
        <circle
          cx={width / 2}
          cy={height / 2}
          r={Math.min(width, height) / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case "diamond": {
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      return (
        <polygon
          points={`${halfWidth},0 ${width},${halfHeight} ${halfWidth},${height} 0,${halfHeight}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
    case "hexagon": {
      const inset = width * 0.18;
      const halfHeight = height / 2;
      return (
        <polygon
          points={`${inset},0 ${width - inset},0 ${width},${halfHeight} ${width - inset},${height} ${inset},${height} 0,${halfHeight}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
    case "cylinder": {
      const radiusY = height * 0.12;
      return (
        <g>
          <path
            d={`M 0 ${radiusY} A ${width / 2} ${radiusY} 0 0 1 ${width} ${radiusY} L ${width} ${height - radiusY} A ${width / 2} ${radiusY} 0 0 1 0 ${height - radiusY} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <ellipse
            cx={width / 2}
            cy={radiusY}
            rx={width / 2}
            ry={radiusY}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </g>
      );
    }
  }
}

export function TemplatePreview({ template }: { template: CanvasTemplate }) {
  const { resolvedTheme } = useTheme();
  const { nodes, edges, bounds } = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of template.nodes) {
      const width = node.width ?? 176;
      const height = node.height ?? 64;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + width);
      maxY = Math.max(maxY, node.position.y + height);
    }

    return {
      nodes: template.nodes,
      edges: template.edges,
      bounds: { minX, minY, maxX, maxY },
    };
  }, [template]);

  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  const availableWidth = PREVIEW_W - PADDING * 2;
  const availableHeight = PREVIEW_H - PADDING * 2;
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1);
  const offsetX = PADDING - bounds.minX * scale + (availableWidth - contentWidth * scale) / 2;
  const offsetY = PADDING - bounds.minY * scale + (availableHeight - contentHeight * scale) / 2;
  const nodeById = new Map<string, CanvasNode>(nodes.map((node) => [node.id, node]));
  const markerId = `template-arrow-${template.id}`;

  const pointOnNodeBoundary = (node: CanvasNode, towardX: number, towardY: number) => {
    const width = node.width ?? 176;
    const height = node.height ?? 64;
    const centerX = node.position.x + width / 2;
    const centerY = node.position.y + height / 2;
    const deltaX = towardX - centerX;
    const deltaY = towardY - centerY;
    const scaleToBoundary = Math.min(
      width / 2 / Math.max(Math.abs(deltaX), 0.001),
      height / 2 / Math.max(Math.abs(deltaY), 0.001),
    );

    return {
      x: (centerX + deltaX * scaleToBoundary) * scale + offsetX,
      y: (centerY + deltaY * scaleToBoundary) * scale + offsetY,
    };
  };

  return (
    <svg
      viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
      className="block h-full w-full"
      role="img"
      aria-label={`${template.name} diagram preview`}
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="5"
          markerHeight="5"
          refX="4"
          refY="2.5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 5 2.5 L 0 5 z" fill="var(--text-secondary)" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) return null;
        const sourceCenterX = source.position.x + (source.width ?? 176) / 2;
        const sourceCenterY = source.position.y + (source.height ?? 64) / 2;
        const targetCenterX = target.position.x + (target.width ?? 176) / 2;
        const targetCenterY = target.position.y + (target.height ?? 64) / 2;
        const sourcePoint = pointOnNodeBoundary(source, targetCenterX, targetCenterY);
        const targetPoint = pointOnNodeBoundary(target, sourceCenterX, sourceCenterY);
        const label = (edge.data as { label?: string } | undefined)?.label;
        const midX = (sourcePoint.x + targetPoint.x) / 2;
        const midY = (sourcePoint.y + targetPoint.y) / 2;

        return (
          <g key={edge.id}>
            <line
              x1={sourcePoint.x}
              y1={sourcePoint.y}
              x2={targetPoint.x}
              y2={targetPoint.y}
              stroke="var(--text-secondary)"
              strokeWidth={1.2}
              strokeLinecap="round"
              opacity={0.72}
              markerEnd={`url(#${markerId})`}
            />
            {label && (
              <g transform={`translate(${midX},${midY})`}>
                <rect
                  x={-(label.length * 2.1 + 4)}
                  y={-4.5}
                  width={label.length * 4.2 + 8}
                  height={9}
                  rx={4.5}
                  fill="var(--bg-elevated)"
                  stroke="var(--border-default)"
                  strokeWidth={0.6}
                />
                <text
                  x={0}
                  y={0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={4.5}
                  fill="var(--text-secondary)"
                  style={{ pointerEvents: "none" }}
                >
                  {label}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {nodes.map((node) => {
        const width = (node.width ?? 176) * scale;
        const height = (node.height ?? 64) * scale;
        const x = node.position.x * scale + offsetX;
        const y = node.position.y * scale + offsetY;
        const resolved = resolveNodeColor(node.data.color, resolvedTheme);
        const fill = resolved.fill;
        const stroke = resolvedTheme === "light" ? resolved.border : resolved.text;
        const fontSize = Math.max(5, Math.min(width, height) * 0.18);

        return (
          <g key={node.id} transform={`translate(${x},${y})`}>
            {shapeSvg(node.data.shape, width, height, fill, stroke)}
            {node.data.label && width > 30 && height > 18 && (
              <text
                x={width / 2}
                y={height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                fill={resolved.text}
                fontWeight="600"
                style={{ pointerEvents: "none" }}
              >
                {node.data.label.length > Math.floor(width / 6)
                  ? `${node.data.label.slice(0, Math.floor(width / 6))}…`
                  : node.data.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function StarterTemplatesModal({ open, onImport, onClose }: StarterTemplatesModalProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="flex h-[min(90dvh,920px)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-7 pb-5 pt-7 sm:px-8 sm:pt-8">
          <DialogTitle className="text-2xl tracking-tight">Import Template</DialogTitle>
          <DialogDescription className="max-w-3xl text-sm leading-6">
            Choose a starter template to pre-populate your canvas. Existing nodes and edges will
            stay in place.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 pb-7 sm:px-8 sm:pb-8">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {CANVAS_TEMPLATES.map((template) => (
              <article
                key={template.id}
                className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border transition-colors duration-200"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <div
                  className="h-44 border-b p-2 transition-colors duration-200 group-hover:border-[var(--border-subtle)]"
                  style={{
                    borderColor: "var(--border-default)",
                    backgroundColor: "var(--bg-base)",
                  }}
                >
                  <TemplatePreview template={template} />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {template.name.replace(" Architecture", "")}
                    </h3>
                    <p className="text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                      {template.description}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-auto w-full gap-2 border"
                    onClick={() => onImport(template)}
                  >
                    <Download className="h-4 w-4" />
                    Import
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
