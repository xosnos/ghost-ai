"use client";

import { useEffect } from "react";
import { Link2, Trash2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Collaborator } from "@/lib/projects/collaborators";

interface ShareProjectDialogProps {
  open: boolean;
  projectName: string;
  isOwner: boolean;
  collaborators: Collaborator[];
  inviteEmail: string;
  loading: boolean;
  inviting: boolean;
  removingEmail: string | null;
  error: string | null;
  copied: boolean;
  projectLink: string;
  onInviteEmailChange: (value: string) => void;
  onInvite: () => void;
  onRemove: (email: string) => void;
  onCopyLink: () => void;
  onClose: () => void;
}

function CollaboratorAvatar({
  email,
  displayName,
  avatarUrl,
}: {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const label = displayName || email;
  const initial = label.charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="h-8 w-8 rounded-full object-cover"
        style={{ border: "1px solid var(--border-subtle)" }}
      />
    );
  }

  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium"
      style={{
        backgroundColor: "var(--accent-primary-dim)",
        color: "var(--accent-primary)",
        border: "1px solid var(--border-subtle)",
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export function ShareProjectDialog({
  open,
  projectName,
  isOwner,
  collaborators,
  inviteEmail,
  loading,
  inviting,
  removingEmail,
  error,
  copied,
  projectLink,
  onInviteEmailChange,
  onInvite,
  onRemove,
  onCopyLink,
  onClose,
}: ShareProjectDialogProps) {
  useEffect(() => {
    if (!open || !isOwner) return;
    const id = window.setTimeout(() => {
      document.getElementById("share-invite-email")?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, isOwner]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onInvite();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share project</DialogTitle>
          <DialogDescription>
            {isOwner
              ? `Invite collaborators to "${projectName}" by email.`
              : `People with access to "${projectName}".`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-4">
          <div className="flex flex-col gap-1.5">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Project link
            </span>
            <div className="flex gap-2">
              <div
                className="flex h-9 min-w-0 flex-1 items-center truncate rounded-xl px-3 font-mono text-xs"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-secondary)",
                }}
                title={projectLink}
              >
                {projectLink}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={onCopyLink}
              >
                <Link2 className="h-4 w-4" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          {isOwner && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="share-invite-email"
                className="text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Invite by email
              </label>
              <div className="flex gap-2">
                <Input
                  id="share-invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => onInviteEmailChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="colleague@company.com"
                  autoComplete="off"
                  disabled={inviting}
                />
                <Button
                  type="button"
                  onClick={onInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="shrink-0 gap-1.5"
                >
                  <UserPlus className="h-4 w-4" />
                  {inviting ? "Inviting..." : "Invite"}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Collaborators
            </span>

            {loading ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Loading...
              </p>
            ) : collaborators.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {isOwner
                  ? "No collaborators yet. Invite someone by email."
                  : "No other collaborators on this project."}
              </p>
            ) : (
              <ScrollArea className="max-h-56">
                <ul className="flex flex-col gap-1 pr-2">
                  {collaborators.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl px-2 py-2"
                      style={{ backgroundColor: "var(--bg-elevated)" }}
                    >
                      <CollaboratorAvatar
                        email={c.email}
                        displayName={c.displayName}
                        avatarUrl={c.avatarUrl}
                      />
                      <div className="min-w-0 flex-1">
                        {c.displayName ? (
                          <>
                            <p
                              className="truncate text-sm font-medium"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {c.displayName}
                            </p>
                            <p
                              className="truncate text-xs"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {c.email}
                            </p>
                          </>
                        ) : (
                          <p
                            className="truncate text-sm"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {c.email}
                          </p>
                        )}
                      </div>
                      {isOwner && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${c.email}`}
                          disabled={removingEmail === c.email}
                          onClick={() => onRemove(c.email)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
