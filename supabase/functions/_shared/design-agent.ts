import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// Allowed shapes and default dimensions
export const NODE_SHAPES = [
  "rectangle",
  "diamond",
  "circle",
  "pill",
  "cylinder",
  "hexagon",
] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];

export const SHAPE_DEFAULT_SIZES: Record<NodeShape, { width: number; height: number }> = {
  rectangle: { width: 176, height: 64 },
  diamond: { width: 200, height: 160 },
  circle: { width: 120, height: 120 },
  pill: { width: 160, height: 56 },
  cylinder: { width: 140, height: 100 },
  hexagon: { width: 160, height: 120 },
};

export interface NodeColor {
  fill: string;
  text: string;
  lightFill?: string;
  lightText?: string;
  lightBorder?: string;
  name: string;
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

export function resolveColor(colorName?: string): NodeColor {
  if (!colorName) return NODE_COLORS[0];
  const found = NODE_COLORS.find(
    (c) => c.name.toLowerCase() === colorName.toLowerCase()
  );
  return found || NODE_COLORS[0];
}

export interface CanvasNodeData {
  label: string;
  color: NodeColor;
  shape: NodeShape;
  [key: string]: unknown;
}

export interface CanvasNode {
  id: string;
  type: "canvasNode";
  position: { x: number; y: number };
  width?: number;
  height?: number;
  initialWidth?: number;
  initialHeight?: number;
  style?: { width: number; height: number };
  data: CanvasNodeData;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: "canvasEdge";
  markerEnd?: {
    type: string;
    width: number;
    height: number;
  };
  data?: {
    label?: string;
    [key: string]: unknown;
  };
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export function calculateEdgeHandles(
  sourceNode: CanvasNode,
  targetNode: CanvasNode
): { sourceHandle: "top" | "right" | "bottom" | "left"; targetHandle: "top" | "right" | "bottom" | "left" } {
  const sShape = sourceNode.data?.shape || "rectangle";
  const sDef = SHAPE_DEFAULT_SIZES[sShape] || { width: 176, height: 64 };
  const sW = sourceNode.width ?? sourceNode.initialWidth ?? (sourceNode.style?.width as number) ?? sDef.width;
  const sH = sourceNode.height ?? sourceNode.initialHeight ?? (sourceNode.style?.height as number) ?? sDef.height;

  const tShape = targetNode.data?.shape || "rectangle";
  const tDef = SHAPE_DEFAULT_SIZES[tShape] || { width: 176, height: 64 };
  const tW = targetNode.width ?? targetNode.initialWidth ?? (targetNode.style?.width as number) ?? tDef.width;
  const tH = targetNode.height ?? targetNode.initialHeight ?? (targetNode.style?.height as number) ?? tDef.height;

  const sCenterX = sourceNode.position.x + sW / 2;
  const sCenterY = sourceNode.position.y + sH / 2;
  const tCenterX = targetNode.position.x + tW / 2;
  const tCenterY = targetNode.position.y + tH / 2;

  const dx = tCenterX - sCenterX;
  const dy = tCenterY - sCenterY;

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

export const CANVAS_BUCKET = "canvas";
const AI_AGENT_USER_ID = "ghost-ai-agent";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL_ID = "openrouter/free";

// Error classes
export class TransientAiError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "TransientAiError";
  }
}

export class PermanentAiError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "PermanentAiError";
  }
}

export function classifyError(err: unknown): Error {
  if (err instanceof TransientAiError || err instanceof PermanentAiError) {
    return err;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;

  if (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("timeout") ||
    msg.includes("AbortError") ||
    msg.includes("fetch failed") ||
    msg.includes("ECONNRESET")
  ) {
    return new TransientAiError(msg, err);
  }

  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("OPENROUTER_API_KEY") ||
    msg.includes("Unauthorized")
  ) {
    return new PermanentAiError(msg, err);
  }

  return new TransientAiError(msg, err);
}

