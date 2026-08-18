"use client";

import { useState } from "react";
import type { PresencePayload } from "@/types/realtime";

const VISIBLE_LIMIT = 5;

interface PresenceAvatarsProps {
  others: PresencePayload[];
  userEmail?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase() || "?";
}

export function CollaboratorAvatar({ person }: { person: PresencePayload }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(person.avatarUrl) && !imageFailed;

  return (
    <span
      className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold ring-2 ring-[var(--bg-surface)] transition-transform hover:scale-105"
      style={{
        backgroundColor: person.cursorColor,
        color: "#ffffff",
      }}
      title={person.displayName}
      aria-label={person.displayName}
    >
      {showImage ? (
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

export function PresenceAvatars({ others }: PresenceAvatarsProps) {
  const visible = others.slice(0, VISIBLE_LIMIT);
  const overflow = others.length - visible.length;

  if (visible.length === 0) {
    return null;
  }

  return (
    <ul className="flex items-center -space-x-1.5" aria-label="Collaborators in this room">
      {visible.map((person, index) => (
        <li key={person.userId} className="relative" style={{ zIndex: visible.length - index }}>
          <CollaboratorAvatar person={person} />
        </li>
      ))}
      {overflow > 0 && (
        <li className="relative" style={{ zIndex: 0 }}>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-[var(--bg-surface)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
            title={`${overflow} more`}
            aria-label={`${overflow} more collaborators`}
          >
            +{overflow}
          </span>
        </li>
      )}
    </ul>
  );
}
