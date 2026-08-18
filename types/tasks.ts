import { z } from "zod";
import type { NodeShape } from "./canvas";

export const aiChatMessageSenderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.string().nullable().optional(),
});

export type AiChatMessageSender = z.infer<typeof aiChatMessageSenderSchema>;

export const aiChatMessageSchema = z.object({
  id: z.string().min(1),
  sender: z.union([z.string().min(1), aiChatMessageSenderSchema]),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  timestamp: z.string().min(1),
  runId: z.string().optional(),
});

export type AiChatMessage = z.infer<typeof aiChatMessageSchema>;

export function isAiChatMessage(data: unknown): data is AiChatMessage {
  return parseAiChatMessage(data) !== null;
}

export function parseAiChatMessage(data: unknown): AiChatMessage | null {
  const result = aiChatMessageSchema.safeParse(data);
  if (!result.success) {
    return null;
  }
  return result.data;
}

export function getSenderDisplayName(sender: AiChatMessage["sender"]): string {
  if (typeof sender === "string") return sender;
  return sender.name;
}

export type AiTaskStatus = "queued" | "running" | "retrying" | "completed" | "failed";

const ACTIVE_TASK_STATUSES: readonly AiTaskStatus[] = ["queued", "running", "retrying"];

export function computeIsAiActive(params: {
  overrideActive: boolean | null;
  activeTaskRun: { status: AiTaskStatus } | null;
  latestStatus: { status: AiTaskStatus; step: string } | null;
}): boolean {
  if (params.overrideActive !== null) {
    return params.overrideActive;
  }
  if (params.activeTaskRun !== null) {
    return true;
  }
  return Boolean(
    params.latestStatus &&
      ACTIVE_TASK_STATUSES.includes(params.latestStatus.status) &&
      params.latestStatus.step !== "complete" &&
      params.latestStatus.step !== "failed",
  );
}

export type AiStatusStep =
  | "start"
  | "analyzing"
  | "generating"
  | "updating_canvas"
  | "complete"
  | "failed";

export interface AiStatusMessage {
  runId: string;
  projectId: string;
  kind: "design" | "spec";
  status: AiTaskStatus;
  step: AiStatusStep;
  message: string;
  text?: string;
  progress?: number;
  timestamp: string;
}

export const AI_TASK_STATUSES: readonly AiTaskStatus[] = [
  "queued",
  "running",
  "retrying",
  "completed",
  "failed",
] as const;

export const AI_STATUS_STEPS: readonly AiStatusStep[] = [
  "start",
  "analyzing",
  "generating",
  "updating_canvas",
  "complete",
  "failed",
] as const;

export function isAiStatusMessage(data: unknown): data is AiStatusMessage {
  return parseAiStatusMessage(data) !== null;
}

export function parseAiStatusMessage(data: unknown): AiStatusMessage | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;

  if (
    typeof record.runId !== "string" ||
    !record.runId.trim() ||
    typeof record.projectId !== "string" ||
    !record.projectId.trim() ||
    (record.kind !== "design" && record.kind !== "spec") ||
    typeof record.status !== "string" ||
    !AI_TASK_STATUSES.includes(record.status as AiTaskStatus) ||
    typeof record.step !== "string" ||
    !AI_STATUS_STEPS.includes(record.step as AiStatusStep) ||
    typeof record.message !== "string"
  ) {
    return null;
  }

  const text = typeof record.text === "string" ? record.text : undefined;
  const progress =
    typeof record.progress === "number" && !Number.isNaN(record.progress)
      ? record.progress
      : undefined;
  const timestamp =
    typeof record.timestamp === "string" && record.timestamp.trim()
      ? record.timestamp
      : new Date().toISOString();

  return {
    runId: record.runId,
    projectId: record.projectId,
    kind: record.kind,
    status: record.status as AiTaskStatus,
    step: record.step as AiStatusStep,
    message: record.message,
    text,
    progress,
    timestamp,
  };
}

export type DesignAction =
  | {
      type: "add_node";
      tempId: string;
      label: string;
      shape: NodeShape;
      color: string;
      position: { x: number; y: number };
      width?: number;
      height?: number;
    }
  | {
      type: "move_node";
      nodeId: string;
      position: { x: number; y: number };
    }
  | {
      type: "resize_node";
      nodeId: string;
      width: number;
      height: number;
    }
  | {
      type: "update_node";
      nodeId: string;
      label?: string;
      shape?: NodeShape;
      color?: string;
    }
  | {
      type: "delete_node";
      nodeId: string;
    }
  | {
      type: "add_edge";
      source: string;
      target: string;
      label?: string;
    }
  | {
      type: "delete_edge";
      edgeId: string;
    };

export interface DesignPlanResult {
  summary: string;
  actions: DesignAction[];
}
