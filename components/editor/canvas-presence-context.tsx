"use client";

import { createContext, useContext } from "react";
import type { PresencePayload } from "@/types/realtime";

export interface CanvasPresenceContextValue {
  others: PresencePayload[];
  setOthers: (others: PresencePayload[]) => void;
}

const CanvasPresenceContext = createContext<CanvasPresenceContextValue | null>(null);

export function CanvasPresenceProvider({
  value,
  children,
}: {
  value: CanvasPresenceContextValue;
  children: React.ReactNode;
}) {
  return (
    <CanvasPresenceContext.Provider value={value}>
      {children}
    </CanvasPresenceContext.Provider>
  );
}

export function useCanvasPresence(): CanvasPresenceContextValue | null {
  return useContext(CanvasPresenceContext);
}
