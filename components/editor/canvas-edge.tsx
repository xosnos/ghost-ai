"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useEdgeLabelUpdater } from "@/components/editor/edge-label-context";

const REST_OPACITY = 0.55;
const ACTIVE_OPACITY = 1;
const HIT_PADDING = 16;

function CanvasEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateEdgeLabel = useEdgeLabelUpdater();

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const label = (data?.label as string | undefined) ?? "";
  const active = hovered || selected;
  const opacity = active ? ACTIVE_OPACITY : REST_OPACITY;
  const stroke = active ? "var(--text-secondary)" : "var(--text-muted)";
  const strokeWidth = active ? 2 : 1.5;

  const commitLabel = useCallback(
    (value: string) => {
      if (updateEdgeLabel) {
        updateEdgeLabel(id, value);
      }
    },
    [id, updateEdgeLabel],
  );

  const startEditing = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setDraft(label);
      setEditing(true);
    },
    [label],
  );

  const stopEditing = useCallback(() => {
    setEditing(false);
    commitLabel(draft.trim());
  }, [commitLabel, draft]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    [],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        stopEditing();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditing(false);
      }
      e.stopPropagation();
    },
    [stopEditing],
  );

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  return (
    <>
      {/* Invisible wide path for easier hover/click */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={strokeWidth + HIT_PADDING}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={startEditing}
        style={{ cursor: "pointer" }}
      />
      {/* Visible edge */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerEnd="url(#canvas-edge-arrow)"
        opacity={opacity}
        style={{ pointerEvents: "none", transition: "opacity 150ms ease, stroke 150ms ease" }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "none",
          }}
          className="nodrag nopan"
        >
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={handleChange}
              onBlur={stopEditing}
              onKeyDown={handleKeyDown}
              className="nodrag nopan nowheel rounded-full border px-2 py-0.5 text-xs outline-none"
              style={{
                backgroundColor: "var(--bg-elevated)",
                borderColor: "var(--accent-primary)",
                color: "var(--text-primary)",
                minWidth: 60,
                width: `${Math.max(draft.length, 4)}ch`,
                pointerEvents: "all",
              }}
            />
          ) : label ? (
            <span
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onDoubleClick={startEditing}
              className="cursor-pointer rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                pointerEvents: "all",
              }}
            >
              {label}
            </span>
          ) : (
            <span
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onDoubleClick={startEditing}
              className="cursor-pointer rounded-full px-2 py-0.5 text-xs italic"
              style={{
                color: "var(--text-faint)",
                pointerEvents: "all",
                opacity: active ? 0.7 : 0,
                transition: "opacity 150ms ease",
              }}
            >
              + label
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const CanvasEdgeComponent = memo(CanvasEdgeInner);
