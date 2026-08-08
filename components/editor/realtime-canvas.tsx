"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlowProvider,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRealtimeFlow } from "@/hooks/use-realtime-flow";
import type { CanvasNode, CanvasEdge } from "@/types/canvas";

interface RealtimeCanvasProps {
  channel: RealtimeChannel;
}

function FlowCanvas({ channel }: RealtimeCanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    useRealtimeFlow(channel);

  const nodeTypes = useMemo<NodeTypes>(() => ({}), []);
  const edgeTypes = useMemo<EdgeTypes>(() => ({}), []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="var(--border-default)"
      />
      <MiniMap
        pannable
        zoomable
        maskColor="rgba(8, 8, 9, 0.7)"
        nodeColor="#2a2a30"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
        }}
      />
    </ReactFlow>
  );
}

export function RealtimeCanvas({ channel }: RealtimeCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas channel={channel} />
    </ReactFlowProvider>
  );
}

export type { CanvasNode, CanvasEdge };
