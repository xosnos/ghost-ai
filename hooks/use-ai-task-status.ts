"use client";

import { useCallback, useEffect, useState, useMemo, useRef, type MutableRefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { parseAiStatusMessage, type AiStatusMessage } from "@/types/tasks";
import type { ActiveTaskRun } from "@/components/editor/ai-status-context";

interface UseAiTaskStatusProps {
  projectId: string;
  channel?: RealtimeChannel | null;
  incomingAiStatusRef?: MutableRefObject<((payload: AiStatusMessage) => void) | null>;
  onRunFailed?: (runId: string, errorMessage?: string | null) => void;
}

export function useAiTaskStatus({
  projectId,
  channel,
  incomingAiStatusRef,
  onRunFailed,
}: UseAiTaskStatusProps) {
  const [activeTaskRun, setActiveTaskRun] = useState<ActiveTaskRun | null>(null);
  const [latestStatus, setLatestStatus] = useState<AiStatusMessage | null>(null);
  const [overrideActive, setOverrideActive] = useState<boolean | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const onRunFailedRef = useRef(onRunFailed);

  useEffect(() => {
    currentRunIdRef.current = currentRunId;
  }, [currentRunId]);

  useEffect(() => {
    onRunFailedRef.current = onRunFailed;
  }, [onRunFailed]);

  // Single-fetch run details when a specific runId is registered or tracked
  const trackRun = useCallback(async (runId: string) => {
    if (!runId || !runId.trim()) return;
    const cleanRunId = runId.trim();
    setCurrentRunId(cleanRunId);
    currentRunIdRef.current = cleanRunId;
    setOverrideActive(true);

    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("task_runs")
        .select(
          "id, project_id, user_id, kind, status, error_message, created_at, started_at, completed_at"
        )
        .eq("id", cleanRunId)
        .maybeSingle();

      if (error) {
        console.warn("[useAiTaskStatus] Error fetching task run on track:", error);
        return;
      }

      if (data) {
        if (["queued", "running", "retrying"].includes(data.status)) {
          const run: ActiveTaskRun = {
            id: data.id,
            projectId: data.project_id,
            userId: data.user_id,
            kind: data.kind as "design" | "spec",
            status: data.status,
            errorMessage: data.error_message,
            createdAt: data.created_at,
            startedAt: data.started_at,
            completedAt: data.completed_at,
          };
          setActiveTaskRun(run);
          setOverrideActive(null);
        } else if (["completed", "failed"].includes(data.status)) {
          setActiveTaskRun(null);
          setOverrideActive(false);
          setCurrentRunId(null);
          currentRunIdRef.current = null;
          if (data.status === "failed") {
            onRunFailedRef.current?.(data.id, data.error_message);
            setLatestStatus({
              runId: data.id,
              projectId: data.project_id,
              kind: data.kind as "design" | "spec",
              status: "failed",
              step: "failed",
              message: data.error_message || "Generation failed",
              timestamp: data.completed_at || new Date().toISOString(),
            });
          }
        }
      }
    } catch (err) {
      console.warn("[useAiTaskStatus] Unexpected error during trackRun fetch:", err);
    }
  }, []);

  // 1. Initial fetch & reconnection recovery: read active task_runs row
  useEffect(() => {
    let isCancelled = false;
    const supabase = createClient();

    async function checkActiveTaskRun() {
      try {
        const { data, error } = await supabase
          .from("task_runs")
          .select(
            "id, project_id, user_id, kind, status, error_message, created_at, started_at, completed_at"
          )
          .eq("project_id", projectId)
          .in("status", ["queued", "running", "retrying"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (isCancelled) return;

        if (error) {
          console.warn("[useAiTaskStatus] Error fetching active task run:", error);
          return;
        }

        if (data) {
          const run: ActiveTaskRun = {
            id: data.id,
            projectId: data.project_id,
            userId: data.user_id,
            kind: data.kind as "design" | "spec",
            status: data.status,
            errorMessage: data.error_message,
            createdAt: data.created_at,
            startedAt: data.started_at,
            completedAt: data.completed_at,
          };
          setActiveTaskRun(run);
          setCurrentRunId(data.id);
          currentRunIdRef.current = data.id;
          setLatestStatus((prev) => {
            if (prev && prev.runId === data.id) return prev;
            return {
              runId: data.id,
              projectId: data.project_id,
              kind: data.kind as "design" | "spec",
              status: data.status,
              step: data.status === "queued" ? "start" : "generating",
              message:
                data.status === "queued"
                  ? "Queued for generation..."
                  : "AI is working...",
              timestamp: data.created_at,
            };
          });
        } else {
          setActiveTaskRun(null);
          setCurrentRunId(null);
          currentRunIdRef.current = null;
        }
      } catch (err) {
        console.warn("[useAiTaskStatus] Unexpected error fetching task run:", err);
      }
    }

    void checkActiveTaskRun();

    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  // 2. Realtime Postgres Changes on task_runs for live lifecycle state
  useEffect(() => {
    const supabase = createClient();
    const subChannel = supabase
      .channel(`task_runs_live:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_runs",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const row = payload.new as {
              id: string;
              project_id: string;
              user_id: string;
              kind: "design" | "spec";
              status: string;
              error_message: string | null;
              created_at: string;
              started_at: string | null;
              completed_at: string | null;
            };

            if (["queued", "running", "retrying"].includes(row.status)) {
              setActiveTaskRun({
                id: row.id,
                projectId: row.project_id,
                userId: row.user_id,
                kind: row.kind,
                status: row.status as ActiveTaskRun["status"],
                errorMessage: row.error_message,
                createdAt: row.created_at,
                startedAt: row.started_at,
                completedAt: row.completed_at,
              });
              setCurrentRunId(row.id);
              currentRunIdRef.current = row.id;
              setOverrideActive(null);
            } else if (["completed", "failed"].includes(row.status)) {
              setActiveTaskRun(null);
              setOverrideActive(false);
              setCurrentRunId(null);
              currentRunIdRef.current = null;
              if (row.status === "failed") {
                onRunFailedRef.current?.(row.id, row.error_message);
                if (row.error_message) {
                  setLatestStatus({
                    runId: row.id,
                    projectId: row.project_id,
                    kind: row.kind,
                    status: "failed",
                    step: "failed",
                    message: row.error_message,
                    timestamp: row.completed_at || new Date().toISOString(),
                  });
                }
              }
            }
          } else if (payload.eventType === "DELETE") {
            setActiveTaskRun(null);
            setOverrideActive(false);
            setCurrentRunId(null);
            currentRunIdRef.current = null;
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(subChannel);
    };
  }, [projectId]);

  // 3. Realtime Broadcast `ai-status` listener
  useEffect(() => {
    const handleIncomingStatus = (payload: unknown) => {
      const parsed = parseAiStatusMessage(payload);
      if (!parsed) return;
      if (parsed.projectId !== projectId) return;

      setLatestStatus(parsed);

      if (["queued", "running", "retrying"].includes(parsed.status)) {
        setOverrideActive(true);
        setCurrentRunId(parsed.runId);
        currentRunIdRef.current = parsed.runId;
      } else if (
        ["completed", "failed"].includes(parsed.status) ||
        parsed.step === "complete" ||
        parsed.step === "failed"
      ) {
        setOverrideActive(false);
        setActiveTaskRun(null);
        setCurrentRunId(null);
        currentRunIdRef.current = null;
        if (parsed.step === "failed" || parsed.status === "failed") {
          onRunFailedRef.current?.(parsed.runId, parsed.message);
        }
      }
    };

    if (incomingAiStatusRef) {
      incomingAiStatusRef.current = handleIncomingStatus;
    } else if (channel) {
      channel.on(
        "broadcast",
        { event: "ai-status" },
        (msg: { payload?: unknown }) => {
          handleIncomingStatus(msg?.payload);
        },
      );
    }

    return () => {
      if (incomingAiStatusRef) {
        incomingAiStatusRef.current = null;
      }
    };
  }, [projectId, channel, incomingAiStatusRef]);

  // Derive final isAiActive
  const isAiActive = useMemo(() => {
    if (overrideActive !== null) {
      return overrideActive;
    }
    if (activeTaskRun !== null) {
      return true;
    }
    if (
      latestStatus &&
      ["queued", "running", "retrying"].includes(latestStatus.status) &&
      latestStatus.step !== "complete" &&
      latestStatus.step !== "failed"
    ) {
      return true;
    }
    return false;
  }, [overrideActive, activeTaskRun, latestStatus]);

  return {
    isAiActive,
    activeTaskRun,
    latestStatus,
    currentRunId,
    trackRun,
    setIsAiActive: (active: boolean) => setOverrideActive(active),
    setLatestStatus,
    setActiveTaskRun,
  };
}
