"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  type NodeTypes,
  BackgroundVariant,
  useReactFlow,

} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import BJJNode from "./BJJNode";
import NodeEditor from "./NodeEditor";
import EdgeEditor from "./EdgeEditor";
import { loadGraph, saveGraph, type GraphNode, type GraphEdge } from "../actions/graph";

const nodeTypes: NodeTypes = {
  bjj: BJJNode,
};

const edgeStyles: Record<string, Partial<Edge>> = {
  "leads to": {
    animated: true,
    style: { stroke: "#6366f1", strokeWidth: 2 },
  },
  "responds by": {
    animated: true,
    style: { stroke: "#f59e0b", strokeWidth: 2 },
  },
  "threatens": {
    animated: true,
    className: "slow-edge",
    style: { stroke: "#ef4444", strokeWidth: 2 },
  },
  "prevents": {
    animated: true,
    className: "slow-edge",
    style: { stroke: "#71717a", strokeWidth: 1.5 },
  },
};

const defaultEdgeStyle = edgeStyles["leads to"];

function getEdgeStyle(relationship: string): Partial<Edge> {
  return edgeStyles[relationship] ?? defaultEdgeStyle;
}

function toReactFlowNodes(dbNodes: GraphNode[]): Node[] {
  return dbNodes.map((n) => ({
    id: n.id,
    type: "bjj",
    position: { x: n.position_x, y: n.position_y },
    data: { label: n.label, description: n.description, player: n.metadata?.player ?? "neutral", tags: n.metadata?.tags ?? [] },
  }));
}

function toReactFlowEdges(dbEdges: GraphEdge[]): Edge[] {
  return dbEdges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    label: e.relationship,
    ...getEdgeStyle(e.relationship),
  }));
}

function toDbNodes(nodes: Node[]): GraphNode[] {
  return nodes.map((n) => {
    const d = n.data as Record<string, string>;
    return {
      id: n.id,
      label: d.label ?? "New Node",
      description: d.description ?? "",
      position_x: n.position.x,
      position_y: n.position.y,
      metadata: { player: d.player ?? "neutral", tags: (n.data as Record<string, unknown>).tags ?? [] },
    };
  });
}

function toDbEdges(edges: Edge[]): GraphEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source_node_id: e.source,
    target_node_id: e.target,
    relationship: (e.label as string) ?? "leads to",
  }));
}

