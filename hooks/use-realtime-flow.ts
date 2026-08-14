"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { asUnselected, withoutSharedSelection } from "@/lib/canvas-sync";
import type { CanvasNode, CanvasEdge } from "@/types/canvas";

export type BroadcastEvent =
  | { type: "nodes:change"; changes: NodeChange[] }
  | { type: "edges:change"; changes: EdgeChange[] }
  | { type: "edges:connect"; edge: CanvasEdge }
  | { type: "nodes:add"; node: CanvasNode }
  | { type: "edges:label"; edgeId: string; label: string }
  | { type: "canvas:append"; nodes: CanvasNode[]; edges: CanvasEdge[] };

function isBroadcastEvent(value: unknown): value is BroadcastEvent {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const type = (value as { type: unknown }).type;
  return (
    type === "nodes:change" ||
    type === "edges:change" ||
    type === "edges:connect" ||
    type === "nodes:add" ||
    type === "edges:label" ||
    type === "canvas:append"
  );
}

interface HistorySnapshot {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const HISTORY_LIMIT = 50;

export interface UseRealtimeFlowReturn {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: CanvasNode) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;
  appendTemplate: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useRealtimeFlow(
  channel: RealtimeChannel | null,
  incomingRef?: MutableRefObject<((event: unknown) => void) | null>,
): UseRealtimeFlowReturn {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);

  const past = useRef<HistorySnapshot[]>([]);
  const future = useRef<HistorySnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const send = useCallback(
    (event: BroadcastEvent) => {
      if (!channel) return;
      channel.send({ type: "broadcast", event: "canvas:sync", payload: event });
    },
    [channel],
  );

  const pushHistory = useCallback((snapshot: HistorySnapshot) => {
    past.current = [...past.current.slice(-HISTORY_LIMIT + 1), snapshot];
    future.current = [];
    setCanUndo(past.current.length > 0);
    setCanRedo(false);
  }, []);

  const snapshotRef = useRef<HistorySnapshot>({ nodes: [], edges: [] });

  useEffect(() => {
    const applyRemote = (raw: unknown) => {
      if (!isBroadcastEvent(raw)) return;
      if (raw.type === "nodes:change") {
        const changes = withoutSharedSelection(raw.changes);
        if (changes.length === 0) return;
        setNodes((prev) => applyNodeChanges(changes, prev) as CanvasNode[]);
      } else if (raw.type === "edges:change") {
        const changes = withoutSharedSelection(raw.changes);
        if (changes.length === 0) return;
        setEdges((prev) => applyEdgeChanges(changes, prev) as CanvasEdge[]);
      } else if (raw.type === "edges:connect") {
        setEdges((prev) => addEdge(asUnselected(raw.edge), prev) as CanvasEdge[]);
      } else if (raw.type === "edges:label") {
        setEdges((prev) =>
          prev.map((e) =>
            e.id === raw.edgeId
              ? { ...e, data: { ...e.data, label: raw.label } }
              : e,
          ) as CanvasEdge[],
        );
      } else if (raw.type === "nodes:add") {
        setNodes((prev) => [...prev, asUnselected(raw.node)]);
      } else if (raw.type === "canvas:append") {
        setNodes((prev) => [...prev, ...raw.nodes.map(asUnselected)]);
        setEdges((prev) => [...prev, ...raw.edges.map(asUnselected)]);
      }
    };

    if (incomingRef) {
      incomingRef.current = applyRemote;
      return () => {
        incomingRef.current = null;
      };
    }

    if (!channel) return;
    const handler = (payload: { payload?: unknown }) => {
      applyRemote(payload.payload);
    };
    channel.on("broadcast", { event: "canvas:sync" }, handler);
  }, [channel, incomingRef]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const synced = withoutSharedSelection(changes);
      if (synced.length > 0) {
        pushHistory(snapshotRef.current);
      }
      setNodes((prev) => {
        const next = applyNodeChanges(changes, prev) as CanvasNode[];
        if (synced.length > 0) {
          snapshotRef.current = {
            nodes: next.map((n) => ({ ...n, data: { ...n.data } })),
            edges: snapshotRef.current.edges,
          };
        }
        return next;
      });
      if (synced.length > 0) {
        send({ type: "nodes:change", changes: synced });
      }
    },
    [send, pushHistory],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const synced = withoutSharedSelection(changes);
      if (synced.length > 0) {
        pushHistory(snapshotRef.current);
      }
      setEdges((prev) => {
        const next = applyEdgeChanges(changes, prev) as CanvasEdge[];
        if (synced.length > 0) {
          snapshotRef.current = {
            nodes: snapshotRef.current.nodes,
            edges: next.map((e) => ({ ...e, data: { ...e.data } })),
          };
        }
        return next;
      });
      if (synced.length > 0) {
        send({ type: "edges:change", changes: synced });
      }
    },
    [send, pushHistory],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      pushHistory(snapshotRef.current);
      const edge: CanvasEdge = {
        ...connection,
        id: `${connection.source}-${connection.target}-${Date.now()}`,
      };
      setEdges((prev) => {
        const next = addEdge(edge, prev) as CanvasEdge[];
        snapshotRef.current = {
          nodes: snapshotRef.current.nodes,
          edges: next.map((e) => ({ ...e, data: { ...e.data } })),
        };
        return next;
      });
      send({ type: "edges:connect", edge: asUnselected(edge) });
    },
    [send, pushHistory],
  );

  const addNode = useCallback(
    (node: CanvasNode) => {
      pushHistory(snapshotRef.current);
      setNodes((prev) => {
        const next = [...prev, node];
        snapshotRef.current = {
          nodes: next.map((n) => ({ ...n, data: { ...n.data } })),
          edges: snapshotRef.current.edges,
        };
        return next;
      });
      send({ type: "nodes:add", node: asUnselected(node) });
    },
    [send, pushHistory],
  );

  const updateEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      pushHistory(snapshotRef.current);
      setEdges((prev) => {
        const next = prev.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...e.data, label } }
            : e,
        ) as CanvasEdge[];
        snapshotRef.current = {
          nodes: snapshotRef.current.nodes,
          edges: next.map((e) => ({ ...e, data: { ...e.data } })),
        };
        return next;
      });
      send({ type: "edges:label", edgeId, label });
    },
    [send, pushHistory],
  );

  const appendTemplate = useCallback(
    (newNodes: CanvasNode[], newEdges: CanvasEdge[]) => {
      pushHistory(snapshotRef.current);
      setNodes((prev) => [...prev, ...newNodes]);
      setEdges((prev) => [...prev, ...newEdges]);
      snapshotRef.current = {
        nodes: [...snapshotRef.current.nodes, ...newNodes].map((n) => ({
          ...n,
          data: { ...n.data },
        })),
        edges: [...snapshotRef.current.edges, ...newEdges].map((e) => ({
          ...e,
          data: { ...e.data },
        })),
      };
      send({
        type: "canvas:append",
        nodes: newNodes.map(asUnselected),
        edges: newEdges.map(asUnselected),
      });
    },
    [send, pushHistory],
  );

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const previous = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [snapshotRef.current, ...future.current];
    snapshotRef.current = previous;
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
  }, []);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const next = future.current[0];
    future.current = future.current.slice(1);
    past.current = [...past.current, snapshotRef.current];
    snapshotRef.current = next;
    setNodes(next.nodes);
    setEdges(next.edges);
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
  }, []);

  return { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, updateEdgeLabel, appendTemplate, undo, redo, canUndo, canRedo };
}
