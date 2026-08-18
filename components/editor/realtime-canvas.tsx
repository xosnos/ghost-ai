"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
  ConnectionLineType,
  MarkerType,
  type NodeTypes,
  type EdgeTypes,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRealtimeFlow } from "@/hooks/use-realtime-flow";
import { useRealtimePresence } from "@/hooks/use-realtime-presence";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useCanvasAutosave } from "@/hooks/use-canvas-autosave";
import { useCanvasSave } from "@/components/editor/canvas-save-context";
import { useCanvasPresence } from "@/components/editor/canvas-presence-context";
import { useAiStatus } from "@/components/editor/ai-status-context";
import { useAiChat } from "@/components/editor/ai-chat-context";
import { useAiTaskStatus } from "@/hooks/use-ai-task-status";
import { useRealtimeChat } from "@/hooks/use-realtime-chat";
import { ShapePanel } from "@/components/editor/shape-panel";
import { CanvasControlBar } from "@/components/editor/canvas-control-bar";
import { CanvasNodeComponent } from "@/components/editor/canvas-node";
import { CanvasEdgeComponent } from "@/components/editor/canvas-edge";
import { LiveCursors } from "@/components/editor/live-cursors";
import { EdgeLabelContext } from "@/components/editor/edge-label-context";
import { RemoteSelectionProvider } from "@/components/editor/remote-selection-context";
import { useTemplateImportRef } from "@/components/editor/template-import-context";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";
import { DEFAULT_NODE_COLOR, SHAPE_DEFAULT_SIZES, type CanvasNode, type CanvasEdge, type NodeShape } from "@/types/canvas";
import type { CanvasTemplate } from "@/components/editor/starter-templates";
import type {
  PresencePayload,
  CursorMovePayload,
  SelectionChangePayload,
} from "@/types/realtime";
import type { AiStatusMessage, AiChatMessage } from "@/types/tasks";

interface CanvasUser {
  id: string;
  email?: string;
  user_metadata?: { avatar_url?: string; display_name?: string } | null;
}

interface RealtimeCanvasProps {
  projectId: string;
  channel: RealtimeChannel;
  user: CanvasUser;
  presenceEntries: PresencePayload[];
  incomingBroadcastRef: MutableRefObject<((event: unknown) => void) | null>;
  incomingCursorRef: MutableRefObject<((payload: CursorMovePayload) => void) | null>;
  incomingSelectionRef: MutableRefObject<
    ((payload: SelectionChangePayload) => void) | null
  >;
  incomingAiStatusRef?: MutableRefObject<
    ((payload: AiStatusMessage) => void) | null
  >;
  incomingAiChatRef?: MutableRefObject<
    ((payload: AiChatMessage) => void) | null
  >;
}

let nodeIdCounter = 0;

function generateNodeId(shape: NodeShape): string {
  nodeIdCounter += 1;
  return `${shape}-${Date.now()}-${nodeIdCounter}`;
}