function GraphEditorInner() {
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  // Load graph on mount
  useEffect(() => {
    loadGraph().then((data) => {
      if (data && data.nodes.length > 0) {
        setNodes(toReactFlowNodes(data.nodes));
        setEdges(toReactFlowEdges(data.edges));
      }
      setLoading(false);
      // Mark initialized after a tick so the initial setNodes/setEdges
      // don't trigger a save
      setTimeout(() => {
        initialized.current = true;
      }, 100);
    });
  }, [setNodes, setEdges]);

  // Auto-save with debounce
  const scheduleSave = useCallback(
    (currentNodes: Node[], currentEdges: Edge[]) => {
      if (!initialized.current) return;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        setSaving(true);
        await saveGraph(toDbNodes(currentNodes), toDbEdges(currentEdges));
        setSaving(false);
      }, 1500);
    },
    [],
  );

  // Watch for changes and trigger save
  useEffect(() => {
    scheduleSave(nodes, edges);
  }, [nodes, edges, scheduleSave]);

  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge({ ...params, label: "leads to", ...getEdgeStyle("leads to") }, eds));
    },
    [setEdges],
  );

  const [focusTitle, setFocusTitle] = useState(false);
  const [editorPos, setEditorPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const clampEditorPos = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const editorW = 300;
    const editorH = 550;
    const pad = 12;

    let x = clientX - rect.left + 16;
    let y = clientY - rect.top - 20;

    // If it would overflow right, put it to the left of the click instead
    if (x + editorW + pad > rect.width) {
      x = clientX - rect.left - editorW - 16;
    }
    // If it would overflow bottom, push it up
    if (y + editorH + pad > rect.height) {
      y = rect.height - editorH - pad;
    }

    return { x: Math.max(pad, x), y: Math.max(pad, y) };
  }, []);

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    return clampEditorPos(e.clientX, e.clientY);
  }, [clampEditorPos]);

  const justCreatedNode = useRef(false);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: { isValid: boolean | null; fromNode: { id: string } | null }) => {
      // If the connection landed on a valid handle, onConnect handles it
      if (connectionState.isValid) return;
      // Need a source node
      if (!connectionState.fromNode) return;

      const clientX = "changedTouches" in event ? event.changedTouches[0].clientX : event.clientX;
      const clientY = "changedTouches" in event ? event.changedTouches[0].clientY : event.clientY;
      const position = screenToFlowPosition({ x: clientX, y: clientY });

      const nodeId = `${Date.now()}`;
      const edgeId = `e${nodeId}`;
      const sourceId = connectionState.fromNode.id;
      const newNode: Node = {
        id: nodeId,
        type: "bjj",
        position,
        data: { label: "New Node", description: "", player: "neutral", tags: [] },
      };

      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [
        ...eds,
        { id: edgeId, source: sourceId, target: nodeId, label: "leads to", ...getEdgeStyle("leads to") } as Edge,
      ]);

      // Open editor with title focused — flag to prevent onPaneClick from clearing it
      justCreatedNode.current = true;
      setSelectedNode(newNode);
      setSelectedEdge(null);
      setFocusTitle(true);
      setEditorPos(clampEditorPos(clientX, clientY));
    },
    [screenToFlowPosition, setNodes, setEdges, clampEditorPos],
  );

  const addNode = useCallback(() => {
    const id = `${Date.now()}`;
    const newNode: Node = {
      id,
      type: "bjj",
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
      data: { label: "New Node", description: "", player: "neutral", tags: [] },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
    setSelectedEdge(null);
    setFocusTitle(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setEditorPos(clampEditorPos(rect.left + rect.width / 2, rect.top + rect.height / 2));
    }
  }, [setNodes, clampEditorPos]);

  const onNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    setFocusTitle(false);
    setEditorPos(getRelativePos(e));
  }, [getRelativePos]);

  const onNodeDoubleClick = useCallback((e: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    setFocusTitle(true);
    setEditorPos(getRelativePos(e));
  }, [getRelativePos]);

  const onEdgeClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setEditorPos(getRelativePos(e));
  }, [getRelativePos]);

  const onPaneClick = useCallback(() => {
    if (justCreatedNode.current) {
      justCreatedNode.current = false;
      return;
    }
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const updateNode = useCallback(
    (id: string, data: { label: string; description: string; player: string; tags: string[] }) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
        ),
      );
      setSelectedNode((prev) =>
        prev && prev.id === id
          ? { ...prev, data: { ...prev.data, ...data } }
          : prev,
      );
    },
    [setNodes],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) =>
        eds.filter((e) => e.source !== id && e.target !== id),
      );
      setSelectedNode(null);
    },
    [setNodes, setEdges],
  );

  const updateEdge = useCallback(
    (id: string, relationship: string) => {
      const style = getEdgeStyle(relationship);
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? { ...e, label: relationship, ...style } : e)),
      );
      setSelectedEdge((prev) =>
        prev && prev.id === id ? { ...prev, label: relationship, ...style } : prev,
      );
    },
    [setEdges],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== id));
      setSelectedEdge(null);
    },
    [setEdges],
  );

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-sm text-zinc-500">Loading graph...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          className="!bg-zinc-100 dark:!bg-zinc-900"
        />
      </ReactFlow>

      <button
        onClick={addNode}
        className="absolute left-4 top-4 z-10 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-indigo-500"
      >
        + Add Node
      </button>

      {saving && (
        <div className="absolute bottom-4 left-4 z-10 rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
          Saving...
        </div>
      )}

      {selectedNode && (
        <NodeEditor
          node={selectedNode}
          focusTitle={focusTitle}
          position={editorPos}
          onUpdate={updateNode}
          onDelete={deleteNode}
          onClose={() => { setSelectedNode(null); setFocusTitle(false); }}
        />
      )}

      {selectedEdge && (
        <EdgeEditor
          edge={selectedEdge}
          position={editorPos}
          onUpdate={updateEdge}
          onDelete={deleteEdge}
          onClose={() => setSelectedEdge(null)}
        />
      )}
    </div>
  );
}

export default function GraphEditor() {
  return (
    <ReactFlowProvider>
      <GraphEditorInner />
    </ReactFlowProvider>
  );
}
