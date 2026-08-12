"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  DEFAULT_NODE_COLOR,
  type CanvasNodeData,
  type NodeShape,
} from "@/types/canvas";

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
        className="absolute inset-0"
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
        className="absolute inset-0"
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
  const bodyHeight = height - ry * 2;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0"
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

function CanvasNodeInner({ data, selected, width, height }: NodeProps) {
  const nodeData = data as CanvasNodeData;
  const color = nodeData.color ?? DEFAULT_NODE_COLOR;
  const shape = nodeData.shape ?? "rectangle";
  const w = width ?? 176;
  const h = height ?? 64;

  const stroke = selected ? color.text : "var(--border-default)";
  const strokeWidth = selected ? 1.5 : 1;
  const labelColor = color.text;

  const sharedLabel = (
    <span
      className="pointer-events-none relative z-10 px-3 text-center text-sm font-medium"
      style={{ color: labelColor }}
    >
      {nodeData.label}
    </span>
  );

  let content: React.ReactNode;

  if (isCssShape(shape)) {
    content = (
      <div
        className="relative flex h-full w-full items-center justify-center"
        style={{
          backgroundColor: color.fill,
          border: `${strokeWidth}px solid ${stroke}`,
          borderRadius: CSS_SHAPE_RADIUS[shape],
        }}
      >
        {sharedLabel}
      </div>
    );
  } else {
    content = (
      <div className="relative flex h-full w-full items-center justify-center">
        <SvgShape
          shape={shape}
          width={w}
          height={h}
          fill={color.fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        {sharedLabel}
      </div>
    );
  }

  return (
    <div
      className="group relative flex items-center justify-center"
      style={{ width: w, height: h }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border !bg-[var(--accent-primary)] !border-[var(--bg-elevated)] opacity-0 transition-opacity group-hover:opacity-100"
      />
      {content}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border !bg-[var(--accent-primary)] !border-[var(--bg-elevated)] opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  );
}

export const CanvasNodeComponent = memo(CanvasNodeInner);
