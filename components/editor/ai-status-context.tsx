"use client";

import { createContext, useContext } from "react";
import type { AiStatusMessage, AiTaskStatus } from "@/types/tasks";

export interface ActiveTaskRun {
  id: string;
  projectId: string;
  userId: string;
  kind: "design" | "spec";
  status: AiTaskStatus;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AiStatusContextValue {
  isAiActive: boolean;
  latestStatus: AiStatusMessage | null;
  activeTaskRun: ActiveTaskRun | null;
  currentRunId?: string | null;
  trackRun?: (runId: string) => Promise<void>;
  registerTrackRun?: (handler: ((runId: string) => Promise<void>) | null) => void;
  setIsAiActive: (active: boolean) => void;
  setLatestStatus: (status: AiStatusMessage | null) => void;
  setActiveTaskRun: (run: ActiveTaskRun | null) => void;
}

const AiStatusContext = createContext<AiStatusContextValue | null>(null);

export function AiStatusProvider({
  value,
  children,
}: {
  value: AiStatusContextValue;
  children: React.ReactNode;
}) {
  return <AiStatusContext.Provider value={value}>{children}</AiStatusContext.Provider>;
}

export function useAiStatus(): AiStatusContextValue | null {
  return useContext(AiStatusContext);
}
