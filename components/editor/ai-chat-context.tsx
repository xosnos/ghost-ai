"use client";

import type React from "react";
import { createContext, useContext } from "react";
import type { AiChatMessage } from "@/types/tasks";

export interface AiChatContextValue {
  messages: AiChatMessage[];
  sendMessage: (content: string) => Promise<boolean>;
  sendError: string | null;
  clearSendError: () => void;
  setSendError?: (error: string | null) => void;
  registerSendHandler: (handler: ((content: string) => Promise<boolean>) | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<AiChatMessage[]>>;
  addMessage: (message: AiChatMessage) => void;
  registerAddMessage?: (handler: ((message: AiChatMessage) => void) | null) => void;
  currentUserId: string | null;
}

const AiChatContext = createContext<AiChatContextValue | null>(null);

export function AiChatProvider({
  value,
  children,
}: {
  value: AiChatContextValue;
  children: React.ReactNode;
}) {
  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChat(): AiChatContextValue | null {
  return useContext(AiChatContext);
}
