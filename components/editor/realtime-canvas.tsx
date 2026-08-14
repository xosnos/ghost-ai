"use client";

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
  MarkerType,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRealtimeFlow } from "@/hooks/use-realtime-flow";
import { useRealtimePresence } from "@/hooks/use-realtime-presence";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ShapePanel } from "@/components/editor/shape-panel";
import { CanvasControlBar } from "@/components/editor/canvas-control-bar";
import { CanvasNodeComponent } from "@/components/editor/canvas-node";
import { CanvasEdgeComponent } from "@/components/editor/canvas-edge";
import { PresenceAvatars } from "@/components/editor/presence-avatars";
import { LiveCursors } from "@/components/editor/live-cursors";
import { EdgeLabelContext } from "@/components/editor/edge-label-context";
import { useTemplateImportRef } from "@/components/editor/template-import-context";
import { DEFAULT_NODE_COLOR, type CanvasNode, type CanvasEdge, type NodeShape } from "@/types/canvas";
import type { CanvasTemplate } from "@/components/editor/starter-templates";
import type { PresencePayload } from "@/types/realtime";

interface CanvasUser {
  id: string;
  email?: string;
  user_metadata?: { avatar_url?: string; display_name?: string } | null;
}

interface RealtimeCanvasProps {
  channel: RealtimeChannel;
  user: CanvasUser;
  presenceEntries: PresencePayload[];
  incomingBroadcastRef: MutableRefObject<((event: unknown) => void) | null>;
}

let nodeIdCounter = 0;

function generateNodeId(shape: NodeShape): string {
  nodeIdCounter += 1;
  return `${shape}-${Date.now()}-${nodeIdCounter}`;
}

function FlowCanvas({
  channel,
  user,
  presenceEntries,
  incomingBroadcastRef,
}: RealtimeCanvasProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateEdgeLabel,
    appendTemplate,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useRealtimeFlow(channel, incomingBroadcastRef);
  const { others, updateCursor } = useRealtimePresence(
    channel,
    user,
    presenceEntries,
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const importRef = useTemplateImportRef();

  const handleZoomIn = useCallback(() => zoomIn({ duration: 300 }), [zoomIn]);
  const handleZoomOut = useCallback(() => zoomOut({ duration: 300 }), [zoomOut]);
  const handleFitView = useCallback(() => fitView({ duration: 300 }), [fitView]);

  const handleImportTemplate = useCallback(
    (template: CanvasTemplate) => {
      const suffix = `${Date.now()}`;
      const idMap = new Map<string, string>();
      const newNodes = template.nodes.map((n) => {
        const newId = `${n.id}-${suffix}`;
        idMap.set(n.id, newId);
        return { ...n, id: newId, data: { ...n.data } } as unknown as CanvasNode;
      });
      const newEdges = template.edges.map((e) => {
        const newId = `${e.id}-${suffix}`;
        return {
          ...e,
          id: newId,
          source: idMap.get(e.source) ?? e.source,
          target: idMap.get(e.target) ?? e.target,
          data: { ...e.data },
        } as unknown as CanvasEdge;
      });
      appendTemplate(newNodes, newEdges);
      requestAnimationFrame(() => fitView({ duration: 400, padding: 0.2 }));
    },
    [appendTemplate, fitView],
  );

  useEffect(() => {
    if (!importRef) return;
    importRef.current = handleImportTemplate;
    return () => {
      importRef.current = null;
    };
  }, [importRef, handleImportTemplate]);

  useKeyboardShortcuts({
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    undo,
    redo,
  });

  const nodeTypes = useMemo<NodeTypes>(
    () => ({ canvasNode: CanvasNodeComponent }),
    [],
  );
  const edgeTypes = useMemo<EdgeTypes>(() => ({ canvasEdge: CanvasEdgeComponent }), []);

  const defaultEdgeOptions = useMemo(
    () => ({
      type: "canvasEdge",
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--text-muted)", width: 16, height: 16 },
    }),
    [],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/reactflow-shape");
      if (!raw) return;

      let payload: { shape: NodeShape; width: number; height: number };
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: CanvasNode = {
        id: generateNodeId(payload.shape),
        type: "canvasNode",
        position,
        width: payload.width,
        height: payload.height,
        data: {
          label: "",
          color: DEFAULT_NODE_COLOR,
          shape: payload.shape,
        },
      } as unknown as CanvasNode;

      addNode(newNode);
    },
    [addNode, screenToFlowPosition],
  );

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      updateCursor(position);
    },
    [screenToFlowPosition, updateCursor],
  );

  const onMouseLeave = useCallback(() => {
    updateCursor(null);
  }, [updateCursor]);

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <EdgeLabelContext.Provider value={updateEdgeLabel}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onPaneMouseMove={onMouseMove}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
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
        <ShapePanel />
        <CanvasControlBar
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitView={handleFitView}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        <PresenceAvatars
          others={others}
          userEmail={user.email ?? ""}
        />
        <LiveCursors others={others} />
      </ReactFlow>
      </EdgeLabelContext.Provider>
    </div>
  );
}

export function RealtimeCanvas({
  channel,
  user,
  presenceEntries,
  incomingBroadcastRef,
}: RealtimeCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas
        channel={channel}
        user={user}
        presenceEntries={presenceEntries}
        incomingBroadcastRef={incomingBroadcastRef}
      />
    </ReactFlowProvider>
  );
}

export type { CanvasNode, CanvasEdge };
