"use client";

import { useState } from "react";
import { Panel } from "@xyflow/react";
import { UserMenu } from "@/components/editor/user-menu";
import type { PresencePayload } from "@/types/realtime";

const VISIBLE_LIMIT = 5;

interface PresenceAvatarsProps {
  others: PresencePayload[];
  userEmail: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase() || "?";
}

function CollaboratorAvatar({ person }: { person: PresencePayload }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(person.avatarUrl) && !imageFailed;

  return (
    <span
      className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-[10px] font-medium ring-2 ring-[var(--bg-base)]"
      style={{
        backgroundColor: person.cursorColor,
        color: "var(--bg-base)",
      }}
      title={person.displayName}
      aria-label={person.displayName}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- Auth avatar URLs are arbitrary remote hosts
        <img
          src={person.avatarUrl ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initials(person.displayName)}</span>
      )}
    </span>
  );
}

export function PresenceAvatars({ others, userEmail }: PresenceAvatarsProps) {
  const visible = others.slice(0, VISIBLE_LIMIT);
  const overflow = others.length - visible.length;

  return (
    <Panel
      position="top-right"
      className="nopan nodrag nowheel m-3 flex items-center gap-2 overflow-visible rounded-full px-2 py-1.5"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
      }}
    >
      {visible.length > 0 && (
        <ul
          className="flex items-center"
          aria-label="Collaborators in this room"
        >
          {visible.map((person, index) => (
            <li
              key={person.userId}
              className={index === 0 ? "relative" : "relative -ml-2"}
              style={{ zIndex: visible.length - index }}
            >
              <CollaboratorAvatar person={person} />
            </li>
          ))}
          {overflow > 0 && (
            <li className="relative -ml-2" style={{ zIndex: 0 }}>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-medium ring-2 ring-[var(--bg-base)]"
                style={{
                  backgroundColor: "var(--bg-subtle)",
                  color: "var(--text-secondary)",
                }}
                title={`${overflow} more`}
                aria-label={`${overflow} more collaborators`}
              >
                +{overflow}
              </span>
            </li>
          )}
        </ul>
      )}

      {visible.length > 0 && (
        <div
          className="h-5 w-px"
          style={{ backgroundColor: "var(--border-default)" }}
          aria-hidden="true"
        />
      )}

      <UserMenu email={userEmail} />
    </Panel>
  );
}
