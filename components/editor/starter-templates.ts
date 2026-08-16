import {
  NODE_COLORS,
  SHAPE_DEFAULT_SIZES,
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
  const size = SHAPE_DEFAULT_SIZES[shape];
  const resolvedWidth = width ?? size.width;
  const resolvedHeight = height ?? size.height;
  return {
    id,
    type: "canvasNode",
    position: { x, y },
    width: resolvedWidth,
    height: resolvedHeight,
    style: { width: resolvedWidth, height: resolvedHeight },
    initialWidth: resolvedWidth,
    initialHeight: resolvedHeight,
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
      "API Gateway routes incoming client traffic to isolated microservices, each backed by a dedicated database.",
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
      edge("gateway", "auth", "gRPC / Auth"),
      edge("gateway", "orders", "REST / Orders"),
      edge("gateway", "payments", "REST / Payments"),
      edge("auth", "auth-db", "SQL / Query"),
      edge("orders", "orders-db", "SQL / Query"),
      edge("payments", "payments-db", "SQL / ACID"),
    ],
  },
  {
    id: "ci-cd",
    name: "CI/CD Pipeline",
    description:
      "End-to-end delivery from source commit through build, test, containerization, and staged deployment to production.",
    nodes: [
      node("commit", 60, 200, "circle", C[1], "Commit", 120, 120),
      node("build", 280, 200, "rectangle", C[0], "Build"),
      node("test", 500, 200, "rectangle", C[6], "Test"),
      node("approve", 720, 200, "diamond", C[3], "Approve?", 200, 160),
      node("deploy-staging", 980, 100, "pill", C[5], "Deploy Staging"),
      node("deploy-prod", 980, 320, "pill", C[4], "Deploy Prod"),
    ],
    edges: [
      edge("commit", "build", "git push"),
      edge("build", "test", "artifacts"),
      edge("test", "approve", "tests pass"),
      edge("approve", "deploy-staging", "staging"),
      edge("approve", "deploy-prod", "prod"),
    ],
  },
  {
    id: "event-driven",
    name: "Event-Driven System",
    description:
      "Producers publish events to a central bus. Independent consumers handle emails, push notifications, analytics, and error queues.",
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
      edge("order-consumer", "order-store", "persist"),
      edge("email-consumer", "email-log", "append log"),
      edge("audit-consumer", "audit-db", "audit trail"),
    ],
  },
  {
    id: "serverless-api",
    name: "Serverless Edge Stack",
    description:
      "Edge routing with Cloudflare Workers, distributed Auth, Supabase Postgres backend, and S3 asset delivery.",
    nodes: [
      node("edge-router", 60, 200, "pill", C[1], "Edge Router"),
      node("auth-worker", 340, 100, "rectangle", C[6], "Auth Worker"),
      node("api-worker", 340, 300, "rectangle", C[2], "API Worker"),
      node("supabase-db", 640, 200, "cylinder", C[7], "Supabase DB", 150, 100),
      node("s3-bucket", 640, 380, "cylinder", C[5], "S3 Bucket", 140, 100),
    ],
    edges: [
      edge("edge-router", "auth-worker", "verify"),
      edge("edge-router", "api-worker", "proxy"),
      edge("auth-worker", "supabase-db", "session / RLS"),
      edge("api-worker", "supabase-db", "CRUD / SQL"),
      edge("api-worker", "s3-bucket", "assets / S3"),
    ],
  },
  {
    id: "realtime-engine",
    name: "Real-time AI Canvas Engine",
    description:
      "WebSocket state synchronization cluster with AI agent inference queue, Redis pub/sub, and snapshot storage.",
    nodes: [
      node("clients", 60, 220, "pill", C[1], "Web Clients"),
      node("ws-gateway", 340, 220, "hexagon", C[0], "WS Gateway", 180, 100),
      node("redis-pubsub", 620, 100, "cylinder", C[4], "Redis Pub/Sub", 160, 100),
      node("ai-agent", 620, 320, "rectangle", C[2], "AI Agent Worker"),
      node("postgres-store", 900, 220, "cylinder", C[7], "Postgres DB", 140, 100),
    ],
    edges: [
      edge("clients", "ws-gateway", "wss://"),
      edge("ws-gateway", "redis-pubsub", "sync"),
      edge("ws-gateway", "ai-agent", "prompt"),
      edge("redis-pubsub", "postgres-store", "persist"),
      edge("ai-agent", "postgres-store", "save spec"),
    ],
  },
];

