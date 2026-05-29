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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import BJJNode from "./BJJNode";
import NodeEditor from "./NodeEditor";
import { loadGraph, saveGraph, type GraphNode, type GraphEdge } from "../actions/graph";

const nodeTypes: NodeTypes = {
  bjj: BJJNode,
};

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: "#6366f1" },
};

function toReactFlowNodes(dbNodes: GraphNode[]): Node[] {
  return dbNodes.map((n) => ({
    id: n.id,
    type: "bjj",
    position: { x: n.position_x, y: n.position_y },
    data: { label: n.label, description: n.description },
  }));
}

function toReactFlowEdges(dbEdges: GraphEdge[]): Edge[] {
  return dbEdges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    label: e.relationship,
  }));
}

function toDbNodes(nodes: Node[]): GraphNode[] {
  return nodes.map((n) => ({
    id: n.id,
    label: (n.data as Record<string, string>).label ?? "New Node",
    description: (n.data as Record<string, string>).description ?? "",
    position_x: n.position.x,
    position_y: n.position.y,
  }));
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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
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
      setEdges((eds) => addEdge({ ...params, label: "leads to" }, eds));
    },
    [setEdges],
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
      data: { label: "New Node", description: "" },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const updateNode = useCallback(
    (id: string, data: { label: string; description: string }) => {
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

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-sm text-zinc-500">Loading graph...</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
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
          onUpdate={updateNode}
          onDelete={deleteNode}
          onClose={() => setSelectedNode(null)}
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
