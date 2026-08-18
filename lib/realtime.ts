import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { NODE_COLORS } from "@/types/canvas";
import type {
  CursorMovePayload,
  PresencePayload,
  PresenceState,
  SelectionChangePayload,
  UserMeta,
} from "@/types/realtime";
import {
  type AiChatMessage,
  type AiChatMessageSender,
  type AiStatusMessage,
  parseAiChatMessage,
  parseAiStatusMessage,
} from "@/types/tasks";

export function getUserCursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % NODE_COLORS.length;
  return NODE_COLORS[index].text;
}

export async function connectRealtimeChannel(
  projectId: string,
  userId: string,
): Promise<{ supabase: SupabaseClient; channel: RealtimeChannel }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    await supabase.realtime.setAuth(session.access_token);
  }

  // Remove existing channel on singleton client to guarantee fresh subscription lifecycle
  const existing = supabase
    .getChannels()
    .find((c) => c.topic === `realtime:project:${projectId}` || c.topic === `project:${projectId}`);
  if (existing) {
    await supabase.removeChannel(existing);
  }

  const channel = supabase.channel(`project:${projectId}`, {
    config: {
      private: true,
      presence: { key: userId, enabled: true },
      broadcast: { self: false, ack: false },
    },
  });

  return { supabase, channel };
}

export function buildUserMeta(user: {
  id: string;
  email?: string;
  user_metadata?: { avatar_url?: string; display_name?: string } | null;
}): UserMeta {
  return {
    userId: user.id,
    displayName: user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Anonymous",
    avatarUrl: user.user_metadata?.avatar_url ?? null,
    cursorColor: getUserCursorColor(user.id),
  };
}

export function parsePresencePayload(value: unknown): PresencePayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.userId !== "string" || typeof record.displayName !== "string") {
    return null;
  }

  const cursor = record.cursor;
  let parsedCursor: PresenceState["cursor"] = null;
  if (
    cursor !== null &&
    typeof cursor === "object" &&
    typeof (cursor as { x?: unknown }).x === "number" &&
    typeof (cursor as { y?: unknown }).y === "number"
  ) {
    parsedCursor = {
      x: (cursor as { x: number }).x,
      y: (cursor as { y: number }).y,
    };
  }

  return {
    userId: record.userId,
    displayName: record.displayName,
    avatarUrl: typeof record.avatarUrl === "string" ? record.avatarUrl : null,
    cursorColor:
      typeof record.cursorColor === "string"
        ? record.cursorColor
        : getUserCursorColor(record.userId),
    thinking: record.thinking === true,
    cursor: parsedCursor,
  };
}

export function readPresenceEntries(channel: RealtimeChannel): PresencePayload[] {
  const flattened = Object.values(channel.presenceState()).flat();
  const parsed: PresencePayload[] = [];
  for (const entry of flattened) {
    const payload = parsePresencePayload(entry);
    if (payload) parsed.push(payload);
  }
  return parsed;
}

export function attachPresenceListeners(
  channel: RealtimeChannel,
  onChange: (entries: PresencePayload[]) => void,
) {
  const emit = () => onChange(readPresenceEntries(channel));
  channel.on("presence", { event: "sync" }, emit);
  channel.on("presence", { event: "join" }, emit);
  channel.on("presence", { event: "leave" }, emit);
}

export function attachCanvasSyncListener(
  channel: RealtimeChannel,
  onEvent: (payload: unknown) => void,
) {
  channel.on("broadcast", { event: "canvas:sync" }, (message: { payload?: unknown }) => {
    onEvent(message?.payload);
  });
}

export function parseCursorMovePayload(value: unknown): CursorMovePayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.userId !== "string") return null;

  const cursor = record.cursor;
  if (cursor === null) {
    return { userId: record.userId, cursor: null };
  }
  if (
    typeof cursor === "object" &&
    typeof (cursor as { x?: unknown }).x === "number" &&
    typeof (cursor as { y?: unknown }).y === "number"
  ) {
    return {
      userId: record.userId,
      cursor: {
        x: (cursor as { x: number }).x,
        y: (cursor as { y: number }).y,
      },
    };
  }
  return null;
}

export function attachCursorMoveListener(
  channel: RealtimeChannel,
  onEvent: (payload: CursorMovePayload) => void,
) {
  channel.on("broadcast", { event: "cursor:move" }, (message: { payload?: unknown }) => {
    const parsed = parseCursorMovePayload(message?.payload);
    if (parsed && readPresenceEntries(channel).some((entry) => entry.userId === parsed.userId)) {
      onEvent(parsed);
    }
  });
}

export function parseSelectionChangePayload(value: unknown): SelectionChangePayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.userId !== "string" || !Array.isArray(record.nodeIds)) {
    return null;
  }
  const nodeIds = record.nodeIds.filter((id): id is string => typeof id === "string");
  return { userId: record.userId, nodeIds };
}

export function attachSelectionChangeListener(
  channel: RealtimeChannel,
  onEvent: (payload: SelectionChangePayload) => void,
) {
  channel.on("broadcast", { event: "selection:change" }, (message: { payload?: unknown }) => {
    const parsed = parseSelectionChangePayload(message?.payload);
    if (parsed && readPresenceEntries(channel).some((entry) => entry.userId === parsed.userId)) {
      onEvent(parsed);
    }
  });
}

export function attachAiStatusListener(
  channel: RealtimeChannel,
  onEvent: (payload: AiStatusMessage) => void,
) {
  channel.on("broadcast", { event: "ai-status" }, (message: { payload?: unknown }) => {
    const parsed = parseAiStatusMessage(message?.payload);
    if (parsed) {
      onEvent(parsed);
    }
  });
}

export function attachAiChatListener(
  channel: RealtimeChannel,
  onEvent: (payload: AiChatMessage) => void,
) {
  channel.on("broadcast", { event: "ai-chat" }, (message: { payload?: unknown }) => {
    const parsed = parseAiChatMessage(message?.payload);
    if (parsed) {
      onEvent(parsed);
    }
  });
}

export type {
  AiChatMessage,
  AiChatMessageSender,
  AiStatusMessage,
  CursorMovePayload,
  PresencePayload,
  PresenceState,
  SelectionChangePayload,
  UserMeta,
};
