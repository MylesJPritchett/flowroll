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
import ActionNode from "./ActionNode";
import NodeEditor from "./NodeEditor";
import ActionNodeEditor from "./ActionNodeEditor";
import type { GraphNode, GraphEdge, GraphStateNode, GraphActionNode } from "../actions/graph";
import { getRoleLabels, resolveConditionRole } from "../concepts";
import type { StateCondition, Taxonomy } from "../concepts";
import type { GiNogi } from "../actions/graph";

const nodeTypes: NodeTypes = {
  state: BJJNode,
  action: ActionNode,
};

const edgeStyle: Partial<Edge> = {
  animated: true,
  style: { stroke: "#52525b", strokeWidth: 1.5 },
};

// --- Conversion helpers ---

function getStateWarnings(node: GraphStateNode, taxonomy: Taxonomy): string[] {
  const warnings: string[] = [];
  const pos = taxonomy.positions.find((p) => p.name === node.position_name);
  if (!pos) return warnings;
  const reqs = taxonomy.positionRequirements[pos.id];
  if (!reqs) return warnings;
  for (const req of reqs) {
    const opt = taxonomy.conditionGroups
      .flatMap((g) => g.options)
      .find((o) => o.id === req.condition_option_id);
    if (!opt) continue;
    const has = node.conditions.some((c) => c.value === opt.label && c.role === req.role);
    if (!has) {
      const roleLabel = req.role === "A" ? pos.role_a : pos.role_b;
      warnings.push(`Missing required: ${roleLabel} ${opt.label}`);
    }
  }
  return warnings;
}

function getActionWarnings(node: GraphActionNode, sourceState: GraphStateNode | undefined, taxonomy: Taxonomy): string[] {
  const warnings: string[] = [];
  const action = taxonomy.actions.find((a) => a.id === node.action_id);
  if (!action || !sourceState) return warnings;
  const actor = node.actor;
  for (const req of action.required_conditions) {
    const resolvedRole = resolveConditionRole(req.role, actor);
    const has = sourceState.conditions.some((c) => c.groupId === req.groupId && c.value === req.value && c.role === resolvedRole);
    if (!has) warnings.push(`Requires: ${req.value}`);
  }
  for (const forb of action.forbidden_conditions) {
    const resolvedRole = resolveConditionRole(forb.role, actor);
    const has = sourceState.conditions.some((c) => c.groupId === forb.groupId && c.value === forb.value && c.role === resolvedRole);
    if (has) warnings.push(`Forbidden: ${forb.value}`);
  }
  return warnings;
}

function toRFNodes(dbNodes: GraphNode[], dbEdges: GraphEdge[], taxonomy: Taxonomy): Node[] {
  const nodesById = new Map(dbNodes.map((n) => [n.id, n]));
  return dbNodes.map((n) => {
    if (n.type === "action") {
      // Find source state via incoming edge
      const inEdge = dbEdges.find((e) => e.target_node_id === n.id);
      const sourceNode = inEdge ? nodesById.get(inEdge.source_node_id) : undefined;
      const sourceState = sourceNode?.type === "state" ? sourceNode : undefined;
      const warnings = getActionWarnings(n, sourceState, taxonomy);
      return {
        id: n.id,
        type: "action",
        position: { x: n.position_x, y: n.position_y },
        data: {
          action_id: n.action_id,
          action_name: n.action_name,
          actor: n.actor,
          warnings,
        },
      };
    }
    const roles = getRoleLabels(n.position_name, taxonomy.positions);
    const warnings = getStateWarnings(n, taxonomy);
    return {
      id: n.id,
      type: "state",
      position: { x: n.position_x, y: n.position_y },
      data: {
        position_name: n.position_name,
        conditions: n.conditions,
        giNogi: n.giNogi,
        description: n.description,
        roleA: roles.roleA,
        roleB: roles.roleB,
        warnings,
      },
    };
  });
}

function toRFEdges(dbEdges: GraphEdge[]): Edge[] {
  return dbEdges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    ...edgeStyle,
  }));
}

