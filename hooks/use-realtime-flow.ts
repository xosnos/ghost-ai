"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import type { CanvasNode, CanvasEdge } from "@/types/canvas";

type BroadcastEvent =
  | { type: "nodes:change"; changes: NodeChange[] }
  | { type: "edges:change"; changes: EdgeChange[] }
  | { type: "edges:connect"; edge: CanvasEdge }
  | { type: "nodes:add"; node: CanvasNode }
  | { type: "edges:label"; edgeId: string; label: string }
  | { type: "canvas:replace"; nodes: CanvasNode[]; edges: CanvasEdge[] };

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
  loadTemplate: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useRealtimeFlow(
  channel: RealtimeChannel | null,
): UseRealtimeFlowReturn {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const skipBroadcast = useRef(false);
  const skipHistory = useRef(false);

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
  const captureSnapshot = useCallback(() => {
    snapshotRef.current = {
      nodes: nodes.map((n) => ({ ...n, data: { ...n.data } })),
      edges: edges.map((e) => ({ ...e, data: { ...e.data } })),
    };
  }, [nodes, edges]);

  useEffect(() => {
    if (!channel) return;

    const handler = (payload: { payload: BroadcastEvent }) => {
      const event = payload.payload;
      skipBroadcast.current = true;
      skipHistory.current = true;
      if (event.type === "nodes:change") {
        setNodes((prev) => applyNodeChanges(event.changes, prev) as CanvasNode[]);
      } else if (event.type === "edges:change") {
        setEdges((prev) => applyEdgeChanges(event.changes, prev) as CanvasEdge[]);
      } else if (event.type === "edges:connect") {
        setEdges((prev) => addEdge(event.edge, prev) as CanvasEdge[]);
      } else if (event.type === "edges:label") {
        setEdges((prev) =>
          prev.map((e) =>
            e.id === event.edgeId
              ? { ...e, data: { ...e.data, label: event.label } }
              : e,
          ) as CanvasEdge[],
        );
      } else if (event.type === "nodes:add") {
        setNodes((prev) => [...prev, event.node]);
      } else if (event.type === "canvas:replace") {
        setNodes(event.nodes);
        setEdges(event.edges);
      }
    };

    channel.on("broadcast", { event: "canvas:sync" }, handler);
  }, [channel]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!skipHistory.current) {
        pushHistory(snapshotRef.current);
      }
      setNodes((prev) => {
        const next = applyNodeChanges(changes, prev) as CanvasNode[];
        snapshotRef.current = {
          nodes: next.map((n) => ({ ...n, data: { ...n.data } })),
          edges: snapshotRef.current.edges,
        };
        return next;
      });
      if (!skipBroadcast.current) {
        send({ type: "nodes:change", changes });
      }
      skipBroadcast.current = false;
      skipHistory.current = false;
    },
    [send, pushHistory],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (!skipHistory.current) {
        pushHistory(snapshotRef.current);
      }
      setEdges((prev) => {
        const next = applyEdgeChanges(changes, prev) as CanvasEdge[];
        snapshotRef.current = {
          nodes: snapshotRef.current.nodes,
          edges: next.map((e) => ({ ...e, data: { ...e.data } })),
        };
        return next;
      });
      if (!skipBroadcast.current) {
        send({ type: "edges:change", changes });
      }
      skipBroadcast.current = false;
      skipHistory.current = false;
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
      send({ type: "edges:connect", edge });
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
      send({ type: "nodes:add", node });
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

  const loadTemplate = useCallback(
    (newNodes: CanvasNode[], newEdges: CanvasEdge[]) => {
      pushHistory(snapshotRef.current);
      setNodes(newNodes);
      setEdges(newEdges);
      snapshotRef.current = {
        nodes: newNodes.map((n) => ({ ...n, data: { ...n.data } })),
        edges: newEdges.map((e) => ({ ...e, data: { ...e.data } })),
      };
      send({ type: "canvas:replace", nodes: newNodes, edges: newEdges });
    },
    [send, pushHistory],
  );

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const previous = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [snapshotRef.current, ...future.current];
    snapshotRef.current = previous;
    skipBroadcast.current = true;
    skipHistory.current = true;
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
    skipBroadcast.current = true;
    skipHistory.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
  }, []);

  return { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, updateEdgeLabel, loadTemplate, undo, redo, canUndo, canRedo };
}
