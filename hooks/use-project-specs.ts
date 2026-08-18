"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ProjectSpecSummary, ProjectSpecDetail } from "@/types/specs";

export function triggerSpecDownload(projectId: string, specId: string, fileName?: string) {
  const downloadUrl = `/api/projects/${projectId}/specs/${specId}/download`;
  const link = document.createElement("a");
  link.href = downloadUrl;
  if (fileName) {
    link.download = fileName;
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface UseProjectSpecsProps {
  projectId?: string;
  isAiActive?: boolean;
}

export function useProjectSpecs({ projectId, isAiActive }: UseProjectSpecsProps) {
  const [specs, setSpecs] = useState<ProjectSpecSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal / Preview state
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<ProjectSpecDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const prevIsAiActiveRef = useRef(isAiActive);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const selectedSpecIdRef = useRef<string | null>(null);

  // 1. Fetch specs list
  const fetchSpecs = useCallback(async () => {
    if (!projectId) {
      setSpecs([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/specs`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch specs (HTTP ${res.status})`);
      }

      if (projectIdRef.current !== projectId) return;
      const data = (await res.json()) as { specs: ProjectSpecSummary[] };
      setSpecs(Array.isArray(data.specs) ? data.specs : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load project specs";
      setError(message);
      setSpecs([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial load or on projectId change
  useEffect(() => {
    void fetchSpecs();
  }, [fetchSpecs]);

  // Refetch when AI generation finishes (isAiActive transitions from true to false)
  useEffect(() => {
    if (prevIsAiActiveRef.current === true && isAiActive === false) {
      void fetchSpecs();
    }
    prevIsAiActiveRef.current = isAiActive;
  }, [isAiActive, fetchSpecs]);

  // 2. Open and load spec preview detail
  const openSpecPreview = useCallback(
    async (specId: string) => {
      if (!projectId || !specId) return;

      selectedSpecIdRef.current = specId;
      setSelectedSpecId(specId);
      setSelectedSpec(null);
      setLoadingDetail(true);
      setDetailError(null);

      try {
        const res = await fetch(`/api/projects/${projectId}/specs/${specId}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch spec content (HTTP ${res.status})`);
        }

        if (selectedSpecIdRef.current !== specId || projectIdRef.current !== projectId) {
          return;
        }

        const data = (await res.json()) as { spec: ProjectSpecDetail };
        setSelectedSpec(data.spec);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load spec content";
        setDetailError(message);
      } finally {
        setLoadingDetail(false);
      }
    },
    [projectId]
  );

  // 3. Close preview modal
  const closeSpecPreview = useCallback(() => {
    selectedSpecIdRef.current = null;
    setSelectedSpecId(null);
    setSelectedSpec(null);
    setLoadingDetail(false);
    setDetailError(null);
  }, []);

  // 4. Download action
  const handleDownload = useCallback(
    (spec: { id: string; fileName?: string }) => {
      if (!projectId || !spec.id) return;
      triggerSpecDownload(projectId, spec.id, spec.fileName);
    },
    [projectId]
  );

  // 5. Generate spec trigger
  const generateSpec = useCallback(
    async (contextData?: {
      chatHistory?: unknown[];
      nodes?: unknown[];
      edges?: unknown[];
    }) => {
      if (!projectId) return null;

      setGenerating(true);
      setGenerationError(null);

      try {
        const res = await fetch("/api/ai/spec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: projectId,
            chatHistory: contextData?.chatHistory ?? [],
            nodes: contextData?.nodes ?? [],
            edges: contextData?.edges ?? [],
          }),
        });

        if (res.status === 202) {
          const data = (await res.json()) as { runId: string };
          return data.runId;
        }

        const errorData = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setGenerationError("An AI generation task is already active for this project");
        } else {
          setGenerationError(errorData.error || "Failed to initiate spec generation");
        }
        return null;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to initiate spec generation";
        setGenerationError(message);
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [projectId]
  );

  const clearGenerationError = useCallback(() => {
    setGenerationError(null);
  }, []);

  return {
    specs,
    loading,
    error,
    refreshSpecs: fetchSpecs,
    // Preview modal
    selectedSpecId,
    selectedSpec,
    loadingDetail,
    detailError,
    openSpecPreview,
    closeSpecPreview,
    // Actions
    downloadSpec: handleDownload,
    generateSpec,
    generating,
    generationError,
    clearGenerationError,
  };
}
