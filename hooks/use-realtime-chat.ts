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
  const isAiActiveRef = useRef(isAiActive);
  const trackRunRef = useRef(trackRun);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    isAiActiveRef.current = isAiActive;
  }, [isAiActive]);

  useEffect(() => {
    trackRunRef.current = trackRun;
  }, [trackRun]);

  const upsertMessage = useCallback((msg: unknown) => {
    const validated = parseAiChatMessage(msg);
    if (!validated) return null;
    if (seenIdsRef.current.has(validated.id)) return validated;
    if (
      validated.role === "assistant" &&
      validated.runId &&
      (seenIdsRef.current.has(`ai-${validated.runId}`) ||
        seenIdsRef.current.has(`ai-err-${validated.runId}`) ||
        seenIdsRef.current.has(`err-${validated.runId}`))
    ) {
      return validated;
    }
    seenIdsRef.current.add(validated.id);
    if (validated.role === "assistant" && validated.runId) {
      seenIdsRef.current.add(`ai-${validated.runId}`);
      seenIdsRef.current.add(`ai-err-${validated.runId}`);
      seenIdsRef.current.add(`err-${validated.runId}`);
    }
    setMessages((prev) => [...prev, validated]);
    return validated;
  }, []);

  const addLocalMessage = useCallback(
    (msg: AiChatMessage) => {
      upsertMessage(msg);
    },
    [upsertMessage]
  );

  const addMessage = addLocalMessage;

  const clearSendError = useCallback(() => {
    setSendError(null);
  }, []);

  // Listen to broadcast `ai-chat` events
  useEffect(() => {
    const handleIncomingMessage = (payload: unknown) => {
      upsertMessage(payload);
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
  }, [channel, incomingAiChatRef, upsertMessage]);

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
        // If no projectId is available (e.g. outside workspace), only broadcast.
        if (!projectId) {
          const res = await channel.send({
            type: "broadcast",
            event: "ai-chat",
            payload: validated,
          });
          if (res !== "ok") {
            setSendError("Failed to send message. Please try again.");
            return false;
          }
          upsertMessage(validated);
          setSendError(null);
          return true;
        }

        // Accept the design task before publishing the prompt so a failed
        // enqueue cannot leave an orphaned chat message or duplicate on retry.
        const apiRes = await fetch("/api/ai/design", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: trimmed,
            roomId: projectId,
          }),
          signal: AbortSignal.timeout(15_000),
        });

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

        if (apiRes.status !== 202) {
          const errData = (await apiRes.json().catch(() => ({}))) as {
            error?: string;
          };
          setSendError(
            errData.error || "Failed to start AI generation. Please try again."
          );
          return false;
        }

        const data = (await apiRes.json()) as { runId?: string };

        const res = await channel.send({
          type: "broadcast",
          event: "ai-chat",
          payload: validated,
        });
        if (res !== "ok") {
          console.warn(
            "[useRealtimeChat] Design task accepted but chat broadcast failed."
          );
        }

        upsertMessage(validated);
        setSendError(null);

        if (data.runId) {
          void trackRunRef.current?.(data.runId);
        }
        return true;
      } catch (err) {
        console.error("[useRealtimeChat] Failed to send design message:", err);
        setSendError(
          err instanceof DOMException && err.name === "TimeoutError"
            ? "The AI service took too long to respond. Please try again."
            : "Failed to start AI generation. Please try again."
        );
        return false;
      }
    },
    [channel, projectId, upsertMessage],
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
