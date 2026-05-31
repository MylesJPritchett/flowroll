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
import type { GraphNode, GraphEdge, GiNogi } from "../actions/graph";
import type { Position as DBPosition } from "../actions/taxonomy";
import { getRoleLabels } from "../concepts";
import type { StateCondition } from "../concepts";
import type { Taxonomy } from "../concepts";

const nodeTypes: NodeTypes = {
  bjj: BJJNode,
};

const defaultEdgeStyle: Partial<Edge> = {
  animated: true,
  style: { stroke: "#6366f1", strokeWidth: 2 },
};

// --- Conversion helpers ---

function toRFNodes(dbNodes: GraphNode[], positions: DBPosition[]): Node[] {
  return dbNodes.map((n) => {
    const roles = getRoleLabels(n.position_name, positions);
    return {
      id: n.id,
      type: "bjj",
      position: { x: n.position_x, y: n.position_y },
      data: {
        position_name: n.position_name,
        conditions: n.conditions,
        giNogi: n.giNogi,
        description: n.description,
        roleA: roles.roleA,
        roleB: roles.roleB,
      },
    };
  });
}

function toRFEdges(dbEdges: GraphEdge[]): Edge[] {
  return dbEdges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    label: e.label,
    data: { actor: e.actor, giNogi: e.giNogi, description: e.description },
    ...defaultEdgeStyle,
  }));
}

function fromRFNodes(nodes: Node[]): GraphNode[] {
  return nodes.map((n) => {
    const d = n.data as Record<string, unknown>;
    return {
      id: n.id,
      position_name: (d.position_name as string) ?? "New State",
      description: (d.description as string) ?? "",
      conditions: (d.conditions as StateCondition[]) ?? [],
      giNogi: (d.giNogi as GiNogi) ?? "",
      position_x: n.position.x,
      position_y: n.position.y,
    };
  });
}

function fromRFEdges(edges: Edge[]): GraphEdge[] {
  return edges.map((e) => {
    const d = e.data as Record<string, unknown> | undefined;
    return {
      id: e.id,
      source_node_id: e.source,
      target_node_id: e.target,
      label: (e.label as string) ?? "",
      actor: (d?.actor as "A" | "B") ?? "A",
      giNogi: (d?.giNogi as GiNogi) ?? "",
      description: (d?.description as string) ?? "",
    };
  });
}

// --- Props ---

interface GraphEditorProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  taxonomy: Taxonomy;
  onNodesChange: (nodes: GraphNode[]) => void;
  onEdgesChange: (edges: GraphEdge[]) => void;
}

function GraphEditorInner({ nodes: dbNodes, edges: dbEdges, taxonomy, onNodesChange: emitNodes, onEdgesChange: emitEdges }: GraphEditorProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const syncing = useRef(false);

  // Sync from parent → local RF state
  useEffect(() => {
    syncing.current = true;
    setNodes(toRFNodes(dbNodes, taxonomy.positions));
    setEdges(toRFEdges(dbEdges));
    // Allow a tick for the state to settle before re-enabling emit
    setTimeout(() => { syncing.current = false; }, 50);
  }, [dbNodes, dbEdges, setNodes, setEdges]);

  // Emit local changes → parent (debounced to avoid loops)
  const emitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (syncing.current) return;
    if (emitTimeout.current) clearTimeout(emitTimeout.current);
    emitTimeout.current = setTimeout(() => {
      emitNodes(fromRFNodes(nodes));
      emitEdges(fromRFEdges(edges));
    }, 100);
  }, [nodes, edges, emitNodes, emitEdges]);

  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) =>
        addEdge({ ...params, label: "", data: { actor: "A", giNogi: "", description: "" }, ...defaultEdgeStyle }, eds),
      );
    },
    [setEdges],
  );

  const [focusTitle, setFocusTitle] = useState(false);
  const [editorPos, setEditorPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const clampEditorPos = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const editorW = 320;
    const editorH = 550;
    const pad = 12;
    let x = clientX - rect.left + 16;
    let y = clientY - rect.top - 20;
    if (x + editorW + pad > rect.width) x = clientX - rect.left - editorW - 16;
    if (y + editorH + pad > rect.height) y = rect.height - editorH - pad;
    return { x: Math.max(pad, x), y: Math.max(pad, y) };
  }, []);

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    return clampEditorPos(e.clientX, e.clientY);
  }, [clampEditorPos]);

  const justCreatedNode = useRef(false);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: { isValid: boolean | null; fromNode: { id: string } | null }) => {
      if (connectionState.isValid) return;
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
        data: { position_name: "New State", conditions: [], giNogi: "", description: "" },
      };
      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [
        ...eds,
        { id: edgeId, source: sourceId, target: nodeId, label: "", data: { actor: "A", giNogi: "", description: "" }, ...defaultEdgeStyle } as Edge,
      ]);
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
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { position_name: "New State", conditions: [], giNogi: "", description: "" },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
    setSelectedEdge(null);
    setFocusTitle(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setEditorPos(clampEditorPos(rect.left + rect.width / 2, rect.top + rect.height / 2));
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
    (id: string, data: { position_name: string; conditions: StateCondition[]; giNogi: GiNogi; description: string }) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
      setSelectedNode((prev) => (prev && prev.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev));
    },
    [setNodes],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNode(null);
    },
    [setNodes, setEdges],
  );

  const updateEdge = useCallback(
    (id: string, data: { label: string; actor: "A" | "B"; giNogi: GiNogi; description: string }) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === id
            ? { ...e, label: data.label, data: { ...e.data, actor: data.actor, giNogi: data.giNogi, description: data.description } }
            : e,
        ),
      );
      setSelectedEdge((prev) =>
        prev && prev.id === id
          ? { ...prev, label: data.label, data: { ...prev.data, actor: data.actor, giNogi: data.giNogi, description: data.description } }
          : prev,
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

  const getEdgeRoleLabels = useCallback(
    (edge: Edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const posName = (sourceNode?.data as Record<string, unknown>)?.position_name as string | undefined;
      return getRoleLabels(posName ?? "", taxonomy.positions);
    },
    [nodes],
  );

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
        <MiniMap nodeStrokeWidth={3} className="!bg-zinc-100 dark:!bg-zinc-900" />
      </ReactFlow>

      <button
        onClick={addNode}
        className="absolute left-4 top-4 z-10 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-indigo-500"
      >
        + Add State
      </button>

      {selectedNode && (
        <NodeEditor
          node={selectedNode}
          taxonomy={taxonomy}
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
          roleLabels={getEdgeRoleLabels(selectedEdge)}
          position={editorPos}
          onUpdate={updateEdge}
          onDelete={deleteEdge}
          onClose={() => setSelectedEdge(null)}
        />
      )}
    </div>
  );
}

export default function GraphEditor(props: GraphEditorProps) {
  return (
    <ReactFlowProvider>
      <GraphEditorInner {...props} />
    </ReactFlowProvider>
  );
}
