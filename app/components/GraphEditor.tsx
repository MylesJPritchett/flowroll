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
import FinishNode from "./FinishNode";
import NodeEditor from "./NodeEditor";
import ActionNodeEditor from "./ActionNodeEditor";
import type { GraphNode, GraphEdge, GraphStateNode, GraphActionNode, GraphFinishNode, GiNogi } from "@/lib/graph";
import { getRoleLabels, resolveConditionRole, computeActionEffects } from "@/lib/concepts";
import type { StateCondition, Taxonomy } from "@/lib/concepts";

const nodeTypes: NodeTypes = {
  state: BJJNode,
  action: ActionNode,
  finish: FinishNode,
};

// --- Edge styling ---

const EDGE_COLOR_A = "#60a5fa"; // blue-400
const EDGE_COLOR_B = "#fbbf24"; // amber-400
const EDGE_COLOR_DEFAULT = "#52525b"; // zinc-600

function makeEdgeStyle(actor?: "A" | "B"): Partial<Edge> {
  const stroke = actor === "A" ? EDGE_COLOR_A : actor === "B" ? EDGE_COLOR_B : EDGE_COLOR_DEFAULT;
  return { animated: true, style: { stroke, strokeWidth: 1.5 }, interactionWidth: 20 };
}

/** Derive actor from a source handle id */
function actorForHandle(handleId: string | null | undefined): "A" | "B" {
  return handleId === "source-b" ? "B" : "A";
}

// --- Condition matching helpers ---

