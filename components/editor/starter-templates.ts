import {
  NODE_COLORS,
  type CanvasNode,
  type CanvasEdge,
  type NodeShape,
  type NodeColor,
} from "@/types/canvas";

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const C = NODE_COLORS;

function node(
  id: string,
  x: number,
  y: number,
  shape: NodeShape,
  color: NodeColor,
  label: string,
  width?: number,
  height?: number,
): CanvasNode {
  return {
    id,
    type: "canvasNode",
    position: { x, y },
    width,
    height,
    data: { label, color, shape },
  } as unknown as CanvasNode;
}

function edge(source: string, target: string, label?: string): CanvasEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: "canvasEdge",
    markerEnd: { type: "arrowclosed" },
    data: label ? { label } : {},
  } as unknown as CanvasEdge;
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: "microservices",
    name: "Microservices Architecture",
    description:
      "An API gateway routing requests to independent backend services with a shared database layer.",
    nodes: [
      node("client", 60, 220, "pill", C[1], "Client"),
      node("gateway", 340, 220, "hexagon", C[0], "API Gateway", 180, 100),
      node("auth", 640, 60, "rectangle", C[6], "Auth Service"),
      node("orders", 640, 220, "rectangle", C[5], "Orders Service"),
      node("payments", 640, 380, "rectangle", C[3], "Payments Service"),
      node("auth-db", 920, 60, "cylinder", C[7], "Auth DB", 140, 100),
      node("orders-db", 920, 220, "cylinder", C[7], "Orders DB", 140, 100),
      node("payments-db", 920, 380, "cylinder", C[7], "Payments DB", 140, 100),
    ],
    edges: [
      edge("client", "gateway", "HTTPS"),
      edge("gateway", "auth"),
      edge("gateway", "orders"),
      edge("gateway", "payments"),
      edge("auth", "auth-db"),
      edge("orders", "orders-db"),
      edge("payments", "payments-db"),
    ],
  },
  {
    id: "ci-cd",
    name: "CI/CD Pipeline",
    description:
      "From source commit through build, test, and deploy stages with approval gates.",
    nodes: [
      node("commit", 60, 200, "circle", C[1], "Commit", 120, 120),
      node("build", 280, 200, "rectangle", C[0], "Build"),
      node("test", 500, 200, "rectangle", C[6], "Test"),
      node("approve", 720, 200, "diamond", C[3], "Approve?", 200, 160),
      node("deploy-staging", 980, 100, "pill", C[5], "Deploy Staging"),
      node("deploy-prod", 980, 320, "pill", C[4], "Deploy Prod"),
    ],
    edges: [
      edge("commit", "build"),
      edge("build", "test"),
      edge("test", "approve"),
      edge("approve", "deploy-staging", "staging"),
      edge("approve", "deploy-prod", "prod"),
    ],
  },
  {
    id: "event-driven",
    name: "Event-Driven System",
    description:
      "Producers emit events to a message broker; consumers react and persist to independent stores.",
    nodes: [
      node("api", 60, 60, "pill", C[1], "REST API"),
      node("webhook", 60, 320, "pill", C[5], "Webhook"),
      node("broker", 360, 180, "hexagon", C[0], "Message Broker", 200, 120),
      node("order-consumer", 680, 40, "rectangle", C[6], "Order Consumer"),
      node("email-consumer", 680, 200, "rectangle", C[3], "Email Consumer"),
      node("audit-consumer", 680, 360, "rectangle", C[7], "Audit Consumer"),
      node("order-store", 960, 40, "cylinder", C[7], "Order Store", 140, 100),
      node("email-log", 960, 200, "cylinder", C[7], "Email Log", 140, 100),
      node("audit-db", 960, 360, "cylinder", C[7], "Audit DB", 140, 100),
    ],
    edges: [
      edge("api", "broker", "publish"),
      edge("webhook", "broker", "publish"),
      edge("broker", "order-consumer", "subscribe"),
      edge("broker", "email-consumer", "subscribe"),
      edge("broker", "audit-consumer", "subscribe"),
      edge("order-consumer", "order-store"),
      edge("email-consumer", "email-log"),
      edge("audit-consumer", "audit-db"),
    ],
  },
];