// Zod schemas for AI structured outputs
const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_node"),
    tempId: z.string().describe("Unique identifier for this node within this plan"),
    label: z.string().describe("Component name / service title (e.g. 'API Gateway', 'PostgreSQL DB')"),
    shape: z.enum(["rectangle", "diamond", "circle", "pill", "cylinder", "hexagon"]).describe("Visual node shape"),
    color: z.enum(["neutral", "blue", "purple", "orange", "red", "pink", "green", "teal"]).describe("Color role"),
    position: z.object({
      x: z.number().describe("X coordinate in canvas flow grid (e.g. 100, 380, 660, 940)"),
      y: z.number().describe("Y coordinate in canvas flow grid (e.g. 100, 240, 380)"),
    }),
    width: z.number().optional().describe("Optional explicit width"),
    height: z.number().optional().describe("Optional explicit height"),
  }),
  z.object({
    type: z.literal("move_node"),
    nodeId: z.string().describe("ID of existing node to move"),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
  }),
  z.object({
    type: z.literal("resize_node"),
    nodeId: z.string().describe("ID of existing node to resize"),
    width: z.number(),
    height: z.number(),
  }),
  z.object({
    type: z.literal("update_node"),
    nodeId: z.string().describe("ID of existing node to update"),
    label: z.string().optional(),
    shape: z.enum(["rectangle", "diamond", "circle", "pill", "cylinder", "hexagon"]).optional(),
    color: z.enum(["neutral", "blue", "purple", "orange", "red", "pink", "green", "teal"]).optional(),
  }),
  z.object({
    type: z.literal("delete_node"),
    nodeId: z.string().describe("ID of node to delete"),
  }),
  z.object({
    type: z.literal("add_edge"),
    source: z.string().describe("Source node ID or tempId"),
    target: z.string().describe("Target node ID or tempId"),
    label: z.string().optional().describe("Connection protocol / description (e.g. 'HTTPS / JSON', 'gRPC', 'SQL query', 'pub/sub')"),
  }),
  z.object({
    type: z.literal("delete_edge"),
    edgeId: z.string().describe("ID of edge to delete"),
  }),
]);

const designPlanSchema = z.object({
  summary: z.string().describe("Concise 1-2 sentence description of the generated or updated system architecture"),
  actions: z.array(actionSchema).describe("Ordered list of canvas operations to construct or modify the architecture"),
});

export type DesignPlan = z.infer<typeof designPlanSchema>;

export interface DesignTaskContext {
  runId: string;
  projectId: string;
  userId: string;
  input: {
    prompt?: string;
    roomId?: string;
    [key: string]: unknown;
  };
  signal: AbortSignal;
}