function FlowCanvas({
  projectId,
  channel,
  user,
  presenceEntries,
  incomingBroadcastRef,
  incomingCursorRef,
  incomingSelectionRef,
  incomingAiStatusRef,
  incomingAiChatRef,
}: RealtimeCanvasProps) {
  const { resolvedTheme } = useTheme();
  const receivedBroadcastRef = useRef(false);
  const {
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
  } = useRealtimeFlow(
    channel,
    incomingBroadcastRef,
    receivedBroadcastRef,
  );

  const [isInitialized, setIsInitialized] = useState(false);
  const canvasSave = useCanvasSave();
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const autosave = useCanvasAutosave({
    projectId,
    nodes,
    edges,
    isInitialized,
  });

  // Keep editor chrome save context in sync
  useEffect(() => {
    if (!canvasSave) return;
    canvasSave.setStatus(autosave.status);
  }, [autosave.status, canvasSave]);

  useEffect(() => {
    if (!canvasSave) return;
    canvasSave.registerSaveHandler(autosave.saveNow);
    return () => {
      canvasSave.registerSaveHandler(null);
    };
  }, [autosave.saveNow, canvasSave]);

  const addLocalMessageRef = useRef<((msg: AiChatMessage) => void) | null>(null);

  const handleRunFailed = useCallback(
    (runId: string, errorMessage?: string | null) => {
      const sanitizedMsg = errorMessage
        ? errorMessage.slice(0, 500)
        : "AI design generation encountered an issue. Please try again.";
      addLocalMessageRef.current?.({
        id: `err-${runId}`,
        sender: { id: "ghost-ai", name: "Ghost AI", avatarUrl: null },
        role: "assistant",
        content: `Generation failed: ${sanitizedMsg}`,
        timestamp: new Date().toISOString(),
        runId,
      });
    },
    []
  );

  const aiTaskStatus = useAiTaskStatus({
    projectId,
    channel,
    incomingAiStatusRef,
    onRunFailed: handleRunFailed,
  });
  const aiStatusContext = useAiStatus();

  // Keep editor chrome AI status context in sync
  useEffect(() => {
    if (!aiStatusContext) return;
    aiStatusContext.setIsAiActive(aiTaskStatus.isAiActive);
    aiStatusContext.setLatestStatus(aiTaskStatus.latestStatus);
    aiStatusContext.setActiveTaskRun(aiTaskStatus.activeTaskRun);
  }, [
    aiTaskStatus.isAiActive,
    aiTaskStatus.latestStatus,
    aiTaskStatus.activeTaskRun,
    aiStatusContext,
  ]);

  useEffect(() => {
    if (!aiStatusContext?.registerTrackRun) return;
    aiStatusContext.registerTrackRun(aiTaskStatus.trackRun);
    return () => {
      aiStatusContext.registerTrackRun?.(null);
    };
  }, [aiTaskStatus.trackRun, aiStatusContext]);

  const realtimeChat = useRealtimeChat({
    projectId,
    channel,
    user,
    incomingAiChatRef,
    trackRun: aiTaskStatus.trackRun,
    isAiActive: aiTaskStatus.isAiActive,
  });

  useEffect(() => {
    addLocalMessageRef.current = realtimeChat.addLocalMessage;
  }, [realtimeChat.addLocalMessage]);

  const aiChatContext = useAiChat();

  // Keep editor chrome AI chat context in sync
  useEffect(() => {
    if (!aiChatContext) return;
    aiChatContext.setMessages(realtimeChat.messages);
  }, [realtimeChat.messages, aiChatContext]);

  useEffect(() => {
    if (!aiChatContext?.setSendError) return;
    aiChatContext.setSendError(realtimeChat.sendError);
  }, [realtimeChat.sendError, aiChatContext]);

  useEffect(() => {
    if (!aiChatContext) return;
    aiChatContext.registerSendHandler(realtimeChat.sendMessage);
    return () => {
      aiChatContext.registerSendHandler(null);
    };
  }, [realtimeChat.sendMessage, aiChatContext]);

  useEffect(() => {
    if (!aiChatContext?.registerAddMessage) return;
    aiChatContext.registerAddMessage(realtimeChat.addLocalMessage);
    return () => {
      aiChatContext.registerAddMessage?.(null);
    };
  }, [realtimeChat.addLocalMessage, aiChatContext]);

  const { others, remoteHighlights, updateCursor, updateSelection, updateThinking } =
    useRealtimePresence(
      channel,
      user,
      presenceEntries,
      incomingCursorRef,
      incomingSelectionRef,
    );

  useEffect(() => {
    updateThinking(aiTaskStatus.isAiActive);
  }, [aiTaskStatus.isAiActive, updateThinking]);

  const canvasPresence = useCanvasPresence();

  useEffect(() => {
    if (!canvasPresence) return;
    canvasPresence.setOthers(others);
  }, [others, canvasPresence]);

  useEffect(() => {
    return () => {
      canvasPresence?.setOthers([]);
    };
  }, [canvasPresence]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const importRef = useTemplateImportRef();

  // Load saved canvas state on mount if channel is empty
  useEffect(() => {
    let cancelled = false;

    async function loadSavedCanvas() {
      // Check if channel already has active nodes or edges from broadcast
      if (
        receivedBroadcastRef.current ||
        nodesRef.current.length > 0 ||
        edgesRef.current.length > 0
      ) {
        if (!cancelled) setIsInitialized(true);
        return;
      }

      try {
        const res = await fetch(`/api/projects/${projectId}/canvas`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          // If channel is still empty and saved data has content, load it
          if (
            (data.nodes?.length > 0 || data.edges?.length > 0) &&
            nodesRef.current.length === 0 &&
            edgesRef.current.length === 0
          ) {
            loadInitialState(data.nodes || [], data.edges || []);
            requestAnimationFrame(() => {
              fitView({ duration: 400, padding: 0.2 });
            });
          }
        }
      } catch (err) {
        console.error("[RealtimeCanvas] Failed to load saved canvas:", err);
      } finally {
        if (!cancelled) {
          setIsInitialized(true);
        }
      }
    }

    void loadSavedCanvas();

    return () => {
      cancelled = true;
    };
  }, [projectId, loadInitialState, fitView]);

  const handleZoomIn = useCallback(() => zoomIn({ duration: 300 }), [zoomIn]);
  const handleZoomOut = useCallback(() => zoomOut({ duration: 300 }), [zoomOut]);
  const handleFitView = useCallback(() => fitView({ duration: 300 }), [fitView]);

  const handleImportTemplate = useCallback(
    (template: CanvasTemplate) => {
      const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const idMap = new Map<string, string>();
      const newNodes = template.nodes.map((n) => {
        const newId = `${n.id}-${suffix}`;
        idMap.set(n.id, newId);
        const defaults = SHAPE_DEFAULT_SIZES[n.data.shape] ?? SHAPE_DEFAULT_SIZES.rectangle;
        const width = n.width ?? defaults.width;
        const height = n.height ?? defaults.height;
        return {
          ...n,
          id: newId,
          width,
          height,
          style: { ...n.style, width, height },
          initialWidth: n.initialWidth ?? width,
          initialHeight: n.initialHeight ?? height,
          data: { ...n.data },
        } as unknown as CanvasNode;
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
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--text-secondary)",
        width: 16,
        height: 16,
      },
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

      // Convert client drop coordinates to flow coordinates
      const centerPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Center the node at the drop coordinate
      const position = {
        x: centerPosition.x - payload.width / 2,
        y: centerPosition.y - payload.height / 2,
      };

      const isFirstNode = nodes.length === 0;

      const newNode: CanvasNode = {
        id: generateNodeId(payload.shape),
        type: "canvasNode",
        position,
        width: payload.width,
        height: payload.height,
        style: { width: payload.width, height: payload.height },
        initialWidth: payload.width,
        initialHeight: payload.height,
        data: {
          label: "",
          color: DEFAULT_NODE_COLOR,
          shape: payload.shape,
        },
      } as unknown as CanvasNode;

      addNode(newNode);

      if (isFirstNode) {
        requestAnimationFrame(() => {
          fitView({ duration: 400, padding: 0.3, maxZoom: 1 });
        });
      }
    },
    [addNode, fitView, nodes.length, screenToFlowPosition],
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

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      updateSelection(selectedNodes.map((node) => node.id));
    },
    [updateSelection],
  );

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <EdgeLabelContext.Provider value={updateEdgeLabel}>
      <RemoteSelectionProvider value={remoteHighlights}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onPaneMouseMove={onMouseMove}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{
          stroke: "var(--accent-primary)",
          strokeWidth: 2,
        }}
        connectionRadius={25}
        connectionMode={ConnectionMode.Loose}
        fitView
        proOptions={{ hideAttribution: true }}
        className={cn("[&_.react-flow__node]:overflow-visible", resolvedTheme)}
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.25}
          bgColor="var(--bg-base)"
          color={resolvedTheme === "light" ? "rgba(0, 0, 0, 0.09)" : "rgba(255, 255, 255, 0.09)"}
        />
        <MiniMap
          pannable
          zoomable
          maskColor={resolvedTheme === "light" ? "rgba(240, 240, 245, 0.7)" : "rgba(8, 8, 9, 0.7)"}
          nodeColor={resolvedTheme === "light" ? "#d1d5db" : "#2a2a30"}
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
        <LiveCursors others={others} />
      </ReactFlow>
      </RemoteSelectionProvider>
      </EdgeLabelContext.Provider>
    </div>
  );
}

export function RealtimeCanvas({
  projectId,
  channel,
  user,
  presenceEntries,
  incomingBroadcastRef,
  incomingCursorRef,
  incomingSelectionRef,
  incomingAiStatusRef,
  incomingAiChatRef,
}: RealtimeCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas
        projectId={projectId}
        channel={channel}
        user={user}
        presenceEntries={presenceEntries}
        incomingBroadcastRef={incomingBroadcastRef}
        incomingCursorRef={incomingCursorRef}
        incomingSelectionRef={incomingSelectionRef}
        incomingAiStatusRef={incomingAiStatusRef}
        incomingAiChatRef={incomingAiChatRef}
      />
    </ReactFlowProvider>
  );
}

export type { CanvasNode, CanvasEdge };
