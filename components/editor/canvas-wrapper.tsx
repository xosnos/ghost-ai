"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  connectRealtimeChannel,
  buildUserMeta,
  attachPresenceListeners,
  attachCanvasSyncListener,
} from "@/lib/realtime";
import { RealtimeCanvas } from "@/components/editor/realtime-canvas";
import type { PresencePayload } from "@/types/realtime";

interface CanvasWrapperProps {
  projectId: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: { avatar_url?: string; display_name?: string } | null;
  };
}

type Status = "connecting" | "connected" | "error";

export function CanvasWrapper({ projectId, user }: CanvasWrapperProps) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [presenceEntries, setPresenceEntries] = useState<PresencePayload[]>([]);
  const incomingBroadcastRef = useRef<((event: unknown) => void) | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let cancelled = false;
    let supabase: SupabaseClient | null = null;
    let ch: RealtimeChannel | null = null;

    async function start() {
      const connection = await connectRealtimeChannel(projectId, user.id);
      supabase = connection.supabase;
      ch = connection.channel;

      if (cancelled) {
        await supabase.removeChannel(ch);
        return;
      }
      attachPresenceListeners(ch, setPresenceEntries);
      attachCanvasSyncListener(ch, (payload) => {
        incomingBroadcastRef.current?.(payload);
      });
      setChannel(ch);

      ch.subscribe(async (state) => {
        if (cancelled) return;
        if (state === "SUBSCRIBED") {
          await ch?.track({
            ...buildUserMeta(userRef.current),
            cursor: null,
            thinking: false,
          });
          if (!cancelled) setStatus("connected");
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setStatus("error");
        }
      });
    }

    void start();

    return () => {
      cancelled = true;
      setPresenceEntries([]);
      setChannel(null);
      setStatus("connecting");
      if (supabase && ch) {
        void supabase.removeChannel(ch);
      }
    };
  }, [projectId, user.id]);

  if (status === "error") {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <p className="text-sm" style={{ color: "var(--state-error)" }}>
          Could not connect to the collaboration server. Please refresh.
        </p>
      </div>
    );
  }

  if (status === "connecting" || !channel) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Connecting to canvas…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1">
      <RealtimeCanvas
        channel={channel}
        user={user}
        presenceEntries={presenceEntries}
        incomingBroadcastRef={incomingBroadcastRef}
      />
    </div>
  );
}
