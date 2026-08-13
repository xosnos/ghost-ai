import type { Node, Edge } from "@xyflow/react";

export interface NodeColor {
  fill: string;
  text: string;
}

export const NODE_COLORS: NodeColor[] = [
  { fill: "#1F1F1F", text: "#EDEDED" },
  { fill: "#10233D", text: "#52A8FF" },
  { fill: "#2E1938", text: "#BF7AF0" },
  { fill: "#331B00", text: "#FF990A" },
  { fill: "#3C1618", text: "#FF6166" },
  { fill: "#3A1726", text: "#F75F8F" },
  { fill: "#0F2E18", text: "#62C073" },
  { fill: "#062822", text: "#0AC7B4" },
];

export const DEFAULT_NODE_COLOR = NODE_COLORS[0];

export const NODE_SHAPES = [
  "rectangle",
  "diamond",
  "circle",
  "pill",
  "cylinder",
  "hexagon",
] as const;

export type NodeShape = (typeof NODE_SHAPES)[number];

export interface CanvasNodeData {
  label: string;
  color: NodeColor;
  shape: NodeShape;
  [key: string]: unknown;
}

export type CanvasNode = Node<CanvasNodeData, "canvasNode">;
export type CanvasEdge = Edge;

export const SHAPE_DEFAULT_SIZES: Record<NodeShape, { width: number; height: number }> = {
  rectangle: { width: 176, height: 64 },
  diamond: { width: 200, height: 160 },
  circle: { width: 120, height: 120 },
  pill: { width: 160, height: 56 },
  cylinder: { width: 140, height: 100 },
  hexagon: { width: 160, height: 120 },
};

export type CanvasNodeType = "canvasNode";


