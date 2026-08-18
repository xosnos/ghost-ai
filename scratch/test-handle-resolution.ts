import {
  calculateEdgeHandles,
  normalizeCanvasNode,
  normalizeCanvasEdge,
  type CanvasNode,
  type CanvasEdge,
} from "../types/canvas";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

console.log("=== Testing Canvas Handle Calculations ===");

// 1. Horizontal Left-to-Right (e.g. Client -> Gateway)
const clientNode: CanvasNode = normalizeCanvasNode({
  id: "client",
  type: "canvasNode",
  position: { x: 100, y: 200 },
  data: { label: "Web Client", shape: "circle", color: { fill: "#1F1F1F", text: "#EDEDED" } },
} as unknown as CanvasNode);

const gatewayNode: CanvasNode = normalizeCanvasNode({
  id: "gateway",
  type: "canvasNode",
  position: { x: 380, y: 200 },
  data: { label: "API Gateway", shape: "diamond", color: { fill: "#10233D", text: "#52A8FF" } },
} as unknown as CanvasNode);

const clientToGatewayHandles = calculateEdgeHandles(clientNode, gatewayNode);
assert(
  clientToGatewayHandles.sourceHandle === "right" && clientToGatewayHandles.targetHandle === "left",
  `Client -> Gateway connects right to left (got ${clientToGatewayHandles.sourceHandle} -> ${clientToGatewayHandles.targetHandle})`
);

// 2. Gateway to Auth Service (Vertical below)
const authNode: CanvasNode = normalizeCanvasNode({
  id: "auth",
  type: "canvasNode",
  position: { x: 380, y: 440 },
  data: { label: "Auth Service", shape: "hexagon", color: { fill: "#331B00", text: "#FF990A" } },
} as unknown as CanvasNode);

const gatewayToAuthHandles = calculateEdgeHandles(gatewayNode, authNode);
assert(
  gatewayToAuthHandles.sourceHandle === "bottom" && gatewayToAuthHandles.targetHandle === "top",
  `Gateway -> Auth connects bottom to top (got ${gatewayToAuthHandles.sourceHandle} -> ${gatewayToAuthHandles.targetHandle})`
);

// 3. Gateway to Orders Service (Horizontal to the right)
const ordersNode: CanvasNode = normalizeCanvasNode({
  id: "orders",
  type: "canvasNode",
  position: { x: 660, y: 200 },
  data: { label: "Orders Service", shape: "pill", color: { fill: "#2E1938", text: "#BF7AF0" } },
} as unknown as CanvasNode);

const gatewayToOrdersHandles = calculateEdgeHandles(gatewayNode, ordersNode);
assert(
  gatewayToOrdersHandles.sourceHandle === "right" && gatewayToOrdersHandles.targetHandle === "left",
  `Gateway -> Orders connects right to left (got ${gatewayToOrdersHandles.sourceHandle} -> ${gatewayToOrdersHandles.targetHandle})`
);

// 4. Orders to DB (Horizontal right)
const ordersDbNode: CanvasNode = normalizeCanvasNode({
  id: "orders_db",
  type: "canvasNode",
  position: { x: 940, y: 200 },
  data: { label: "Orders DB", shape: "cylinder", color: { fill: "#0F2E18", text: "#62C073" } },
} as unknown as CanvasNode);

const ordersToDbHandles = calculateEdgeHandles(ordersNode, ordersDbNode);
assert(
  ordersToDbHandles.sourceHandle === "right" && ordersToDbHandles.targetHandle === "left",
  `Orders -> DB connects right to left (got ${ordersToDbHandles.sourceHandle} -> ${ordersToDbHandles.targetHandle})`
);

// 5. Edge Normalization
const rawEdge: CanvasEdge = {
  id: "e1",
  source: "client",
  target: "gateway",
  type: "canvasEdge",
} as CanvasEdge;

const normalizedEdge = normalizeCanvasEdge(rawEdge, [clientNode, gatewayNode]);
assert(
  normalizedEdge.sourceHandle === "right" && normalizedEdge.targetHandle === "left",
  `normalizeCanvasEdge resolves sourceHandle and targetHandle (got ${normalizedEdge.sourceHandle} -> ${normalizedEdge.targetHandle})`
);

// 6. User Explicit Handle Preservation
const userEdge: CanvasEdge = {
  id: "e2",
  source: "client",
  target: "gateway",
  sourceHandle: "top",
  targetHandle: "bottom",
  type: "canvasEdge",
} as CanvasEdge;

const preservedEdge = normalizeCanvasEdge(userEdge, [clientNode, gatewayNode]);
assert(
  preservedEdge.sourceHandle === "top" && preservedEdge.targetHandle === "bottom",
  `normalizeCanvasEdge preserves user explicit handles (got ${preservedEdge.sourceHandle} -> ${preservedEdge.targetHandle})`
);

// 7. Missing-node fallback
const missingNodeEdge = normalizeCanvasEdge(rawEdge, []);
assert(
  missingNodeEdge.sourceHandle === "right" && missingNodeEdge.targetHandle === "left",
  `normalizeCanvasEdge falls back to right -> left when nodes are missing (got ${missingNodeEdge.sourceHandle} -> ${missingNodeEdge.targetHandle})`
);

console.log("🎉 All handle calculation tests passed!");
