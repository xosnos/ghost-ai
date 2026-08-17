"use client";

import { ViewportPortal } from "@xyflow/react";
import type { PresencePayload } from "@/types/realtime";

interface LiveCursorsProps {
  others: PresencePayload[];
}

function CursorPointer({ color, name }: { color: string; name: string }) {
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
        className="mt-3 ml-0.5 max-w-32 truncate rounded-xl px-1.5 py-0.5 text-[10px] font-medium leading-tight"
        style={{
          backgroundColor: color,
          color: "var(--bg-base)",
        }}
      >
        {name}
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
          <CursorPointer color={person.cursorColor} name={person.displayName} />
        </div>
      ))}
    </ViewportPortal>
  );
}
