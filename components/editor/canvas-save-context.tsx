"use client";

import { createContext, useContext } from "react";
import type { SaveStatus } from "@/hooks/use-canvas-autosave";

export interface CanvasSaveContextValue {
  status: SaveStatus;
  setStatus: (status: SaveStatus) => void;
  registerSaveHandler: (handler: (() => Promise<boolean>) | null) => void;
  saveNow: () => Promise<boolean>;
}

const CanvasSaveContext = createContext<CanvasSaveContextValue | null>(null);

export function CanvasSaveProvider({
  value,
  children,
}: {
  value: CanvasSaveContextValue;
  children: React.ReactNode;
}) {
  return (
    <CanvasSaveContext.Provider value={value}>
      {children}
    </CanvasSaveContext.Provider>
  );
}

export function useCanvasSave(): CanvasSaveContextValue | null {
  return useContext(CanvasSaveContext);
}
