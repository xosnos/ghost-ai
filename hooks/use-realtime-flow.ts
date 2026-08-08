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
  | { type: "edges:connect"; edge: CanvasEdge };

export interface UseRealtimeFlowReturn {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
}

export function useRealtimeFlow(
  channel: RealtimeChannel | null,
): UseRealtimeFlowReturn {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const skipBroadcast = useRef(false);

  const send = useCallback(
    (event: BroadcastEvent) => {
      if (!channel) return;
      channel.send({ type: "broadcast", event: "canvas:sync", payload: event });
    },
    [channel],
  );

  useEffect(() => {
    if (!channel) return;

    const handler = (payload: { payload: BroadcastEvent }) => {
      const event = payload.payload;
      skipBroadcast.current = true;
      if (event.type === "nodes:change") {
        setNodes((prev) => applyNodeChanges(event.changes, prev) as CanvasNode[]);
      } else if (event.type === "edges:change") {
        setEdges((prev) => applyEdgeChanges(event.changes, prev) as CanvasEdge[]);
      } else if (event.type === "edges:connect") {
        setEdges((prev) => addEdge(event.edge, prev) as CanvasEdge[]);
      }
    };

    channel.on("broadcast", { event: "canvas:sync" }, handler);
  }, [channel]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((prev) => applyNodeChanges(changes, prev) as CanvasNode[]);
      if (!skipBroadcast.current) {
        send({ type: "nodes:change", changes });
      }
      skipBroadcast.current = false;
    },
    [send],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((prev) => applyEdgeChanges(changes, prev) as CanvasEdge[]);
      if (!skipBroadcast.current) {
        send({ type: "edges:change", changes });
      }
      skipBroadcast.current = false;
    },
    [send],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const edge: CanvasEdge = {
        ...connection,
        id: `${connection.source}-${connection.target}-${Date.now()}`,
        type: "canvasEdge",
      };
      setEdges((prev) => addEdge(edge, prev) as CanvasEdge[]);
      send({ type: "edges:connect", edge });
    },
    [send],
  );

  return { nodes, edges, onNodesChange, onEdgesChange, onConnect };
}
