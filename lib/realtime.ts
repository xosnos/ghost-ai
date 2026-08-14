import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { NODE_COLORS } from "@/types/canvas";
import type { PresencePayload, PresenceState, UserMeta } from "@/types/realtime";

export function getUserCursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % NODE_COLORS.length;
  return NODE_COLORS[index].text;
}

export function createRealtimeChannel(projectId: string, userId: string) {
  const supabase = createClient();
  return supabase.channel(`project:${projectId}`, {
    config: {
      presence: { key: userId },
      broadcast: { self: false },
    },
  });
}

export function buildUserMeta(user: {
  id: string;
  email?: string;
  user_metadata?: { avatar_url?: string; display_name?: string } | null;
}): UserMeta {
  return {
    userId: user.id,
    displayName:
      user.user_metadata?.display_name ??
      user.email?.split("@")[0] ??
      "Anonymous",
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

export type { PresencePayload, PresenceState, UserMeta };
