"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download } from "lucide-react";
import {
  CANVAS_TEMPLATES,
  type CanvasTemplate,
} from "@/components/editor/starter-templates";
import type { CanvasNode, NodeShape } from "@/types/canvas";

const PREVIEW_W = 280;
const PREVIEW_H = 160;
const PADDING = 12;

interface StarterTemplatesModalProps {
  open: boolean;
  onImport: (template: CanvasTemplate) => void;
  onClose: () => void;
}

function shapeSvg(
  shape: NodeShape,
  w: number,
  h: number,
  fill: string,
  stroke: string,
) {
  const sw = 1;
  switch (shape) {
    case "rectangle":
      return (
        <rect x={0} y={0} width={w} height={h} rx={6} fill={fill} stroke={stroke} strokeWidth={sw} />
      );
    case "pill":
      return (
        <rect x={0} y={0} width={w} height={h} rx={h / 2} fill={fill} stroke={stroke} strokeWidth={sw} />
      );
    case "circle":
      return (
        <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2} fill={fill} stroke={stroke} strokeWidth={sw} />
      );
    case "diamond": {
      const hw = w / 2;
      const hh = h / 2;
      return (
        <polygon
          points={`${hw},0 ${w},${hh} ${hw},${h} 0,${hh}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    }
    case "hexagon": {
      const inset = w * 0.18;
      const hh = h / 2;
      return (
        <polygon
          points={`${inset},0 ${w - inset},0 ${w},${hh} ${w - inset},${h} ${inset},${h} 0,${hh}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    }
    case "cylinder": {
      const ry = h * 0.12;
      return (
        <g>
          <path
            d={`M 0 ${ry} A ${w / 2} ${ry} 0 0 1 ${w} ${ry} L ${w} ${h - ry} A ${w / 2} ${ry} 0 0 1 0 ${h - ry} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          <ellipse cx={w / 2} cy={ry} rx={w / 2} ry={ry} fill={fill} stroke={stroke} strokeWidth={sw} />
        </g>
      );
    }
  }
}

function TemplatePreview({ template }: { template: CanvasTemplate }) {
  const { nodes, edges, bounds } = useMemo(() => {
    const ns = template.nodes;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of ns) {
      const w = (n.width ?? 176) as number;
      const h = (n.height ?? 64) as number;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }
    return {
      nodes: ns,
      edges: template.edges,
      bounds: { minX, minY, maxX, maxY },
    };
  }, [template]);

  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  const availW = PREVIEW_W - PADDING * 2;
  const availH = PREVIEW_H - PADDING * 2;
  const scale = Math.min(availW / contentW, availH / contentH, 1);
  const offsetX = PADDING - bounds.minX * scale + (availW - contentW * scale) / 2;
  const offsetY = PADDING - bounds.minY * scale + (availH - contentH * scale) / 2;

  const nodeById = new Map<string, CanvasNode>();
  for (const n of nodes) nodeById.set(n.id, n);

  return (
    <svg
      width={PREVIEW_W}
      height={PREVIEW_H}
      className="rounded-xl"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {edges.map((e) => {
        const src = nodeById.get(e.source);
        const tgt = nodeById.get(e.target);
        if (!src || !tgt) return null;
        const sx = (src.position.x + ((src.width ?? 176) as number) / 2) * scale + offsetX;
        const sy = (src.position.y + ((src.height ?? 64) as number) / 2) * scale + offsetY;
        const tx = (tgt.position.x + ((tgt.width ?? 176) as number) / 2) * scale + offsetX;
        const ty = (tgt.position.y + ((tgt.height ?? 64) as number) / 2) * scale + offsetY;
        return (
          <line
            key={e.id}
            x1={sx}
            y1={sy}
            x2={tx}
            y2={ty}
            stroke="var(--text-muted)"
            strokeWidth={1}
            opacity={0.5}
          />
        );
      })}
      {nodes.map((n) => {
        const w = ((n.width ?? 176) as number) * scale;
        const h = ((n.height ?? 64) as number) * scale;
        const x = n.position.x * scale + offsetX;
        const y = n.position.y * scale + offsetY;
        const fill = n.data.color?.fill ?? "#1F1F1F";
        const stroke = n.data.color?.text ?? "var(--border-default)";
        return (
          <g key={n.id} transform={`translate(${x},${y})`}>
            {shapeSvg(n.data.shape, w, h, fill, stroke)}
            {n.data.label && w > 30 && h > 18 && (
              <text
                x={w / 2}
                y={h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.min(w, h) * 0.18}
                fill={n.data.color?.text ?? "#EDEDED"}
                style={{ pointerEvents: "none" }}
              >
                {n.data.label.length > Math.floor(w / 6)
                  ? n.data.label.slice(0, Math.floor(w / 6)) + "…"
                  : n.data.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function StarterTemplatesModal({
  open,
  onImport,
  onClose,
}: StarterTemplatesModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Starter Templates</DialogTitle>
          <DialogDescription>
            Pick a pre-built diagram to replace your current canvas.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] px-6 pb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CANVAS_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="flex flex-col gap-3 rounded-2xl border p-4"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-elevated)",
                }}
              >
                <TemplatePreview template={template} />
                <div className="flex flex-col gap-1">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {template.name}
                  </h3>
                  <p
                    className="text-xs leading-[1.5]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {template.description}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => onImport(template)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Import
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