function deriveStableNodeId(runId: string, tempId: string, index: number): string {
  const shortRunId = runId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const cleanKey = (tempId || `node_${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "") || `n_${index}`;
  return `node_${shortRunId}_${cleanKey}`;
}

function deriveStableEdgeId(runId: string, sourceId: string, targetId: string, index: number): string {
  const shortRunId = runId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const cleanSource = sourceId.replace(/[^a-zA-Z0-9]/g, "_");
  const cleanTarget = targetId.replace(/[^a-zA-Z0-9]/g, "_");
  return `edge_${shortRunId}_${cleanSource}_${cleanTarget}_${index}`;
}

async function sendAiStatus(
  channel: RealtimeChannel | null,
  statusPayload: {
    runId: string;
    projectId: string;
    status: "queued" | "running" | "retrying" | "completed" | "failed";
    step: "start" | "analyzing" | "generating" | "updating_canvas" | "complete" | "failed";
    message: string;
    text?: string;
  }
): Promise<void> {
  if (!channel) return;
  try {
    await channel.send({
      type: "broadcast",
      event: "ai-status",
      payload: {
        ...statusPayload,
        kind: "design",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn("[design-agent] Failed to broadcast ai-status:", err);
  }
}

async function sendAiCursor(
  channel: RealtimeChannel | null,
  cursor: { x: number; y: number } | null
): Promise<void> {
  if (!channel) return;
  try {
    await channel.send({
      type: "broadcast",
      event: "cursor:move",
      payload: {
        userId: AI_AGENT_USER_ID,
        cursor,
      },
    });
  } catch (err) {
    console.warn("[design-agent] Failed to broadcast cursor:move:", err);
  }
}

async function sendCanvasSync(
  channel: RealtimeChannel | null,
  payload: unknown
): Promise<void> {
  if (!channel) return;
  try {
    await channel.send({
      type: "broadcast",
      event: "canvas:sync",
      payload,
    });
  } catch (err) {
    console.warn("[design-agent] Failed to broadcast canvas:sync:", err);
  }
}

export async function fetchCurrentCanvas(
  supabaseAdmin: SupabaseClient,
  projectId: string
): Promise<{ canvas: CanvasData; projectName: string; storagePath: string }> {
  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, name, canvas_storage_path")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    throw new TransientAiError(`Failed to fetch project metadata: ${projectError.message}`);
  }

  if (!project) {
    throw new PermanentAiError(`Project ${projectId} not found`);
  }

  const projectName = project.name || "Untitled Architecture";
  const storagePath = project.canvas_storage_path || `${CANVAS_BUCKET}/${projectId}.json`;

  // Download snapshot if exists
  let existingCanvas: CanvasData = { nodes: [], edges: [] };
  if (project.canvas_storage_path) {
    try {
      const downloadPath = project.canvas_storage_path.startsWith(`${CANVAS_BUCKET}/`)
        ? project.canvas_storage_path.slice(CANVAS_BUCKET.length + 1)
        : project.canvas_storage_path;

      const { data, error } = await supabaseAdmin.storage
        .from(CANVAS_BUCKET)
        .download(downloadPath);

      if (!error && data) {
        const text = await data.text();
        const parsed = JSON.parse(text);
        existingCanvas = {
          nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
          edges: Array.isArray(parsed.edges) ? parsed.edges : [],
        };
      }
    } catch (err) {
      console.warn("[design-agent] Could not download existing canvas snapshot, starting empty:", err);
    }
  }

  return { canvas: existingCanvas, projectName, storagePath };
}

export async function saveCanvasSnapshot(
  supabaseAdmin: SupabaseClient,
  projectId: string,
  canvas: CanvasData
): Promise<string> {
  const filePath = `${projectId}.json`;
  const storagePath = `${CANVAS_BUCKET}/${projectId}.json`;
  const jsonContent = JSON.stringify(canvas);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(CANVAS_BUCKET)
    .upload(filePath, jsonContent, {
      contentType: "application/json",
      upsert: true,
    });

  if (uploadError) {
    throw new TransientAiError(`Failed to save canvas snapshot to storage: ${uploadError.message}`);
  }

  const { error: dbError } = await supabaseAdmin
    .from("projects")
    .update({
      canvas_storage_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (dbError) {
    throw new TransientAiError(`Failed to update project canvas path in database: ${dbError.message}`);
  }

  return storagePath;
}

function cleanActionLabel(raw: string): string {
  let label = raw.replace(/^[-*•\d.]+\s*/, "").trim();
  label = label
    .replace(
      /^(implement|build|create|deploy|set\s+up|design|add|develop)\s+(an?\s+|the\s+)?/i,
      ""
    )
    .trim();
  if (label.includes(" - ")) {
    label = label.split(" - ")[0].trim();
  } else if (label.includes(": ")) {
    label = label.split(": ")[0].trim();
  } else if (label.includes(" (e.g.")) {
    label = label.split(" (e.g.")[0].trim();
  } else if (label.includes(" (such as")) {
    label = label.split(" (such as")[0].trim();
  } else if (label.includes(" for ")) {
    label = label.split(" for ")[0].trim();
  } else if (label.includes(" to ")) {
    label = label.split(" to ")[0].trim();
  }
  if (label.length > 28) {
    label = label.slice(0, 28).trim();
  }
  if (!label) return "Service";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function parseAndNormalizePlan(rawText: string): DesignPlan {
  let text = rawText.trim();
  // Strip <think>...</think> reasoning blocks if generated by reasoning models
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  if (text.includes("```")) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      text = match[1].trim();
    }
  }

  const startIdx = text.indexOf("{");
  const endIdx = text.lastIndexOf("}");
  if (startIdx !== -1 && endIdx > startIdx) {
    text = text.slice(startIdx, endIdx + 1);
  }

  const parsed = JSON.parse(text);
  const summary =
    typeof parsed.summary === "string"
      ? parsed.summary
      : "Generated system architecture diagram.";
  let rawActions: unknown[] = [];

  if (Array.isArray(parsed.actions)) {
    rawActions = parsed.actions;
  } else if (Array.isArray(parsed.nodes) || Array.isArray(parsed.services)) {
    rawActions = Array.isArray(parsed.nodes) ? parsed.nodes : parsed.services;
  }

  const validatedActions: z.infer<typeof actionSchema>[] = [];
  const stringConvertedNodeTempIds: string[] = [];

  let idx = 0;
  for (const raw of rawActions) {
    idx++;
    if (typeof raw === "string") {
      const line = raw.trim();
      if (!line) continue;
      const label = cleanActionLabel(line);
      const lower = line.toLowerCase();

      let shape: NodeShape = "rectangle";
      let color: "neutral" | "blue" | "purple" | "orange" | "red" | "pink" | "green" | "teal" = "purple";

      if (
        lower.includes("gateway") ||
        lower.includes("router") ||
        lower.includes("proxy") ||
        lower.includes("load balancer")
      ) {
        shape = "diamond";
        color = "blue";
      } else if (
        lower.includes("client") ||
        lower.includes("user") ||
        lower.includes("browser") ||
        lower.includes("frontend") ||
        lower.includes("mobile")
      ) {
        shape = "circle";
        color = "neutral";
      } else if (
        lower.includes("db") ||
        lower.includes("database") ||
        lower.includes("postgres") ||
        lower.includes("mongo") ||
        lower.includes("sql") ||
        lower.includes("storage")
      ) {
        shape = "cylinder";
        color = "green";
      } else if (
        lower.includes("cache") ||
        lower.includes("redis") ||
        lower.includes("queue") ||
        lower.includes("kafka") ||
        lower.includes("rabbitmq")
      ) {
        shape = "cylinder";
        color = "teal";
      } else if (
        lower.includes("auth") ||
        lower.includes("payment") ||
        lower.includes("stripe") ||
        lower.includes("security")
      ) {
        shape = "hexagon";
        color = "orange";
      } else {
        shape = "pill";
        color = "purple";
      }

      const tempId = `comp_${idx}`;
      stringConvertedNodeTempIds.push(tempId);
      const col = (idx - 1) % 4;
      const row = Math.floor((idx - 1) / 4);

      validatedActions.push({
        type: "add_node",
        tempId,
        label,
        shape,
        color,
        position: {
          x: 100 + col * 280,
          y: 100 + row * 160,
        },
      });
    } else if (raw && typeof raw === "object") {
      const act = raw as Record<string, unknown>;
      const type = String(act.type || "");

      if (type === "add_node" && act.label) {
        const shapeStr = String(act.shape || "rectangle");
        const shape = NODE_SHAPES.includes(shapeStr as NodeShape)
          ? (shapeStr as NodeShape)
          : "rectangle";
        const colorStr = String(act.color || "blue");
        const color = NODE_COLORS.some((c) => c.name === colorStr)
          ? (colorStr as "neutral" | "blue" | "purple" | "orange" | "red" | "pink" | "green" | "teal")
          : "blue";

        const pos = (act.position && typeof act.position === "object"
          ? act.position
          : {}) as Record<string, unknown>;

        validatedActions.push({
          type: "add_node",
          tempId: String(act.tempId || act.label)
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "_")
            .replace(/^_+|_+$/g, "") || `node_${idx}`,
          label: String(act.label),
          shape,
          color,
          position: {
            x: typeof pos.x === "number" ? pos.x : 100 + ((idx - 1) % 4) * 280,
            y: typeof pos.y === "number" ? pos.y : 100 + Math.floor((idx - 1) / 4) * 140,
          },
          width: typeof act.width === "number" ? act.width : undefined,
          height: typeof act.height === "number" ? act.height : undefined,
        });
      } else if (type === "add_edge" && act.source && act.target) {
        validatedActions.push({
          type: "add_edge",
          source: String(act.source),
          target: String(act.target),
          label: typeof act.label === "string" ? act.label : undefined,
        });
      } else if (type === "move_node" && act.nodeId) {
        const pos = (act.position && typeof act.position === "object"
          ? act.position
          : {}) as Record<string, unknown>;
        validatedActions.push({
          type: "move_node",
          nodeId: String(act.nodeId),
          position: {
            x: Number(pos.x) || 0,
            y: Number(pos.y) || 0,
          },
        });
      } else if (type === "resize_node" && act.nodeId) {
        validatedActions.push({
          type: "resize_node",
          nodeId: String(act.nodeId),
          width: Number(act.width) || 176,
          height: Number(act.height) || 64,
        });
      } else if (type === "update_node" && act.nodeId) {
        const shapeStr = act.shape ? String(act.shape) : undefined;
        const shape = shapeStr && NODE_SHAPES.includes(shapeStr as NodeShape)
          ? (shapeStr as NodeShape)
          : undefined;
        const colorStr = act.color ? String(act.color) : undefined;
        const color = colorStr && NODE_COLORS.some((c) => c.name === colorStr)
          ? (colorStr as "neutral" | "blue" | "purple" | "orange" | "red" | "pink" | "green" | "teal")
          : undefined;

        validatedActions.push({
          type: "update_node",
          nodeId: String(act.nodeId),
          label: act.label ? String(act.label) : undefined,
          shape,
          color,
        });
      } else if (type === "delete_node" && act.nodeId) {
        validatedActions.push({
          type: "delete_node",
          nodeId: String(act.nodeId),
        });
      } else if (type === "delete_edge" && act.edgeId) {
        validatedActions.push({
          type: "delete_edge",
          edgeId: String(act.edgeId),
        });
      }
    }
  }

  // Auto-connect string-converted nodes sequentially if no edges were generated
  if (
    stringConvertedNodeTempIds.length > 1 &&
    !validatedActions.some((a) => a.type === "add_edge")
  ) {
    for (let i = 0; i < stringConvertedNodeTempIds.length - 1; i++) {
      validatedActions.push({
        type: "add_edge",
        source: stringConvertedNodeTempIds[i],
        target: stringConvertedNodeTempIds[i + 1],
        label: "",
      });
    }
  }

  return {
    summary,
    actions: validatedActions,
  };
}

