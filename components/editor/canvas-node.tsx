"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Handle,
  Position,
  NodeResizer,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import {
  resolveNodeColor,
  type CanvasNodeData,
  type NodeShape,
} from "@/types/canvas";
import { NodeColorToolbar } from "@/components/editor/node-color-toolbar";
import { useRemoteHighlights } from "@/components/editor/remote-selection-context";
import { useTheme } from "@/lib/theme-provider";

const CSS_SHAPE_RADIUS: Partial<Record<NodeShape, string>> = {
  rectangle: "12px",
  pill: "999px",
  circle: "50%",
};

function isCssShape(shape: NodeShape): boolean {
  return shape in CSS_SHAPE_RADIUS;
}

function SvgShape({
  shape,
  width,
  height,
  fill,
  stroke,
  strokeWidth,
}: {
  shape: NodeShape;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}) {
  if (shape === "diamond") {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="pointer-events-none absolute inset-0"
      >
        <polygon
          points={`${hw},0 ${width},${hh} ${hw},${height} 0,${hh}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }

  if (shape === "hexagon") {
    const inset = width * 0.18;
    const hh = height / 2;
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="pointer-events-none absolute inset-0"
      >
        <polygon
          points={`${inset},0 ${width - inset},0 ${width},${hh} ${width - inset},${height} ${inset},${height} 0,${hh}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }

  // cylinder
  const ry = height * 0.12;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0"
    >
      <path
        d={`M 0 ${ry} A ${width / 2} ${ry} 0 0 1 ${width} ${ry} L ${width} ${height - ry} A ${width / 2} ${ry} 0 0 1 0 ${height - ry} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <ellipse
        cx={width / 2}
        cy={ry}
        rx={width / 2}
        ry={ry}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

const MIN_NODE_WIDTH = 60;
const MIN_NODE_HEIGHT = 40;

function RemoteSelectionRings({
  shape,
  width,
  height,
  highlights,
}: {
  shape: NodeShape;
  width: number;
  height: number;
  highlights: { userId: string; color: string; name: string }[];
}) {
  if (highlights.length === 0) return null;

  return (
    <>
      {highlights.map((person, index) => {
        const pad = 4 + index * 3;
        const ringWidth = width + pad * 2;
        const ringHeight = height + pad * 2;
        const names = highlights.map((h) => h.name).join(", ");

        if (isCssShape(shape)) {
          return (
            <div
              key={person.userId}
              className="pointer-events-none absolute"
              title={names}
              aria-hidden="true"
              style={{
                left: -pad,
                top: -pad,
                width: ringWidth,
                height: ringHeight,
                border: `2px solid ${person.color}`,
                borderRadius: CSS_SHAPE_RADIUS[shape],
              }}
            />
          );
        }

        return (
          <div
            key={person.userId}
            className="pointer-events-none absolute"
            title={names}
            aria-hidden="true"
            style={{
              left: -pad,
              top: -pad,
              width: ringWidth,
              height: ringHeight,
            }}
          >
            <SvgShape
              shape={shape}
              width={ringWidth}
              height={ringHeight}
              fill="none"
              stroke={person.color}
              strokeWidth={2}
            />
          </div>
        );
      })}
    </>
  );
}

function CanvasNodeInner({ id, data, selected, width, height }: NodeProps) {
  const nodeData = data as CanvasNodeData;
  const { resolvedTheme } = useTheme();
  const resolvedColor = resolveNodeColor(nodeData.color, resolvedTheme);
  const shape = nodeData.shape ?? "rectangle";
  const w = width ?? 176;
  const h = height ?? 64;
  const { updateNodeData } = useReactFlow();
  const remoteHighlights = useRemoteHighlights(id);

  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stroke = selected
    ? resolvedColor.text
    : resolvedTheme === "light"
    ? resolvedColor.border
    : "var(--border-default)";
  const strokeWidth = selected ? 2 : 1.25;
  const labelColor = resolvedColor.text;

  const startEditing = useCallback(() => {
    setEditing(true);
  }, []);

  const stopEditing = useCallback(() => {
    setEditing(false);
  }, []);

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { label: e.target.value });
    },
    [id, updateNodeData],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        stopEditing();
      }
    },
    [stopEditing],
  );

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const label = editing ? (
    <textarea
      ref={textareaRef}
      value={nodeData.label}
      onChange={handleLabelChange}
      onBlur={stopEditing}
      onKeyDown={handleKeyDown}
      rows={1}
      className="nodrag nopan nowheel absolute inset-0 z-10 h-full w-full resize-none appearance-none overflow-hidden border-0 bg-transparent p-3 text-center text-sm font-semibold leading-[1.5] outline-none shadow-none ring-0 focus:border-transparent focus:outline-none focus:ring-0"
      style={{ color: labelColor, alignContent: "center" }}
    />
  ) : (
    <span
      className="pointer-events-none relative z-10 px-3 text-center text-sm font-semibold tracking-tight"
      style={{ color: labelColor }}
    >
      {nodeData.label || (
        <span style={{ color: labelColor, opacity: 0.4 }}>Label</span>
      )}
    </span>
  );

  let content: React.ReactNode;

  if (isCssShape(shape)) {
    content = (
      <div
        className="relative flex h-full w-full items-center justify-center transition-colors"
        style={{
          backgroundColor: resolvedColor.fill,
          border: `${strokeWidth}px solid ${stroke}`,
          borderRadius: CSS_SHAPE_RADIUS[shape],
        }}
        onDoubleClick={startEditing}
      >
        {label}
      </div>
    );
  } else {
    content = (
      <div
        className="relative flex h-full w-full items-center justify-center transition-colors"
        onDoubleClick={startEditing}
      >
        <SvgShape
          shape={shape}
          width={w}
          height={h}
          fill={resolvedColor.fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        {label}
      </div>
    );
  }

  return (
    <div
      className="group relative flex items-center justify-center overflow-visible"
      style={{ width: w, height: h }}
    >
      <RemoteSelectionRings
        shape={shape}
        width={w}
        height={h}
        highlights={remoteHighlights}
      />
      <NodeResizer
        minWidth={MIN_NODE_WIDTH}
        minHeight={MIN_NODE_HEIGHT}
        isVisible={!!selected}
        lineClassName="!border-[var(--accent-primary)]"
        handleClassName="!h-2 !w-2 !rounded-sm !border-[var(--accent-primary)] !bg-[var(--bg-elevated)]"
      />
      {content}
      <NodeColorToolbar id={id} data={nodeData} selected={!!selected} width={width} height={height} />
      {(
        [Position.Top, Position.Right, Position.Bottom, Position.Left] as const
      ).map((pos) => (
        <span key={pos}>
          <Handle
            type="source"
            position={pos}
            id={`${pos}-source`}
            className="!z-20 !h-2.5 !w-2.5 !rounded-full !border !bg-[var(--accent-primary)] !border-[var(--bg-surface)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          />
          <Handle
            type="target"
            position={pos}
            id={`${pos}-target`}
            className="!z-20 !h-2.5 !w-2.5 !rounded-full !border !bg-[var(--accent-primary)] !border-[var(--bg-surface)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          />
        </span>
      ))}
    </div>
  );
}

export const CanvasNodeComponent = memo(CanvasNodeInner);
