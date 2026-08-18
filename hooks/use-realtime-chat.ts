"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  parseAiChatMessage,
  type AiChatMessage,
  type AiChatMessageSender,
} from "@/types/tasks";

interface ChatUser {
  id: string;
  email?: string;
  user_metadata?: { avatar_url?: string; display_name?: string } | null;
}

interface UseRealtimeChatProps {
  projectId?: string;
  channel?: RealtimeChannel | null;
  user: ChatUser;
  incomingAiChatRef?: MutableRefObject<((payload: AiChatMessage) => void) | null>;
  trackRun?: (runId: string) => Promise<void>;
  isAiActive?: boolean;
}

export function useRealtimeChat({
  projectId,
  channel,
  user,
  incomingAiChatRef,
  trackRun,
  isAiActive = false,
}: UseRealtimeChatProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const userRef = useRef(user);
  userRef.current = user;
  const isAiActiveRef = useRef(isAiActive);
  isAiActiveRef.current = isAiActive;
  const trackRunRef = useRef(trackRun);
  trackRunRef.current = trackRun;

  const addLocalMessage = useCallback((msg: AiChatMessage) => {
    if (!msg || !msg.id) return;
    const validated = parseAiChatMessage(msg);
    if (!validated) return;
    if (seenIdsRef.current.has(validated.id)) return;
    if (
      validated.role === "assistant" &&
      validated.runId &&
      (seenIdsRef.current.has(`ai-${validated.runId}`) ||
        seenIdsRef.current.has(`ai-err-${validated.runId}`) ||
        seenIdsRef.current.has(`err-${validated.runId}`))
    ) {
      return;
    }
    seenIdsRef.current.add(validated.id);
    if (validated.role === "assistant" && validated.runId) {
      seenIdsRef.current.add(`ai-${validated.runId}`);
      seenIdsRef.current.add(`ai-err-${validated.runId}`);
      seenIdsRef.current.add(`err-${validated.runId}`);
    }
    setMessages((prev) => [...prev, validated]);
  }, []);

  const addMessage = addLocalMessage;

  const clearSendError = useCallback(() => {
    setSendError(null);
  }, []);

  // Listen to broadcast `ai-chat` events
  useEffect(() => {
    const handleIncomingMessage = (payload: unknown) => {
      const parsed = parseAiChatMessage(payload);
      if (!parsed) return;
      if (seenIdsRef.current.has(parsed.id)) return;
      if (
        parsed.role === "assistant" &&
        parsed.runId &&
        (seenIdsRef.current.has(`ai-${parsed.runId}`) ||
          seenIdsRef.current.has(`ai-err-${parsed.runId}`) ||
          seenIdsRef.current.has(`err-${parsed.runId}`))
      ) {
        return;
      }
      seenIdsRef.current.add(parsed.id);
      if (parsed.role === "assistant" && parsed.runId) {
        seenIdsRef.current.add(`ai-${parsed.runId}`);
        seenIdsRef.current.add(`ai-err-${parsed.runId}`);
        seenIdsRef.current.add(`err-${parsed.runId}`);
      }
      setMessages((prev) => [...prev, parsed]);
    };

    if (incomingAiChatRef) {
      incomingAiChatRef.current = handleIncomingMessage;
    } else if (channel) {
      channel.on(
        "broadcast",
        { event: "ai-chat" },
        (msg: { payload?: unknown }) => {
          handleIncomingMessage(msg?.payload);
        },
      );
    }

    return () => {
      if (incomingAiChatRef) {
        incomingAiChatRef.current = null;
      }
    };
  }, [channel, incomingAiChatRef]);

  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (isAiActiveRef.current) {
        return false;
      }

      const trimmed = content.trim();
      if (!trimmed) return false;

      if (!channel) {
        setSendError("Chat is connecting...");
        return false;
      }

      const currentUser = userRef.current;
      const sender: AiChatMessageSender = {
        id: currentUser.id,
        name:
          currentUser.user_metadata?.display_name ??
          currentUser.email?.split("@")[0] ??
          "Anonymous",
        avatarUrl: currentUser.user_metadata?.avatar_url ?? null,
      };

      const rawMessage = {
        id: `msg-${crypto.randomUUID()}`,
        sender,
        role: "user" as const,
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      const validated = parseAiChatMessage(rawMessage);
      if (!validated) {
        setSendError("Invalid message format.");
        return false;
      }

      try {
        // 1. Push the user message to the `ai-chat` Broadcast channel
        const res = await channel.send({
          type: "broadcast",
          event: "ai-chat",
          payload: validated,
        });

        if (res !== "ok") {
          setSendError("Failed to send message. Please try again.");
          return false;
        }

        seenIdsRef.current.add(validated.id);
        setMessages((prev) => [...prev, validated]);
        setSendError(null);

        // If no projectId is available (e.g. outside workspace), do not call design API
        if (!projectId) {
          return true;
        }

        // 2. Call POST /api/ai/design with { prompt, roomId }
        try {
          const apiRes = await fetch("/api/ai/design", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: trimmed,
              roomId: projectId,
            }),
          });

          if (apiRes.status === 202) {
            // 3. Read { runId } from HTTP 202 response
            const data = (await apiRes.json()) as { runId?: string };
            if (data.runId) {
              void trackRunRef.current?.(data.runId);
            }
            return true;
          }

          if (apiRes.status === 409) {
            const data = (await apiRes.json().catch(() => ({}))) as {
              error?: string;
            };
            setSendError(
              data.error ||
                "An AI generation task is already active for this project."
            );
            return false;
          }

          const errData = (await apiRes.json().catch(() => ({}))) as {
            error?: string;
          };
          setSendError(
            errData.error || "Failed to start AI generation. Please try again."
          );
          return false;
        } catch (fetchErr) {
          console.error("[useRealtimeChat] Failed to call /api/ai/design:", fetchErr);
          setSendError(
            "Network error: Failed to reach AI service. Please try again."
          );
          return false;
        }
      } catch (err) {
        console.error("[useRealtimeChat] Failed to broadcast message:", err);
        setSendError("Failed to send message. Please try again.");
        return false;
      }
    },
    [channel, projectId],
  );

  return {
    messages,
    setMessages,
    addMessage,
    addLocalMessage,
    sendMessage,
    sendError,
    clearSendError,
  };
}
