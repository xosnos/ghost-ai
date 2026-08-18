"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { asUnselected, withoutSharedSelection } from "@/lib/canvas-sync";
import {
  type CanvasNode,
  type CanvasEdge,
  normalizeCanvasNode,
  normalizeCanvasEdge,
  normalizeCanvasEdges,
} from "@/types/canvas";

export type BroadcastEvent =
  | { type: "nodes:change"; changes: NodeChange[] }
  | { type: "edges:change"; changes: EdgeChange[] }
  | { type: "edges:connect"; edge: CanvasEdge }
  | { type: "nodes:add"; node: CanvasNode }
  | { type: "edges:label"; edgeId: string; label: string }
  | { type: "canvas:append"; nodes: CanvasNode[]; edges: CanvasEdge[] };

function takeUniqueById<T extends { id: string }>(
  items: T[],
  existingIds: Set<string>,
): T[] {
  const unique: T[] = [];
  for (const item of items) {
    if (existingIds.has(item.id)) continue;
    existingIds.add(item.id);
    unique.push(item);
  }
  return unique;
}

function isBroadcastEvent(value: unknown): value is BroadcastEvent {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const event = value as Record<string, unknown>;
  switch (event.type) {
    case "nodes:change":
    case "edges:change":
      return (
        Array.isArray(event.changes) &&
        event.changes.every(
          (change) => isRecord(change) && typeof change.type === "string",
        )
      );
    case "edges:connect":
      return isRecord(event.edge) &&
        typeof event.edge.id === "string" &&
        typeof event.edge.source === "string" &&
        typeof event.edge.target === "string";
    case "nodes:add":
      return isCanvasNodeLike(event.node);
    case "edges:label":
      return typeof event.edgeId === "string" && typeof event.label === "string";
    case "canvas:append":
      return (
        Array.isArray(event.nodes) &&
        Array.isArray(event.edges) &&
        event.nodes.every(isCanvasNodeLike) &&
        event.edges.every(isCanvasEdgeLike)
      );
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCanvasNodeLike(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== "string") return false;
  return (
    isRecord(value.position) &&
    typeof value.position.x === "number" &&
    typeof value.position.y === "number" &&
    isRecord(value.data)
  );
}

function isCanvasEdgeLike(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.source === "string" &&
    typeof value.target === "string"
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
  loadInitialState: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useRealtimeFlow(
  channel: RealtimeChannel | null,
  incomingRef?: MutableRefObject<((event: unknown) => void) | null>,
  receivedEventRef?: MutableRefObject<boolean>,
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
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  useEffect(() => {
    const applyRemote = (raw: unknown) => {
      if (receivedEventRef) {
        receivedEventRef.current = true;
      }
      if (!isBroadcastEvent(raw)) return;
      if (raw.type === "nodes:change") {
        const changes = withoutSharedSelection(raw.changes);
        if (changes.length === 0) return;
        const next = applyNodeChanges(changes, nodesRef.current) as CanvasNode[];
        nodesRef.current = next;
        setNodes(next);
      } else if (raw.type === "edges:change") {
        const changes = withoutSharedSelection(raw.changes);
        if (changes.length === 0) return;
        const next = applyEdgeChanges(changes, edgesRef.current) as CanvasEdge[];
        edgesRef.current = next;
        setEdges(next);
      } else if (raw.type === "edges:connect") {
        const normalized = normalizeCanvasEdge(asUnselected(raw.edge), nodesRef.current);
        if (edgesRef.current.some((e) => e.id === normalized.id)) return;
        const next = addEdge(normalized, edgesRef.current) as CanvasEdge[];
        edgesRef.current = next;
        setEdges(next);
      } else if (raw.type === "edges:label") {
        const next = edgesRef.current.map((e) =>
          e.id === raw.edgeId
            ? { ...e, data: { ...e.data, label: raw.label } }
            : e,
        ) as CanvasEdge[];
        edgesRef.current = next;
        setEdges(next);
      } else if (raw.type === "nodes:add") {
        const normalizedNode = normalizeCanvasNode(asUnselected(raw.node));
        if (nodesRef.current.some((n) => n.id === normalizedNode.id)) return;
        const next = [...nodesRef.current, normalizedNode];
        nodesRef.current = next;
        setNodes(next);
      } else if (raw.type === "canvas:append") {
        const existingNodeIds = new Set(nodesRef.current.map((n) => n.id));
        const uniqueNodes = takeUniqueById(raw.nodes, existingNodeIds)
          .map(asUnselected)
          .map(normalizeCanvasNode);
        const nextNodes = [...nodesRef.current, ...uniqueNodes];

        const existingEdgeIds = new Set(edgesRef.current.map((e) => e.id));
        const uniqueEdges = normalizeCanvasEdges(
          takeUniqueById(raw.edges, existingEdgeIds).map(asUnselected),
          nextNodes
        );
        const nextEdges = [...edgesRef.current, ...uniqueEdges];

        nodesRef.current = nextNodes;
        edgesRef.current = nextEdges;
        snapshotRef.current = {
          nodes: nextNodes.map((n) => ({ ...n, data: { ...n.data } })),
          edges: nextEdges.map((e) => ({ ...e, data: { ...e.data } })),
        };
        setNodes(nextNodes);
        setEdges(nextEdges);
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
  }, [channel, incomingRef, receivedEventRef]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const synced = withoutSharedSelection(changes);
      if (synced.length > 0) {
        pushHistory(snapshotRef.current);
      }
      const next = applyNodeChanges(changes, nodesRef.current) as CanvasNode[];
      nodesRef.current = next;
      if (synced.length > 0) {
        snapshotRef.current = {
          nodes: next.map((n) => ({ ...n, data: { ...n.data } })),
          edges: snapshotRef.current.edges,
        };
      }
      setNodes(next);
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
      const next = applyEdgeChanges(changes, edgesRef.current) as CanvasEdge[];
      edgesRef.current = next;
      if (synced.length > 0) {
        snapshotRef.current = {
          nodes: snapshotRef.current.nodes,
          edges: next.map((e) => ({ ...e, data: { ...e.data } })),
        };
      }
      setEdges(next);
      if (synced.length > 0) {
        send({ type: "edges:change", changes: synced });
      }
    },
    [send, pushHistory],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const handleKey = `${connection.sourceHandle ?? ""}:${connection.targetHandle ?? ""}`;
      const edgeId = `${connection.source}-${connection.target}-${handleKey}`;
      if (edgesRef.current.some((e) => e.id === edgeId)) return;
      pushHistory(snapshotRef.current);
      const rawEdge: CanvasEdge = {
        ...connection,
        id: edgeId,
        type: "canvasEdge",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
        },
      };
      const edge = normalizeCanvasEdge(rawEdge, nodesRef.current);
      const next = addEdge(edge, edgesRef.current) as CanvasEdge[];
      edgesRef.current = next;
      snapshotRef.current = {
        nodes: snapshotRef.current.nodes,
        edges: next.map((e) => ({ ...e, data: { ...e.data } })),
      };
      setEdges(next);
      send({ type: "edges:connect", edge: asUnselected(edge) });
    },
    [send, pushHistory],
  );

  const addNode = useCallback(
    (node: CanvasNode) => {
      const normalizedNode = normalizeCanvasNode(node);
      if (nodesRef.current.some((n) => n.id === normalizedNode.id)) return;
      pushHistory(snapshotRef.current);
      const next = [...nodesRef.current, normalizedNode];
      nodesRef.current = next;
      snapshotRef.current = {
        nodes: next.map((n) => ({ ...n, data: { ...n.data } })),
        edges: snapshotRef.current.edges,
      };
      setNodes(next);
      send({ type: "nodes:add", node: asUnselected(normalizedNode) });
    },
    [send, pushHistory],
  );

  const updateEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      pushHistory(snapshotRef.current);
      const next = edgesRef.current.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, label } } : e,
      ) as CanvasEdge[];
      edgesRef.current = next;
      snapshotRef.current = {
        nodes: snapshotRef.current.nodes,
        edges: next.map((e) => ({ ...e, data: { ...e.data } })),
      };
      setEdges(next);
      send({ type: "edges:label", edgeId, label });
    },
    [send, pushHistory],
  );

  const appendTemplate = useCallback(
    (newNodes: CanvasNode[], newEdges: CanvasEdge[]) => {
      pushHistory(snapshotRef.current);
      const existingNodeIds = new Set(nodesRef.current.map((n) => n.id));
      const uniqueNodes = takeUniqueById(newNodes, existingNodeIds).map(
        normalizeCanvasNode,
      );
      const nextNodes = [...nodesRef.current, ...uniqueNodes];

      const existingEdgeIds = new Set(edgesRef.current.map((e) => e.id));
      const uniqueEdges = takeUniqueById(newEdges, existingEdgeIds).map((e) =>
        normalizeCanvasEdge(e, nextNodes),
      );
      const nextEdges = [...edgesRef.current, ...uniqueEdges];

      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      snapshotRef.current = {
        nodes: nextNodes.map((n) => ({ ...n, data: { ...n.data } })),
        edges: nextEdges.map((e) => ({ ...e, data: { ...e.data } })),
      };
      setNodes(nextNodes);
      setEdges(nextEdges);
      send({
        type: "canvas:append",
        nodes: uniqueNodes.map(asUnselected),
        edges: uniqueEdges.map(asUnselected),
      });
    },
    [send, pushHistory],
  );

  const loadInitialState = useCallback(
    (initialNodes: CanvasNode[], initialEdges: CanvasEdge[]) => {
      const normalizedNodes = initialNodes.map(normalizeCanvasNode);
      const normalizedEdges = normalizeCanvasEdges(initialEdges, normalizedNodes);
      setNodes(normalizedNodes);
      setEdges(normalizedEdges);
      nodesRef.current = normalizedNodes;
      edgesRef.current = normalizedEdges;
      snapshotRef.current = {
        nodes: normalizedNodes.map((n) => ({ ...n, data: { ...n.data } })),
        edges: normalizedEdges.map((e) => ({ ...e, data: { ...e.data } })),
      };
      past.current = [];
      future.current = [];
      setCanUndo(false);
      setCanRedo(false);
    },
    []
  );

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const previous = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [snapshotRef.current, ...future.current];
    snapshotRef.current = previous;
    setNodes(previous.nodes);
    setEdges(previous.edges);
    nodesRef.current = previous.nodes;
    edgesRef.current = previous.edges;
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
    nodesRef.current = next.nodes;
    edgesRef.current = next.edges;
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
  }, []);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateEdgeLabel,
    appendTemplate,
    loadInitialState,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
