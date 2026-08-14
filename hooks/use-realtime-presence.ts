"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { buildUserMeta, parsePresencePayload } from "@/lib/realtime";
import type { PresencePayload } from "@/types/realtime";

interface PresenceUser {
  id: string;
  email?: string;
  user_metadata?: { avatar_url?: string; display_name?: string } | null;
}

export interface UseRealtimePresenceReturn {
  others: PresencePayload[];
  currentUserId: string | null;
  updateCursor: (cursor: { x: number; y: number } | null) => void;
}

function dedupeByUserId(entries: PresencePayload[]): PresencePayload[] {
  const seen = new Map<string, PresencePayload>();
  for (const entry of entries) {
    seen.set(entry.userId, entry);
  }
  return Array.from(seen.values());
}

export function useRealtimePresence(
  channel: RealtimeChannel,
  user: PresenceUser,
): UseRealtimePresenceReturn {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [others, setOthers] = useState<PresencePayload[]>([]);
  const metaRef = useRef(buildUserMeta(user));
  const thinkingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const selfIdRef = useRef(user.id);

  metaRef.current = buildUserMeta(user);
  selfIdRef.current = currentUserId ?? user.id;

  const syncOthers = useCallback(() => {
    const flattened = Object.values(channel.presenceState()).flat();
    const parsed = flattened.flatMap((entry) => {
      const payload = parsePresencePayload(entry);
      return payload ? [payload] : [];
    });
    setOthers(
      dedupeByUserId(
        parsed.filter((entry) => entry.userId !== selfIdRef.current),
      ),
    );
  }, [channel]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setCurrentUserId(data.session?.user.id ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    channel.on("presence", { event: "sync" }, syncOthers);
    channel.on("presence", { event: "join" }, syncOthers);
    channel.on("presence", { event: "leave" }, syncOthers);
    syncOthers();
  }, [channel, syncOthers]);

  useEffect(() => {
    syncOthers();
  }, [currentUserId, syncOthers]);

  const updateCursor = useCallback(
    (cursor: { x: number; y: number } | null) => {
      pendingCursorRef.current = cursor;

      if (rafRef.current !== null) return;

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        void channel.track({
          ...metaRef.current,
          cursor: pendingCursorRef.current,
          thinking: thinkingRef.current,
        });
      });
    },
    [channel],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return { others, currentUserId, updateCursor };
}
