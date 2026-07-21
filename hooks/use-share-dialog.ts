"use client";

import { useCallback, useEffect, useState } from "react";
import type { Collaborator } from "@/lib/projects/collaborators";

function unwrapErrorMessage(err: unknown, fallback: string): string {
  let current: unknown = err;
  let message = fallback;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    if (current.message && current.message !== "fetch failed") {
      message = current.message;
      break;
    }
    current = (current as Error & { cause?: unknown }).cause;
  }
  return message;
}

async function parseJsonError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  if (body && typeof body.error === "string") return body.error;
  return `Request failed (${res.status})`;
}

export interface UseShareDialogResult {
  open: boolean;
  collaborators: Collaborator[];
  isOwner: boolean;
  inviteEmail: string;
  loading: boolean;
  inviting: boolean;
  removingEmail: string | null;
  error: string | null;
  copied: boolean;
  projectLink: string;
  openShare: () => void;
  closeShare: () => void;
  setInviteEmail: (value: string) => void;
  submitInvite: () => Promise<void>;
  removeCollaborator: (email: string) => Promise<void>;
  copyLink: () => Promise<void>;
}

export function useShareDialog(
  projectId: string | undefined,
  initialIsOwner = false
): UseShareDialogResult {
  const [open, setOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isOwner, setIsOwner] = useState(initialIsOwner);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const projectLink =
    typeof window !== "undefined" && projectId
      ? `${window.location.origin}/editor/${projectId}`
      : projectId
        ? `/editor/${projectId}`
        : "";

  const loadCollaborators = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`);
      if (!res.ok) throw new Error(await parseJsonError(res));
      const data = await res.json();
      setCollaborators(Array.isArray(data.collaborators) ? data.collaborators : []);
      setIsOwner(Boolean(data.isOwner));
    } catch (err) {
      setError(unwrapErrorMessage(err, "Failed to load collaborators"));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setIsOwner(initialIsOwner);
  }, [initialIsOwner, projectId]);

  useEffect(() => {
    if (!open || !projectId) return;
    void loadCollaborators();
  }, [open, projectId, loadCollaborators]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  const openShare = useCallback(() => {
    setInviteEmail("");
    setError(null);
    setCopied(false);
    setOpen(true);
  }, []);

  const closeShare = useCallback(() => {
    setOpen(false);
    setInviteEmail("");
    setError(null);
    setInviting(false);
    setRemovingEmail(null);
  }, []);

  const submitInvite = useCallback(async () => {
    if (!projectId || !inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      const data = await res.json();
      if (data.collaborator) {
        setCollaborators((prev) => [...prev, data.collaborator as Collaborator]);
      } else {
        await loadCollaborators();
      }
      setInviteEmail("");
    } catch (err) {
      setError(unwrapErrorMessage(err, "Failed to invite collaborator"));
    } finally {
      setInviting(false);
    }
  }, [projectId, inviteEmail, loadCollaborators]);

  const removeCollaboratorByEmail = useCallback(
    async (email: string) => {
      if (!projectId) return;
      setRemovingEmail(email);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/collaborators`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) throw new Error(await parseJsonError(res));
        setCollaborators((prev) =>
          prev.filter((c) => c.email.toLowerCase() !== email.toLowerCase())
        );
      } catch (err) {
        setError(unwrapErrorMessage(err, "Failed to remove collaborator"));
      } finally {
        setRemovingEmail(null);
      }
    },
    [projectId]
  );

  const copyLink = useCallback(async () => {
    if (!projectLink) return;
    try {
      await navigator.clipboard.writeText(projectLink);
      setCopied(true);
    } catch {
      setError("Could not copy link");
    }
  }, [projectLink]);

  return {
    open,
    collaborators,
    isOwner,
    inviteEmail,
    loading,
    inviting,
    removingEmail,
    error,
    copied,
    projectLink,
    openShare,
    closeShare,
    setInviteEmail,
    submitInvite,
    removeCollaborator: removeCollaboratorByEmail,
    copyLink,
  };
}
