"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createRealtimeChannel, buildUserMeta } from "@/lib/realtime";
import { RealtimeCanvas } from "@/components/editor/realtime-canvas";

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

  useEffect(() => {
    const ch = createRealtimeChannel(projectId);
    setChannel(ch);

    ch
      .on("presence", { event: "sync" }, () => {
        setStatus("connected");
      })
      .subscribe(async (state) => {
        if (state === "SUBSCRIBED") {
          await ch.track({
            ...buildUserMeta(user),
            cursor: null,
          });
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setStatus("error");
        }
      });

    return () => {
      ch.unsubscribe();
    };
  }, [projectId, user]);

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
      <RealtimeCanvas channel={channel} />
    </div>
  );
}