function fromRFNodes(nodes: Node[]): GraphNode[] {
  return nodes.map((n) => {
    const d = n.data as Record<string, unknown>;
    if (n.type === "action") {
      return {
        id: n.id,
        type: "action" as const,
        action_id: (d.action_id as string) ?? "",
        action_name: (d.action_name as string) ?? "",
        actor: (d.actor as "A" | "B") ?? "A",
        position_x: n.position.x,
        position_y: n.position.y,
      };
    }
    return {
      id: n.id,
      type: "state" as const,
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
  return edges.map((e) => ({
    id: e.id,
    source_node_id: e.source,
    target_node_id: e.target,
  }));
}

// --- Props ---

interface GraphEditorProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  taxonomy: Taxonomy;
  onNodesChange: (nodes: GraphNode[]) => void;
  onEdgesChange: (edges: GraphEdge[]) => void;
  onTaxonomyChange?: () => void;
}

function GraphEditorInner({ nodes: dbNodes, edges: dbEdges, taxonomy, onNodesChange: emitNodes, onEdgesChange: emitEdges, onTaxonomyChange }: GraphEditorProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedStateNode, setSelectedStateNode] = useState<Node | null>(null);
  const [selectedActionNode, setSelectedActionNode] = useState<Node | null>(null);
  const syncing = useRef(false);

  // Sync from parent → local RF state
  useEffect(() => {
    syncing.current = true;
    setNodes(toRFNodes(dbNodes, dbEdges, taxonomy));
    setEdges(toRFEdges(dbEdges));
    setTimeout(() => { syncing.current = false; }, 50);
  }, [dbNodes, dbEdges, setNodes, setEdges]);

  // Emit local changes → parent
  const emitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (syncing.current) return;
    if (emitTimeout.current) clearTimeout(emitTimeout.current);
    emitTimeout.current = setTimeout(() => {
      emitNodes(fromRFNodes(nodes));
      emitEdges(fromRFEdges(edges));
    }, 100);
  }, [nodes, edges, emitNodes, emitEdges]);

  const applyActionEffects = useCallback(
    (actionNodeId: string, targetNodeId: string) => {
      const actionNode = nodes.find((n) => n.id === actionNodeId);
      if (!actionNode || actionNode.type !== "action") return;
      const actionData = actionNode.data as Record<string, unknown>;
      const actionId = actionData.action_id as string;
      const actor = (actionData.actor as "A" | "B") ?? "A";
      const action = taxonomy.actions.find((a) => a.id === actionId);
      if (!action) return;
      if (action.adds_conditions.length === 0 && action.removes_conditions.length === 0) return;

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== targetNodeId || n.type !== "state") return n;
          const d = n.data as Record<string, unknown>;
          let conditions = (d.conditions as StateCondition[]) ?? [];

          // Remove conditions (resolve actor/opponent → A/B)
          for (const rem of action.removes_conditions) {
            const resolvedRole = resolveConditionRole(rem.role, actor);
            conditions = conditions.filter((c) => !(c.groupId === rem.groupId && c.value === rem.value && c.role === resolvedRole));
          }

          // Add conditions (resolve actor/opponent → A/B, replace within same group+role since exclusive)
          for (const add of action.adds_conditions) {
            const resolvedRole = resolveConditionRole(add.role, actor);
            conditions = conditions.filter((c) => !(c.groupId === add.groupId && c.role === resolvedRole));
            conditions.push({ groupId: add.groupId, value: add.value, role: resolvedRole });
          }

          return { ...n, data: { ...d, conditions } };
        }),
      );
    },
    [nodes, taxonomy.actions, setNodes],
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge({ ...params, ...edgeStyle }, eds));
      // Apply action effects if action → state connection
      if (params.source) {
        const sourceNode = nodes.find((n) => n.id === params.source);
        const targetNode = params.target ? nodes.find((n) => n.id === params.target) : undefined;
        if (sourceNode?.type === "action" && targetNode?.type === "state") {
          applyActionEffects(params.source, params.target!);
        }
      }
    },
    [setEdges, nodes, applyActionEffects],
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

  // When dragging from a state to empty space → create action node
  // When dragging from an action to empty space → create state node
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: { isValid: boolean | null; fromNode: { id: string } | null }) => {
      if (connectionState.isValid) return;
      if (!connectionState.fromNode) return;
      const clientX = "changedTouches" in event ? event.changedTouches[0].clientX : event.clientX;
      const clientY = "changedTouches" in event ? event.changedTouches[0].clientY : event.clientY;
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const sourceId = connectionState.fromNode.id;
      const sourceNode = nodes.find((n) => n.id === sourceId);
      const sourceType = sourceNode?.type;

      const nodeId = `${Date.now()}`;
      const edgeId = `e${nodeId}`;

      if (sourceType === "action") {
        // From action → create state, inheriting from source state + applying effects
        const actionData = sourceNode?.data as Record<string, unknown> | undefined;
        const actionId = actionData?.action_id as string | undefined;
        const actor = (actionData?.actor as "A" | "B") ?? "A";
        const action = actionId ? taxonomy.actions.find((a) => a.id === actionId) : undefined;

        // Find the state feeding into this action node
        const inEdge = edges.find((e) => e.target === sourceId);
        const parentState = inEdge ? nodes.find((n) => n.id === inEdge.source && n.type === "state") : undefined;
        const parentData = parentState?.data as Record<string, unknown> | undefined;

        let initialConditions: StateCondition[] = parentData ? [...((parentData.conditions as StateCondition[]) ?? [])] : [];
        const inheritedName = (parentData?.position_name as string) ?? "New State";
        const inheritedGiNogi = (parentData?.giNogi as GiNogi) ?? "";

        if (action) {
          // Remove conditions first (resolve actor/opponent → A/B)
          for (const rem of action.removes_conditions) {
            const resolvedRole = resolveConditionRole(rem.role, actor);
            initialConditions = initialConditions.filter((c) => !(c.groupId === rem.groupId && c.value === rem.value && c.role === resolvedRole));
          }
          // Then add conditions (resolve actor/opponent → A/B, replace within same group+role since exclusive)
          for (const add of action.adds_conditions) {
            const resolvedRole = resolveConditionRole(add.role, actor);
            initialConditions = initialConditions.filter((c) => !(c.groupId === add.groupId && c.role === resolvedRole));
            initialConditions.push({ groupId: add.groupId, value: add.value, role: resolvedRole });
          }
        }
        const newNode: Node = {
          id: nodeId,
          type: "state",
          position,
          data: { position_name: inheritedName, conditions: initialConditions, giNogi: inheritedGiNogi, description: "" },
        };
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, { id: edgeId, source: sourceId, target: nodeId, ...edgeStyle } as Edge]);
        justCreatedNode.current = true;
        setSelectedStateNode(newNode);
        setSelectedActionNode(null);
        setFocusTitle(true);
        setEditorPos(clampEditorPos(clientX, clientY));
      } else {
        // From state → create action
        const newNode: Node = {
          id: nodeId,
          type: "action",
          position,
          data: { action_id: "", action_name: "", actor: "A" },
        };
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, { id: edgeId, source: sourceId, target: nodeId, ...edgeStyle } as Edge]);
        justCreatedNode.current = true;
        setSelectedActionNode(newNode);
        setSelectedStateNode(null);
        setEditorPos(clampEditorPos(clientX, clientY));
      }
    },
    [screenToFlowPosition, setNodes, setEdges, clampEditorPos, nodes, taxonomy.actions],
  );

  const addStateNode = useCallback(() => {
    const id = `${Date.now()}`;
    const newNode: Node = {
      id,
      type: "state",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { position_name: "New State", conditions: [], giNogi: "", description: "" },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedStateNode(newNode);
    setSelectedActionNode(null);
    setFocusTitle(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setEditorPos(clampEditorPos(rect.left + rect.width / 2, rect.top + rect.height / 2));
  }, [setNodes, clampEditorPos]);

  const onNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    if (node.type === "action") {
      setSelectedActionNode(node);
      setSelectedStateNode(null);
    } else {
      setSelectedStateNode(node);
      setSelectedActionNode(null);
    }
    setFocusTitle(false);
    setEditorPos(getRelativePos(e));
  }, [getRelativePos]);

  const onNodeDoubleClick = useCallback((e: React.MouseEvent, node: Node) => {
    if (node.type === "action") {
      setSelectedActionNode(node);
      setSelectedStateNode(null);
    } else {
      setSelectedStateNode(node);
      setSelectedActionNode(null);
      setFocusTitle(true);
    }
    setEditorPos(getRelativePos(e));
  }, [getRelativePos]);

  const onPaneClick = useCallback(() => {
    if (justCreatedNode.current) {
      justCreatedNode.current = false;
      return;
    }
    setSelectedStateNode(null);
    setSelectedActionNode(null);
  }, []);

  const updateStateNode = useCallback(
    (id: string, data: { position_name: string; conditions: StateCondition[]; giNogi: GiNogi; description: string }) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
      setSelectedStateNode((prev) => (prev && prev.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev));
    },
    [setNodes],
  );

  const updateActionNode = useCallback(
    (id: string, data: { action_id: string; action_name: string; actor: "A" | "B" }) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
      setSelectedActionNode((prev) => (prev && prev.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev));
    },
    [setNodes],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedStateNode(null);
      setSelectedActionNode(null);
    },
    [setNodes, setEdges],
  );

  // Get role labels for an action node from its connected source state
  const getActionRoleLabels = useCallback(
    (actionNode: Node) => {
      // Find the state node connected to this action (as source)
      const incomingEdge = edges.find((e) => e.target === actionNode.id);
      if (incomingEdge) {
        const sourceNode = nodes.find((n) => n.id === incomingEdge.source);
        if (sourceNode?.type === "state") {
          const posName = (sourceNode.data as Record<string, unknown>)?.position_name as string | undefined;
          return getRoleLabels(posName ?? "", taxonomy.positions);
        }
      }
      return { roleA: "A", roleB: "B" };
    },
    [nodes, edges, taxonomy.positions],
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
        onClick={addStateNode}
        className="absolute left-4 top-4 z-10 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-indigo-500"
      >
        + Add State
      </button>

      {selectedStateNode && (
        <NodeEditor
          node={selectedStateNode}
          taxonomy={taxonomy}
          focusTitle={focusTitle}
          position={editorPos}
          onUpdate={updateStateNode}
          onDelete={deleteNode}
          onClose={() => { setSelectedStateNode(null); setFocusTitle(false); }}
          onTaxonomyChange={onTaxonomyChange}
        />
      )}

      {selectedActionNode && (
        <ActionNodeEditor
          node={selectedActionNode}
          taxonomy={taxonomy}
          roleLabels={getActionRoleLabels(selectedActionNode)}
          position={editorPos}
          onUpdate={updateActionNode}
          onDelete={deleteNode}
          onClose={() => setSelectedActionNode(null)}
          onTaxonomyChange={onTaxonomyChange}
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
