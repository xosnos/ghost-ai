"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { type MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RemoteSelectionMap } from "@/components/editor/remote-selection-context";
import { buildUserMeta } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";
import type { CursorMovePayload, PresencePayload, SelectionChangePayload } from "@/types/realtime";

interface PresenceUser {
  id: string;
  email?: string;
  user_metadata?: { avatar_url?: string; display_name?: string } | null;
}

export interface UseRealtimePresenceReturn {
  others: PresencePayload[];
  currentUserId: string | null;
  remoteHighlights: RemoteSelectionMap;
  updateCursor: (cursor: { x: number; y: number } | null) => void;
  updateSelection: (nodeIds: string[]) => void;
  updateThinking: (thinking: boolean) => void;
}

function dedupeByUserId(entries: PresencePayload[]): PresencePayload[] {
  const seen = new Map<string, PresencePayload>();
  for (const entry of entries) {
    seen.set(entry.userId, entry);
  }
  return Array.from(seen.values());
}

function selectionKey(nodeIds: string[]): string {
  return [...nodeIds].sort().join("\0");
}

export function useRealtimePresence(
  channel: RealtimeChannel,
  user: PresenceUser,
  presenceEntries: PresencePayload[],
  incomingCursorRef?: MutableRefObject<((payload: CursorMovePayload) => void) | null>,
  incomingSelectionRef?: MutableRefObject<((payload: SelectionChangePayload) => void) | null>,
): UseRealtimePresenceReturn {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [cursors, setCursors] = useState<Record<string, { x: number; y: number } | null>>({});
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const metaRef = useRef(buildUserMeta(user));
  const rafRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const lastSelectionKeyRef = useRef("");

  useEffect(() => {
    metaRef.current = buildUserMeta(user);
  }, [user]);

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
    if (!incomingCursorRef) return;
    incomingCursorRef.current = (payload) => {
      if (payload.userId === metaRef.current.userId) return;
      setCursors((prev) => ({ ...prev, [payload.userId]: payload.cursor }));
    };
    return () => {
      incomingCursorRef.current = null;
    };
  }, [incomingCursorRef]);

  useEffect(() => {
    if (!incomingSelectionRef) return;
    incomingSelectionRef.current = (payload) => {
      if (payload.userId === metaRef.current.userId) return;
      setSelections((prev) => ({
        ...prev,
        [payload.userId]: payload.nodeIds,
      }));
    };
    return () => {
      incomingSelectionRef.current = null;
    };
  }, [incomingSelectionRef]);

  const others = useMemo(() => {
    const selfId = currentUserId ?? user.id;
    return dedupeByUserId(presenceEntries.filter((entry) => entry.userId !== selfId)).map(
      (person) => ({
        ...person,
        cursor: person.userId in cursors ? cursors[person.userId] : person.cursor,
      }),
    );
  }, [currentUserId, presenceEntries, user.id, cursors]);

  const remoteHighlights = useMemo(() => {
    const byNode: RemoteSelectionMap = {};
    for (const person of others) {
      const nodeIds = selections[person.userId];
      if (!nodeIds || nodeIds.length === 0) continue;
      for (const nodeId of nodeIds) {
        if (!byNode[nodeId]) byNode[nodeId] = [];
        byNode[nodeId].push({
          userId: person.userId,
          color: person.cursorColor,
          name: person.displayName,
        });
      }
    }
    return byNode;
  }, [others, selections]);

  const updateCursor = useCallback(
    (cursor: { x: number; y: number } | null) => {
      pendingCursorRef.current = cursor;

      if (rafRef.current !== null) return;

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        void channel.send({
          type: "broadcast",
          event: "cursor:move",
          payload: {
            userId: metaRef.current.userId,
            cursor: pendingCursorRef.current,
          },
        });
      });
    },
    [channel],
  );

  const updateSelection = useCallback(
    (nodeIds: string[]) => {
      const key = selectionKey(nodeIds);
      if (key === lastSelectionKeyRef.current) return;
      lastSelectionKeyRef.current = key;
      void channel.send({
        type: "broadcast",
        event: "selection:change",
        payload: {
          userId: metaRef.current.userId,
          nodeIds,
        },
      });
    },
    [channel],
  );

  const updateThinking = useCallback(
    (thinking: boolean) => {
      void channel.track({
        ...metaRef.current,
        cursor: pendingCursorRef.current,
        thinking,
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

  return {
    others,
    currentUserId,
    remoteHighlights,
    updateCursor,
    updateSelection,
    updateThinking,
  };
}
