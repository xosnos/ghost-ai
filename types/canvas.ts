import type { Node, Edge } from "@xyflow/react";

export interface NodeColor {
  fill: string;
  text: string;
  lightFill?: string;
  lightText?: string;
  lightBorder?: string;
  name?: string;
}

export const NODE_COLORS: NodeColor[] = [
  {
    fill: "#1F1F1F",
    text: "#EDEDED",
    lightFill: "#F3F4F6",
    lightText: "#1F2937",
    lightBorder: "#D1D5DB",
    name: "neutral",
  },
  {
    fill: "#10233D",
    text: "#52A8FF",
    lightFill: "#EFF6FF",
    lightText: "#1D4ED8",
    lightBorder: "#93C5FD",
    name: "blue",
  },
  {
    fill: "#2E1938",
    text: "#BF7AF0",
    lightFill: "#FAF5FF",
    lightText: "#7E22CE",
    lightBorder: "#D8B4FE",
    name: "purple",
  },
  {
    fill: "#331B00",
    text: "#FF990A",
    lightFill: "#FFF7ED",
    lightText: "#C2410C",
    lightBorder: "#FDBA74",
    name: "orange",
  },
  {
    fill: "#3C1618",
    text: "#FF6166",
    lightFill: "#FEF2F2",
    lightText: "#B91C1C",
    lightBorder: "#FCA5A5",
    name: "red",
  },
  {
    fill: "#3A1726",
    text: "#F75F8F",
    lightFill: "#FDF2F8",
    lightText: "#BE185D",
    lightBorder: "#F9A8D4",
    name: "pink",
  },
  {
    fill: "#0F2E18",
    text: "#62C073",
    lightFill: "#F0FDF4",
    lightText: "#15803D",
    lightBorder: "#86EFAC",
    name: "green",
  },
  {
    fill: "#062822",
    text: "#0AC7B4",
    lightFill: "#F0FDFA",
    lightText: "#0F766E",
    lightBorder: "#5EEAD4",
    name: "teal",
  },
];

export const DEFAULT_NODE_COLOR = NODE_COLORS[0];

export function resolveNodeColor(
  color: NodeColor | undefined,
  theme: "dark" | "light" = "dark"
): { fill: string; text: string; border: string } {
  const fallback = NODE_COLORS[0];
  const target = color ?? fallback;

  // Match existing color by fill/text in NODE_COLORS
  const matched =
    NODE_COLORS.find(
      (c) =>
        c.fill.toLowerCase() === target.fill?.toLowerCase() ||
        c.text.toLowerCase() === target.text?.toLowerCase() ||
        c.lightFill?.toLowerCase() === target.fill?.toLowerCase() ||
        c.lightText?.toLowerCase() === target.text?.toLowerCase()
    ) ?? target;

  if (theme === "light") {
    return {
      fill: matched.lightFill || "#F3F4F6",
      text: matched.lightText || "#1F2937",
      border: matched.lightBorder || "#D1D5DB",
    };
  }

  return {
    fill: matched.fill || "#1F1F1F",
    text: matched.text || "#EDEDED",
    border: "var(--border-default)",
  };
}

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

export type HandlePosition = "top" | "right" | "bottom" | "left";

export interface NodeGeometry {
  position: { x: number; y: number };
  width?: number;
  height?: number;
  initialWidth?: number;
  initialHeight?: number;
  style?: { width?: number | string; height?: number | string };
  measured?: { width?: number; height?: number };
  data?: { shape?: NodeShape; [key: string]: unknown };
}

export function getNodeDimensions(node: NodeGeometry): { width: number; height: number } {
  const shape = (node.data?.shape || "rectangle") as NodeShape;
  const def = SHAPE_DEFAULT_SIZES[shape] || { width: 176, height: 64 };
  const w =
    node.measured?.width ??
    node.width ??
    node.initialWidth ??
    (typeof node.style?.width === "number" ? node.style.width : undefined) ??
    def.width;
  const h =
    node.measured?.height ??
    node.height ??
    node.initialHeight ??
    (typeof node.style?.height === "number" ? node.style.height : undefined) ??
    def.height;
  return { width: w, height: h };
}

export function calculateEdgeHandles(
  sourceNode: NodeGeometry,
  targetNode: NodeGeometry
): { sourceHandle: HandlePosition; targetHandle: HandlePosition } {
  const sourceDims = getNodeDimensions(sourceNode);
  const targetDims = getNodeDimensions(targetNode);

  const sourceCenterX = sourceNode.position.x + sourceDims.width / 2;
  const sourceCenterY = sourceNode.position.y + sourceDims.height / 2;
  const targetCenterX = targetNode.position.x + targetDims.width / 2;
  const targetCenterY = targetNode.position.y + targetDims.height / 2;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  // Determine dominant axis for natural routing
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: "right", targetHandle: "left" }
      : { sourceHandle: "left", targetHandle: "right" };
  } else {
    return dy >= 0
      ? { sourceHandle: "bottom", targetHandle: "top" }
      : { sourceHandle: "top", targetHandle: "bottom" };
  }
}

export function normalizeCanvasNode(node: CanvasNode): CanvasNode {
  const dims = getNodeDimensions(node);
  return {
    ...node,
    width: dims.width,
    height: dims.height,
    initialWidth: dims.width,
    initialHeight: dims.height,
    style: {
      ...(node.style || {}),
      width: dims.width,
      height: dims.height,
    },
  };
}

export function normalizeCanvasEdge(
  edge: CanvasEdge,
  nodeMap?: Map<string, CanvasNode> | CanvasNode[]
): CanvasEdge {
  if (edge.sourceHandle && edge.targetHandle) {
    return edge;
  }

  let sourceNode: CanvasNode | undefined;
  let targetNode: CanvasNode | undefined;

  if (nodeMap) {
    if (Array.isArray(nodeMap)) {
      sourceNode = nodeMap.find((n) => n.id === edge.source);
      targetNode = nodeMap.find((n) => n.id === edge.target);
    } else {
      sourceNode = nodeMap.get(edge.source);
      targetNode = nodeMap.get(edge.target);
    }
  }

  if (sourceNode && targetNode) {
    const handles = calculateEdgeHandles(sourceNode, targetNode);
    return {
      ...edge,
      sourceHandle: edge.sourceHandle || handles.sourceHandle,
      targetHandle: edge.targetHandle || handles.targetHandle,
    };
  }

  return {
    ...edge,
    sourceHandle: edge.sourceHandle || "right",
    targetHandle: edge.targetHandle || "left",
  };
}