function getOpenRouterApiKey(): string | null {
  const envVal = Deno.env.get("OPENROUTER_API_KEY");
  if (envVal && envVal.trim()) return envVal.trim();

  // Fallback: read from mounted local .env files
  const possiblePaths = [
    "./supabase/functions/.env",
    "./supabase/functions/ai-worker/.env",
    "./supabase/functions/_shared/.env",
    "./supabase/.env",
    "./.env",
    "./.env.local",
    "/Users/xosnos/Projects/Web/ghost-ai/supabase/functions/.env",
    "/Users/xosnos/Projects/Web/ghost-ai/supabase/functions/ai-worker/.env",
    "/Users/xosnos/Projects/Web/ghost-ai/supabase/functions/_shared/.env",
    "/Users/xosnos/Projects/Web/ghost-ai/supabase/.env",
    "/Users/xosnos/Projects/Web/ghost-ai/.env",
    "/Users/xosnos/Projects/Web/ghost-ai/.env.local",
  ];

  for (const p of possiblePaths) {
    try {
      const content = Deno.readTextFileSync(p);
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("OPENROUTER_API_KEY=")) {
          const val = trimmed
            .slice("OPENROUTER_API_KEY=".length)
            .replace(/^["']|["']$/g, "")
            .trim();
          if (val) return val;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export async function generateDesignPlanWithOpenRouter(
  prompt: string,
  projectName: string,
  currentCanvas: CanvasData,
  signal: AbortSignal
): Promise<DesignPlan> {
  const openRouterApiKey = getOpenRouterApiKey();
  if (!openRouterApiKey) {
    throw new PermanentAiError(
      "OPENROUTER_API_KEY environment variable is not configured for Edge Functions"
    );
  }

  const systemPrompt = `You are Ghost AI, an expert system architect and visual technical diagram designer.
Given a user prompt and existing canvas state, return ONLY a JSON object with this EXACT structure:
{
  "summary": "Brief 1-sentence description of the system architecture",
  "actions": [
    { "type": "add_node", "tempId": "client", "label": "Web Client", "shape": "circle", "color": "neutral", "position": { "x": 100, "y": 200 } },
    { "type": "add_node", "tempId": "gateway", "label": "API Gateway", "shape": "diamond", "color": "blue", "position": { "x": 380, "y": 200 } },
    { "type": "add_node", "tempId": "orders_svc", "label": "Orders Service", "shape": "pill", "color": "purple", "position": { "x": 660, "y": 200 } },
    { "type": "add_node", "tempId": "orders_db", "label": "Orders DB", "shape": "cylinder", "color": "green", "position": { "x": 940, "y": 200 } },
    { "type": "add_edge", "source": "client", "target": "gateway", "label": "HTTPS" },
    { "type": "add_edge", "source": "gateway", "target": "orders_svc", "label": "gRPC" },
    { "type": "add_edge", "source": "orders_svc", "target": "orders_db", "label": "SQL" }
  ]
}

Strict Rules:
1. Allowed Shapes: rectangle, diamond, circle, pill, cylinder, hexagon
   - rectangle: Compute servers, Load Balancers, general services
   - diamond: Decision gateways, API Routers, Proxies
   - circle: Clients, Users, External Webhooks, IoT devices
   - pill: Microservices, Workers, Processors
   - cylinder: Databases, Caches, Persistent Storage
   - hexagon: 3rd-party External APIs, Auth providers, Security boundaries

2. Allowed Colors: neutral, blue, purple, orange, red, pink, green, teal
   - neutral: Clients, Endpoints
   - blue: Frontend / API Gateway
   - purple: Core Microservices
   - teal: Queues, Caches
   - green: Databases, Storage
   - orange: Auth, Payments, Security
   - red: Dead Letter Queues, Error handling
   - pink: Metrics, Telemetry

3. Layout & Coordinates:
   - Left-to-right columns at X: 100, 380, 660, 940, 1220.
   - Rows spaced by 140px on Y (e.g. 100, 240, 380).
   - Ensure nodes do not overlap.
   - Connect components logically with directional edges and descriptive protocol labels.

Return ONLY the raw JSON object. No markdown preamble, no explanations.`;

  const contextMessage = `Project Name: "${projectName}"
Existing Nodes Count: ${currentCanvas.nodes.length}
Existing Edges Count: ${currentCanvas.edges.length}
${
  currentCanvas.nodes.length > 0
    ? `Existing Nodes:\n${JSON.stringify(
        currentCanvas.nodes.map((n) => ({
          id: n.id,
          label: n.data?.label,
          shape: n.data?.shape,
          position: n.position,
        })),
        null,
        2
      )}`
    : "Canvas is currently empty."
}

User Prompt: "${prompt}"`;

  const modelsToTry = [
    "google/gemini-2.0-flash-exp:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "openrouter/free",
  ];

  let lastError: unknown = null;

  for (const modelId of modelsToTry) {
    if (signal.aborted) throw signal.reason;

    try {
      console.log(`[design-agent] Requesting OpenRouter generation with model ${modelId}...`);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ghost-ai.dev",
          "X-Title": "Ghost AI",
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: contextMessage },
          ],
          temperature: 0.2,
        }),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[design-agent] Model ${modelId} returned HTTP ${res.status}:`, errText);
        lastError = new Error(`OpenRouter ${modelId} returned ${res.status}: ${errText}`);
        continue;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawText = data?.choices?.[0]?.message?.content;
      if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
        console.warn(`[design-agent] Model ${modelId} returned empty content.`);
        lastError = new Error("OpenRouter returned empty content");
        continue;
      }

      const plan = parseAndNormalizePlan(rawText);
      if (plan.actions.length === 0) {
        console.warn(`[design-agent] Model ${modelId} returned no valid canvas actions. Raw text:`, rawText);
        lastError = new Error("No valid canvas actions were parsed");
        continue;
      }

      console.log(
        `[design-agent] Successfully generated design plan with ${plan.actions.length} actions using ${modelId}`
      );
      return plan;
    } catch (err: unknown) {
      if (signal.aborted) throw signal.reason;
      console.warn(`[design-agent] Error trying model ${modelId}:`, err);
      lastError = err;
    }
  }

  throw classifyError(
    lastError || new Error("All OpenRouter models failed to generate design plan")
  );
}

export function applyDesignPlan(
  plan: DesignPlan,
  currentCanvas: CanvasData,
  runId: string
): {
  updatedCanvas: CanvasData;
  newNodes: CanvasNode[];
  newEdges: CanvasEdge[];
  nodeChanges: unknown[];
  edgeChanges: unknown[];
} {
  const nodesMap = new Map<string, CanvasNode>();
  for (const n of currentCanvas.nodes) {
    nodesMap.set(n.id, { ...n, data: { ...n.data } });
  }

  const edgesMap = new Map<string, CanvasEdge>();
  for (const e of currentCanvas.edges) {
    edgesMap.set(e.id, { ...e, data: { ...(e.data || {}) } });
  }

  const tempToStableId = new Map<string, string>();
  const newNodes: CanvasNode[] = [];
  const newEdges: CanvasEdge[] = [];
  const nodeChanges: unknown[] = [];
  const edgeChanges: unknown[] = [];

  // Pass 1: Handle nodes
  let actionIdx = 0;
  for (const action of plan.actions) {
    actionIdx++;
    if (action.type === "add_node") {
      const stableId = deriveStableNodeId(runId, action.tempId, actionIdx);
      tempToStableId.set(action.tempId, stableId);
      tempToStableId.set(stableId, stableId);

      const shape: NodeShape = action.shape || "rectangle";
      const defaultSize = SHAPE_DEFAULT_SIZES[shape] || { width: 176, height: 64 };
      const width = action.width ?? defaultSize.width;
      const height = action.height ?? defaultSize.height;
      const color = resolveColor(action.color);

      const node: CanvasNode = {
        id: stableId,
        type: "canvasNode",
        position: { x: action.position.x, y: action.position.y },
        width,
        height,
        initialWidth: width,
        initialHeight: height,
        style: { width, height },
        data: {
          label: action.label,
          shape,
          color,
        },
      };

      nodesMap.set(stableId, node);
      newNodes.push(node);
      nodeChanges.push({ type: "add", item: node });
    } else if (action.type === "move_node") {
      const targetId = tempToStableId.get(action.nodeId) || action.nodeId;
      const existing = nodesMap.get(targetId);
      if (existing) {
        existing.position = { x: action.position.x, y: action.position.y };
        nodeChanges.push({
          type: "position",
          id: targetId,
          position: existing.position,
        });
      }
    } else if (action.type === "resize_node") {
      const targetId = tempToStableId.get(action.nodeId) || action.nodeId;
      const existing = nodesMap.get(targetId);
      if (existing) {
        existing.width = action.width;
        existing.height = action.height;
        existing.style = { width: action.width, height: action.height };
        nodeChanges.push({
          type: "dimensions",
          id: targetId,
          dimensions: { width: action.width, height: action.height },
        });
      }
    } else if (action.type === "update_node") {
      const targetId = tempToStableId.get(action.nodeId) || action.nodeId;
      const existing = nodesMap.get(targetId);
      if (existing) {
        if (action.label) existing.data.label = action.label;
        if (action.shape) existing.data.shape = action.shape;
        if (action.color) existing.data.color = resolveColor(action.color);
        nodeChanges.push({
          type: "replace",
          id: targetId,
          item: existing,
        });
      }
    } else if (action.type === "delete_node") {
      const targetId = tempToStableId.get(action.nodeId) || action.nodeId;
      nodesMap.delete(targetId);
      nodeChanges.push({ type: "remove", id: targetId });

      // Delete attached edges
      for (const [edgeId, edge] of edgesMap.entries()) {
        if (edge.source === targetId || edge.target === targetId) {
          edgesMap.delete(edgeId);
          edgeChanges.push({ type: "remove", id: edgeId });
        }
      }
    }
  }

  // Pass 2: Handle edges
  let edgeIdx = 0;
  for (const action of plan.actions) {
    if (action.type === "add_edge") {
      edgeIdx++;
      const sourceId = tempToStableId.get(action.source) || action.source;
      const targetId = tempToStableId.get(action.target) || action.target;

      if (sourceId && targetId && sourceId !== targetId) {
        const sourceNode = nodesMap.get(sourceId);
        const targetNode = nodesMap.get(targetId);

        let sourceHandle = "right";
        let targetHandle = "left";
        if (sourceNode && targetNode) {
          const handles = calculateEdgeHandles(sourceNode, targetNode);
          sourceHandle = handles.sourceHandle;
          targetHandle = handles.targetHandle;
        }

        const stableEdgeId = deriveStableEdgeId(runId, sourceId, targetId, edgeIdx);
        const edge: CanvasEdge = {
          id: stableEdgeId,
          source: sourceId,
          target: targetId,
          sourceHandle,
          targetHandle,
          type: "canvasEdge",
          markerEnd: {
            type: "arrowclosed",
            width: 16,
            height: 16,
          },
          data: {
            label: action.label || "",
          },
        };

        edgesMap.set(stableEdgeId, edge);
        newEdges.push(edge);
        edgeChanges.push({ type: "add", item: edge });
      }
    } else if (action.type === "delete_edge") {
      edgesMap.delete(action.edgeId);
      edgeChanges.push({ type: "remove", id: action.edgeId });
    }
  }

  const updatedCanvas: CanvasData = {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
  };

  return {
    updatedCanvas,
    newNodes,
    newEdges,
    nodeChanges,
    edgeChanges,
  };
}

export async function processDesignTask(
  supabaseAdmin: SupabaseClient,
  context: DesignTaskContext
): Promise<DesignPlan> {
  const { runId, projectId, input, signal } = context;
  const prompt = (input?.prompt || "").trim();

  if (!prompt) {
    throw new PermanentAiError("Prompt cannot be empty for design generation");
  }

  let channel: RealtimeChannel | null = null;

  try {
    // 1. Establish project realtime broadcast channel
    channel = supabaseAdmin.channel(`project:${projectId}`, {
      config: {
        private: true,
        broadcast: { self: false, ack: false },
      },
    });
    await channel.subscribe();

    // 2. Broadcast start step
    await sendAiStatus(channel, {
      runId,
      projectId,
      status: "running",
      step: "start",
      message: "Starting system design generation...",
    });

    // 3. Fetch project and existing canvas state from storage
    await sendAiStatus(channel, {
      runId,
      projectId,
      status: "running",
      step: "analyzing",
      message: "Analyzing architecture requirements and current diagram...",
    });

    const { canvas: currentCanvas, projectName } = await fetchCurrentCanvas(
      supabaseAdmin,
      projectId
    );

    if (signal.aborted) throw signal.reason;

    // 4. Generate structured architecture plan via OpenRouter
    await sendAiStatus(channel, {
      runId,
      projectId,
      status: "running",
      step: "generating",
      message: "Designing system components and topologies...",
    });

    const plan = await generateDesignPlanWithOpenRouter(
      prompt,
      projectName,
      currentCanvas,
      signal
    );

    if (signal.aborted) throw signal.reason;

    // 5. Apply mutations to canvas state deterministically
    await sendAiStatus(channel, {
      runId,
      projectId,
      status: "running",
      step: "updating_canvas",
      message: "Updating collaborative canvas...",
    });

    const { updatedCanvas, newNodes, newEdges, nodeChanges, edgeChanges } = applyDesignPlan(
      plan,
      currentCanvas,
      runId
    );

    // 6. Broadcast canvas mutations & animate AI cursor across created nodes
    for (const node of newNodes) {
      // Broadcast cursor moving to node position
      await sendAiCursor(channel, {
        x: node.position.x + (node.style?.width ?? 100) / 2,
        y: node.position.y + (node.style?.height ?? 50) / 2,
      });

      // Broadcast node addition
      await sendCanvasSync(channel, {
        type: "nodes:add",
        node,
      });
    }

    for (const edge of newEdges) {
      await sendCanvasSync(channel, {
        type: "edges:connect",
        edge,
      });
    }

    if (nodeChanges.length > 0 && newNodes.length === 0) {
      await sendCanvasSync(channel, {
        type: "nodes:change",
        changes: nodeChanges,
      });
    }

    if (edgeChanges.length > 0 && newEdges.length === 0) {
      await sendCanvasSync(channel, {
        type: "edges:change",
        changes: edgeChanges,
      });
    }

    // 7. Persist updated canvas snapshot to Supabase Storage
    await saveCanvasSnapshot(supabaseAdmin, projectId, updatedCanvas);

    // 8. Broadcast terminal complete status
    await sendAiStatus(channel, {
      runId,
      projectId,
      status: "completed",
      step: "complete",
      message: plan.summary || "System architecture generated successfully.",
      text: plan.summary,
    });

    return plan;
  } catch (err: unknown) {
    const classified = classifyError(err);
    const isPermanent = classified instanceof PermanentAiError;

    const sanitizedMsg =
      classified instanceof Error
        ? classified.message.slice(0, 500)
        : "An unexpected error occurred during design generation";

    if (channel) {
      await sendAiStatus(channel, {
        runId,
        projectId,
        status: isPermanent ? "failed" : "retrying",
        step: "failed",
        message: sanitizedMsg,
      });
    }

    throw classified;
  } finally {
    // Guaranteed presence and channel cleanup
    if (channel) {
      try {
        await sendAiCursor(channel, null);
      } catch {
        // Ignore
      }
      try {
        await supabaseAdmin.removeChannel(channel);
      } catch {
        // Ignore
      }
    }
  }
}