function conditionsMatch(a: StateCondition[], b: StateCondition[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((ac) => b.some((bc) => ac.groupId === bc.groupId && ac.value === bc.value && ac.role === bc.role));
}

function conditionOverlap(a: StateCondition[], b: StateCondition[]): number {
  return a.filter((ac) => b.some((bc) => ac.groupId === bc.groupId && ac.value === bc.value && ac.role === bc.role)).length;
}

// --- State Suggestion Popup ---

function StateSuggestionPopup({
  pendingSuggestion,
  nodes,
  taxonomy,
  position,
  onSelect,
  onCreateNew,
  onClose,
}: {
  pendingSuggestion: {
    expectedName: string;
    expectedConditions: StateCondition[];
  };
  nodes: Node[];
  taxonomy: Taxonomy;
  position: { x: number; y: number };
  onSelect: (existingNodeId: string | null) => void;
  onCreateNew: () => void;
  onClose: () => void;
}) {
  const { expectedName, expectedConditions } = pendingSuggestion;
  const roles = getRoleLabels(expectedName, taxonomy.positions);
  const roleLabel = (role: "A" | "B") => (role === "A" ? roles.roleA : roles.roleB);

  // Find existing state nodes, scored by similarity
  const candidates = nodes
    .filter((n) => n.type === "state")
    .map((n) => {
      const d = n.data as Record<string, unknown>;
      const name = (d.position_name as string) ?? "";
      const conditions = (d.conditions as StateCondition[]) ?? [];
      const nameMatch = name === expectedName;
      const exact = nameMatch && conditionsMatch(conditions, expectedConditions);
      const overlap = conditionOverlap(conditions, expectedConditions);
      return { id: n.id, name, conditions, nameMatch, exact, overlap };
    })
    .filter((c) => c.nameMatch)
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      return b.overlap - a.overlap;
    });

  return (
    <div
      style={{ left: position.x, top: position.y }}
      className="absolute z-20 w-72 rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-lg max-h-[60vh] overflow-y-auto"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-100">Connect to state</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-sm">&times;</button>
      </div>

      {/* Expected output — click to create new state with these conditions */}
      <button
        onClick={() => onSelect(null)}
        className="mb-2 w-full text-left rounded border border-indigo-500/50 bg-indigo-950/20 px-2.5 py-1.5 transition-colors hover:bg-indigo-950/40"
      >
        <div className="text-[10px] text-indigo-400 mb-1">+ Create new state</div>
        <div className="text-xs font-medium text-zinc-200">{expectedName}</div>
        {expectedConditions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-0.5">
            {expectedConditions.map((c) => (
              <span
                key={`${c.groupId}-${c.role}`}
                className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
                  c.role === "A" ? "bg-blue-500/20 text-blue-300" : "bg-amber-500/20 text-amber-300"
                }`}
              >
                <span className="opacity-60">{roleLabel(c.role)}</span> {c.value}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Matching existing states */}
      {candidates.length > 0 && (
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Or connect to existing</div>
          <div className="space-y-1">
            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full text-left rounded border px-2.5 py-1.5 transition-colors ${
                  c.exact
                    ? "border-green-500/50 bg-green-950/30 hover:bg-green-950/50"
                    : "border-zinc-600/50 bg-zinc-900 hover:bg-zinc-700/50"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-zinc-200">{c.name}</span>
                  {c.exact && <span className="text-[8px] text-green-400 font-medium">exact match</span>}
                </div>
                {c.conditions.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {c.conditions.map((cond) => (
                      <span
                        key={`${cond.groupId}-${cond.role}`}
                        className={`rounded-full px-1 py-0.5 text-[8px] font-medium ${
                          cond.role === "A" ? "bg-blue-500/15 text-blue-300/80" : "bg-amber-500/15 text-amber-300/80"
                        }`}
                      >
                        {cond.value}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onCreateNew}
        className="mt-2 w-full rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
      >
        + Create different state
      </button>
    </div>
  );
}

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
    if (n.type === "finish") {
      return {
        id: n.id,
        type: "finish",
        position: { x: n.position_x, y: n.position_y },
        data: { label: n.label },
      };
    }
    const roles = getRoleLabels(n.position_name, taxonomy.positions);
    const warnings = getStateWarnings(n, taxonomy);
    return {
      id: n.id,
      type: "state",
      position: { x: n.position_x, y: n.position_y },
      data: {
        state_id: n.state_id,
        label: n.label,
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
    ...(e.source_handle ? { sourceHandle: e.source_handle } : {}),
    ...(e.target_handle ? { targetHandle: e.target_handle } : {}),
    data: { actor: e.actor },
    ...makeEdgeStyle(e.actor),
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
    if (n.type === "finish") {
      return {
        id: n.id,
        type: "finish" as const,
        label: (d.label as string) ?? "Submitted",
        position_x: n.position.x,
        position_y: n.position.y,
      };
    }
    return {
      id: n.id,
      type: "state" as const,
      state_id: (d.state_id as string) ?? "",
      label: (d.label as string) ?? "",
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
      ...(e.sourceHandle ? { source_handle: e.sourceHandle } : {}),
      ...(e.targetHandle ? { target_handle: e.targetHandle } : {}),
      ...(d?.actor ? { actor: d.actor as "A" | "B" } : {}),
    };
  });
}

// --- Helper to build an edge object with actor, handles, and color ---

function buildEdge(id: string, source: string, target: string, actor: "A" | "B", sourceHandle?: string, targetHandle?: string): Edge {
  return {
    id,
    source,
    target,
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(targetHandle ? { targetHandle } : {}),
    data: { actor },
    ...makeEdgeStyle(actor),
  } as Edge;
}

// --- Props ---

export interface FlowGraph {
  id: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphEditorProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  taxonomy: Taxonomy;
  flowGraphs: FlowGraph[];
  onNodesChange: (nodes: GraphNode[]) => void;
  onEdgesChange: (edges: GraphEdge[]) => void;
  onFlowChange?: (flowId: string, nodes: GraphNode[], edges: GraphEdge[]) => void;
  onFlowSave?: (flowId: string, nodes: GraphNode[], edges: GraphEdge[]) => void;
  onInsertFlow?: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  onTaxonomyChange?: () => void;
  onDeleteFlow?: (id: string) => void;
}

function GraphEditorInner({ nodes: dbNodes, edges: dbEdges, taxonomy, flowGraphs, onNodesChange: emitNodes, onEdgesChange: emitEdges, onFlowChange, onFlowSave, onInsertFlow, onTaxonomyChange, onDeleteFlow }: GraphEditorProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedStateNode, setSelectedStateNode] = useState<Node | null>(null);
  const [selectedActionNode, setSelectedActionNode] = useState<Node | null>(null);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const syncing = useRef(false);

  const isViewingFlow = activeFlowId !== null;

  // Get active data source
  const activeFlow = activeFlowId ? flowGraphs.find((f) => f.id === activeFlowId) : null;
  const displayNodes = activeFlow ? activeFlow.nodes : dbNodes;
  const displayEdges = activeFlow ? activeFlow.edges : dbEdges;

  // Sync from parent → local RF state
  useEffect(() => {
    syncing.current = true;
    setNodes(toRFNodes(displayNodes, displayEdges, taxonomy));
    setEdges(toRFEdges(displayEdges));
    setTimeout(() => {
      syncing.current = false;
    }, 50);
  }, [displayNodes, displayEdges, setNodes, setEdges]);

  // Emit local changes → parent
  const emitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (syncing.current) return;
    if (emitTimeout.current) clearTimeout(emitTimeout.current);
    emitTimeout.current = setTimeout(() => {
      const graphNodes = fromRFNodes(nodes);
      const graphEdges = fromRFEdges(edges);
      if (isViewingFlow && activeFlowId) {
        onFlowChange?.(activeFlowId, graphNodes, graphEdges);
        onFlowSave?.(activeFlowId, graphNodes, graphEdges);
      } else {
        emitNodes(graphNodes);
        emitEdges(graphEdges);
      }
    }, 100);
  }, [nodes, edges, emitNodes, emitEdges, isViewingFlow, activeFlowId, onFlowChange, onFlowSave]);

  const applyActionEffects = useCallback(
    (actionNodeId: string, targetNodeId: string) => {
      const actionNode = nodes.find((n) => n.id === actionNodeId);
      if (!actionNode || actionNode.type !== "action") return;
      const actionData = actionNode.data as Record<string, unknown>;
      const action = taxonomy.actions.find((a) => a.id === (actionData.action_id as string));
      if (!action || (action.adds_conditions.length === 0 && action.removes_conditions.length === 0)) return;
      const actor = (actionData.actor as "A" | "B") ?? "A";

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== targetNodeId || n.type !== "state") return n;
          const d = n.data as Record<string, unknown>;
          const conditions = computeActionEffects((d.conditions as StateCondition[]) ?? [], action, actor);
          return { ...n, data: { ...d, conditions } };
        }),
      );
    },
    [nodes, taxonomy.actions, setNodes],
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      const sourceNode = params.source ? nodes.find((n) => n.id === params.source) : undefined;
      const targetNode = params.target ? nodes.find((n) => n.id === params.target) : undefined;

      if (sourceNode?.type === "state" && targetNode?.type === "state") {
        // State → State: create an intermediate action node
        // Actor from source handle, target handle from where the user actually dropped
        const actor = actorForHandle(params.sourceHandle);
        const targetHandle = params.targetHandle ?? (actor === "A" ? "target-a-left" : "target-b-left");
        const actionId = `${Date.now()}`;
        const srcPos = sourceNode.position;
        const tgtPos = targetNode.position;
        const midPosition = { x: (srcPos.x + tgtPos.x) / 2, y: (srcPos.y + tgtPos.y) / 2 };

        const newAction: Node = {
          id: actionId,
          type: "action",
          position: midPosition,
          data: { action_id: "", action_name: "", actor },
        };
        setNodes((nds) => [...nds, newAction]);
        setEdges((eds) => [
          ...eds,
          buildEdge(`e${actionId}-in`, params.source!, actionId, actor, params.sourceHandle ?? `source-${actor.toLowerCase()}`, "target"),
          buildEdge(`e${actionId}-out`, actionId, params.target!, actor, "source", targetHandle),
        ]);

        justCreatedNode.current = true;
        setSelectedActionNode(newAction);
        setSelectedStateNode(null);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) setEditorPos({ x: rect.width / 2 - 160, y: Math.max(12, rect.height / 2 - 100) });
      } else {
        // Action → State or other direct connections
        const edgeActor = sourceNode?.type === "action"
          ? ((sourceNode.data as Record<string, unknown>)?.actor as "A" | "B") ?? "A"
          : actorForHandle(params.sourceHandle);
        setEdges((eds) => addEdge({ ...params, data: { actor: edgeActor }, ...makeEdgeStyle(edgeActor) }, eds));
        if (sourceNode?.type === "action" && targetNode?.type === "state") {
          applyActionEffects(params.source!, params.target!);
        }
      }
    },
    [setEdges, setNodes, nodes, applyActionEffects],
  );

  // Pending suggestion state: when dragging from action → empty space
  interface PendingSuggestion {
    actionNodeId: string;
    actor: "A" | "B";
    flowPosition: { x: number; y: number };
    expectedName: string;
    expectedConditions: StateCondition[];
    expectedGiNogi: GiNogi;
  }
  const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion | null>(null);

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
  // When dragging from an action to empty space → suggest/create state
  const onConnectEnd = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: MouseEvent | TouchEvent, connectionState: any) => {
      if (connectionState.isValid) return;
      if (!connectionState.fromNode) return;
      const clientX = "changedTouches" in event ? event.changedTouches[0].clientX : event.clientX;
      const clientY = "changedTouches" in event ? event.changedTouches[0].clientY : event.clientY;
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const sourceId = connectionState.fromNode.id;
      const sourceNode = nodes.find((n) => n.id === sourceId);
      const sourceType = sourceNode?.type;
      const fromHandleId: string | null = connectionState.fromHandle?.id ?? null;

      const nodeId = `${Date.now()}`;

      if (sourceType === "action") {
        // From action → compute expected state, show suggestions
        const actionData = sourceNode?.data as Record<string, unknown> | undefined;
        const actionId = actionData?.action_id as string | undefined;
        const actor = (actionData?.actor as "A" | "B") ?? "A";
        const action = actionId ? taxonomy.actions.find((a) => a.id === actionId) : undefined;

        // Find the state feeding into this action node
        const inEdge = edges.find((e) => e.target === sourceId);
        const parentState = inEdge ? nodes.find((n) => n.id === inEdge.source && n.type === "state") : undefined;
        const parentData = parentState?.data as Record<string, unknown> | undefined;

        const baseConditions: StateCondition[] = parentData ? [...((parentData.conditions as StateCondition[]) ?? [])] : [];
        const expectedName = (parentData?.position_name as string) ?? "New State";
        const expectedGiNogi = (parentData?.giNogi as GiNogi) ?? "";
        const expectedConditions = action ? computeActionEffects(baseConditions, action, actor) : baseConditions;

        justCreatedNode.current = true;
        setPendingSuggestion({
          actionNodeId: sourceId,
          actor,
          flowPosition: position,
          expectedName,
          expectedConditions,
          expectedGiNogi,
        });
        setSelectedStateNode(null);
        setSelectedActionNode(null);
        setEditorPos(clampEditorPos(clientX, clientY));
      } else if (sourceType === "state") {
        // From state → create action, actor from handle
        const actor = actorForHandle(fromHandleId);
        const newNode: Node = {
          id: nodeId,
          type: "action",
          position,
          data: { action_id: "", action_name: "", actor },
        };
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, buildEdge(
          `e${nodeId}`, sourceId, nodeId, actor,
          fromHandleId ?? `source-${actor.toLowerCase()}`, "target",
        )]);
        justCreatedNode.current = true;
        setSelectedActionNode(newNode);
        setSelectedStateNode(null);
        setEditorPos(clampEditorPos(clientX, clientY));
      }
    },
    [screenToFlowPosition, setNodes, setEdges, clampEditorPos, nodes, edges, taxonomy.actions],
  );

  const addStateNode = useCallback(() => {
    const id = `${Date.now()}`;
    const newNode: Node = {
      id,
      type: "state",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { state_id: "", label: "", position_name: "New State", conditions: [], giNogi: "", description: "" },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedStateNode(newNode);
    setSelectedActionNode(null);
    setFocusTitle(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setEditorPos(clampEditorPos(rect.left + rect.width / 2, rect.top + rect.height / 2));
  }, [setNodes, clampEditorPos]);

  const addFinishNode = useCallback(() => {
    const id = `${Date.now()}`;
    const newNode: Node = {
      id,
      type: "finish",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { label: "Submitted" },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const onNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    if (node.type === "action") {
      setSelectedActionNode(node);
      setSelectedStateNode(null);
    } else if (node.type === "finish") {
      // Finish nodes are not editable, just deselect others
      setSelectedActionNode(null);
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

  const [selectedEdge, setSelectedEdge] = useState<{ id: string; pos: { x: number; y: number } } | null>(null);

  const onEdgeClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    setSelectedEdge({ id: edge.id, pos: clampEditorPos(e.clientX, e.clientY) });
    setSelectedStateNode(null);
    setSelectedActionNode(null);
    setPendingSuggestion(null);
  }, [clampEditorPos]);

  const deleteEdge = useCallback((id: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== id));
    setSelectedEdge(null);
  }, [setEdges]);

  const onPaneClick = useCallback(() => {
    if (justCreatedNode.current) {
      justCreatedNode.current = false;
      return;
    }
    setSelectedStateNode(null);
    setSelectedActionNode(null);
    setPendingSuggestion(null);
    setSelectedEdge(null);
  }, []);

  const updateStateNode = useCallback(
    (id: string, data: { state_id: string; label: string; position_name: string; conditions: StateCondition[]; giNogi: GiNogi; description: string }) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
      setSelectedStateNode((prev) => (prev && prev.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev));
    },
    [setNodes],
  );

  const updateActionNode = useCallback(
    (id: string, data: { action_id: string; action_name: string; actor: "A" | "B" }) => {
      setNodes((nds) => {
        const updated = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n));

        // Re-apply action effects to the downstream state when actor or action changes
        const action = taxonomy.actions.find((a) => a.id === data.action_id);
        const outEdge = edges.find((e) => e.source === id);
        const targetId = outEdge?.target;
        if (!action || !targetId) return updated;

        const inEdge = edges.find((e) => e.target === id);
        const sourceNode = inEdge ? updated.find((n) => n.id === inEdge.source && n.type === "state") : undefined;
        const sourceData = sourceNode?.data as Record<string, unknown> | undefined;
        const baseConditions: StateCondition[] = sourceData ? [...((sourceData.conditions as StateCondition[]) ?? [])] : [];
        const conditions = computeActionEffects(baseConditions, action, data.actor);

        return updated.map((n) =>
          n.id === targetId && n.type === "state"
            ? { ...n, data: { ...n.data, conditions } }
            : n,
        );
      });
      setSelectedActionNode((prev) => (prev && prev.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev));
    },
    [setNodes, edges, taxonomy.actions],
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

  // Handle suggestion selection: connect to existing state or create new
  const handleSuggestionSelect = useCallback(
    (existingNodeId: string | null) => {
      if (!pendingSuggestion) return;
      const { actionNodeId, actor, flowPosition, expectedName, expectedConditions, expectedGiNogi } = pendingSuggestion;
      const targetHandle = actor === "A" ? "target-a-left" : "target-b-left";

      if (existingNodeId) {
        const edgeId = `e${Date.now()}`;
        setEdges((eds) => [...eds, buildEdge(edgeId, actionNodeId, existingNodeId, actor, "source", targetHandle)]);
      } else {
        const nodeId = `${Date.now()}`;
        const edgeId = `e${nodeId}`;
        const newNode: Node = {
          id: nodeId,
          type: "state",
          position: flowPosition,
          data: { state_id: "", label: "", position_name: expectedName, conditions: expectedConditions, giNogi: expectedGiNogi, description: "" },
        };
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, buildEdge(edgeId, actionNodeId, nodeId, actor, "source", targetHandle)]);
        setSelectedStateNode(newNode);
        setFocusTitle(true);
      }
      setPendingSuggestion(null);
    },
    [pendingSuggestion, setNodes, setEdges],
  );

  const handleCreateNewState = useCallback(() => {
    if (!pendingSuggestion) return;
    const { actionNodeId, actor, flowPosition } = pendingSuggestion;
    const targetHandle = actor === "A" ? "target-a-left" : "target-b-left";
    const nodeId = `${Date.now()}`;
    const edgeId = `e${nodeId}`;
    const newNode: Node = {
      id: nodeId,
      type: "state",
      position: flowPosition,
      data: { state_id: "", label: "", position_name: "New State", conditions: [], giNogi: "", description: "" },
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, buildEdge(edgeId, actionNodeId, nodeId, actor, "source", targetHandle)]);
    setSelectedStateNode(newNode);
    setFocusTitle(true);
    setPendingSuggestion(null);
  }, [pendingSuggestion, setNodes, setEdges]);

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
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ selectable: true }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} className="!bg-zinc-100 dark:!bg-zinc-900" />
      </ReactFlow>

      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        {flowGraphs.length > 0 && (
          <select
            value={activeFlowId ?? ""}
            onChange={(e) => {
              setActiveFlowId(e.target.value || null);
              setSelectedStateNode(null);
              setSelectedActionNode(null);
            }}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 shadow-md max-w-[250px] truncate"
          >
            <option value="">My Graph</option>
            {flowGraphs.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={addStateNode}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-indigo-500"
        >
          + Add State
        </button>
        <button
          onClick={addFinishNode}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-red-500"
        >
          + Submitted
        </button>
        {isViewingFlow && activeFlow && onInsertFlow && (
          <button
            onClick={() => {
              onInsertFlow(activeFlow.nodes, activeFlow.edges);
              setActiveFlowId(null);
            }}
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-green-500"
          >
            Insert into My Graph
          </button>
        )}
        {isViewingFlow && onDeleteFlow && (
          <button
            onClick={() => {
              onDeleteFlow(activeFlowId!);
              setActiveFlowId(null);
            }}
            className="rounded-lg border border-red-600/50 bg-zinc-800 px-3 py-2 text-sm font-medium text-red-400 shadow-md transition-colors hover:bg-red-950"
          >
            Delete Flow
          </button>
        )}
      </div>

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

      {selectedEdge && (
        <div
          style={{ left: selectedEdge.pos.x, top: selectedEdge.pos.y }}
          className="absolute z-10 rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-zinc-300">Connection</span>
            <button onClick={() => setSelectedEdge(null)} className="text-zinc-400 hover:text-zinc-200">&times;</button>
          </div>
          <button
            onClick={() => deleteEdge(selectedEdge.id)}
            className="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
          >
            Delete Connection
          </button>
        </div>
      )}

      {pendingSuggestion && (
        <StateSuggestionPopup
          pendingSuggestion={pendingSuggestion}
          nodes={nodes}
          taxonomy={taxonomy}
          position={editorPos}
          onSelect={handleSuggestionSelect}
          onCreateNew={handleCreateNewState}
          onClose={() => setPendingSuggestion(null)}
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
