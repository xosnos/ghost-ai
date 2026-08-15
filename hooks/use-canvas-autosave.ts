"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasNode, CanvasEdge } from "@/types/canvas";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseCanvasAutosaveParams {
  projectId: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  isInitialized: boolean;
  debounceMs?: number;
}

export interface UseCanvasAutosaveReturn {
  status: SaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
  saveNow: () => Promise<boolean>;
}

function serializeCanvas(nodes: CanvasNode[], edges: CanvasEdge[]): string {
  // Strip temporary transient UI state like selected before serializing for comparison
  const cleanNodes = nodes.map((node) => {
    const { selected, ...rest } = node;
    void selected;
    return rest;
  });
  const cleanEdges = edges.map((edge) => {
    const { selected, ...rest } = edge;
    void selected;
    return rest;
  });
  return JSON.stringify({ nodes: cleanNodes, edges: cleanEdges });
}

export function useCanvasAutosave({
  projectId,
  nodes,
  edges,
  isInitialized,
  debounceMs = 1500,
}: UseCanvasAutosaveParams): UseCanvasAutosaveReturn {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastSavedJsonRef = useRef<string>("");
  const isSavingRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // Initialize the baseline snapshot when isInitialized flips to true
  const initializedOnceRef = useRef(false);
  useEffect(() => {
    if (isInitialized && !initializedOnceRef.current) {
      initializedOnceRef.current = true;
      lastSavedJsonRef.current = serializeCanvas(nodes, edges);
    }
  }, [isInitialized, nodes, edges]);

  const performSave = useCallback(
    async (currentJson: string, nodesToSave: CanvasNode[], edgesToSave: CanvasEdge[]) => {
      if (isSavingRef.current || !projectId) return false;

      isSavingRef.current = true;
      setStatus("saving");
      setError(null);

      try {
        const res = await fetch(`/api/projects/${projectId}/canvas`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodes: nodesToSave.map((node) => {
              const { selected, ...rest } = node;
              void selected;
              return rest;
            }),
            edges: edgesToSave.map((edge) => {
              const { selected, ...rest } = edge;
              void selected;
              return rest;
            }),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Save failed with status ${res.status}`);
        }

        lastSavedJsonRef.current = currentJson;
        setStatus("saved");
        setLastSavedAt(new Date());
        setError(null);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save canvas";
        console.error("[useCanvasAutosave] error saving canvas:", err);
        setStatus("error");
        setError(msg);
        return false;
      } finally {
        isSavingRef.current = false;
      }
    },
    [projectId]
  );

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (!isInitialized) return false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const currentJson = serializeCanvas(nodesRef.current, edgesRef.current);
    return performSave(currentJson, nodesRef.current, edgesRef.current);
  }, [isInitialized, performSave]);

  // Watch for changes and schedule debounced save
  useEffect(() => {
    if (!isInitialized || !initializedOnceRef.current) {
      return;
    }

    const currentJson = serializeCanvas(nodes, edges);
    if (currentJson === lastSavedJsonRef.current) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void performSave(currentJson, nodesRef.current, edgesRef.current);
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [nodes, edges, isInitialized, debounceMs, performSave]);

  return {
    status,
    lastSavedAt,
    error,
    saveNow,
  };
}
