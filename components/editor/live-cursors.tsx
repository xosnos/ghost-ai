"use client";

import { ViewportPortal } from "@xyflow/react";
import { Loader2 } from "lucide-react";
import type { PresencePayload } from "@/types/realtime";

interface LiveCursorsProps {
  others: PresencePayload[];
}

function CursorPointer({
  color,
  name,
  thinking,
}: {
  color: string;
  name: string;
  thinking?: boolean;
}) {
  return (
    <div className="pointer-events-none flex items-start">
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1.2 1.2 1.5 16.4 5.6 12.8 8.4 19.1 10.6 18.2 7.7 11.7 13.8 11.6 1.2 1.2Z"
          fill={color}
          stroke="var(--bg-base)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="mt-3 ml-0.5 inline-flex max-w-40 items-center gap-1 truncate rounded-xl px-1.5 py-0.5 text-[10px] font-medium leading-tight shadow-sm"
        style={{
          backgroundColor: color,
          color: "var(--bg-base)",
        }}
      >
        {thinking && (
          <Loader2
            className="h-2.5 w-2.5 animate-spin shrink-0"
            role="img"
            aria-label="Thinking"
          />
        )}
        <span className="truncate">{name}</span>
      </span>
    </div>
  );
}

export function LiveCursors({ others }: LiveCursorsProps) {
  const cursors = others.filter(
    (person): person is PresencePayload & { cursor: { x: number; y: number } } =>
      person.cursor !== null,
  );

  if (cursors.length === 0) return null;

  return (
    <ViewportPortal>
      {cursors.map((person) => (
        <div
          key={person.userId}
          className="pointer-events-none absolute top-0 left-0"
          style={{
            transform: `translate(${person.cursor.x}px, ${person.cursor.y}px)`,
            zIndex: 1000,
          }}
        >
          <CursorPointer
            color={person.cursorColor}
            name={person.displayName}
            thinking={person.thinking}
          />
        </div>
      ))}
    </ViewportPortal>
  );
}
