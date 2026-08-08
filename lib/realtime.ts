import { createClient } from "@/lib/supabase/client";
import { NODE_COLORS } from "@/types/canvas";
import type { PresenceState, UserMeta } from "@/types/realtime";

export function getUserCursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % NODE_COLORS.length;
  return NODE_COLORS[index].fill;
}

export function createRealtimeChannel(projectId: string) {
  const supabase = createClient();
  return supabase.channel(`project:${projectId}`, {
    config: {
      presence: { key: projectId },
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

export type { PresenceState, UserMeta };
