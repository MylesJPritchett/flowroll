"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadGraph, saveGraph, saveFlowGraph, loadGraphs, loadGraphById, createGraph, deleteGraph } from "../actions/graph";
import type { GraphNode, GraphEdge, GraphStateNode, GraphActionNode, GraphFinishNode, GraphSource } from "@/lib/graph";
import { loadTaxonomy } from "../actions/taxonomy";
import GraphEditor, { type FlowGraph } from "./GraphEditor";
import ImportView from "./ImportView";
import ListView from "./StateListView";

type View = "list" | "graph" | "import";

import type { Taxonomy } from "@/lib/concepts";

export default function Workspace() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [flowGraphs, setFlowGraphs] = useState<FlowGraph[]>([]);
  const [view, setView] = useState<View>("graph");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  const loadFlowGraphs = useCallback(async () => {
    const graphs = await loadGraphs();
    const loaded: FlowGraph[] = [];
    for (const g of graphs) {
      const data = await loadGraphById(g.id);
      if (data) {
        loaded.push({ id: g.id, name: data.graph.name, source: data.graph.source, nodes: data.nodes, edges: data.edges });
      }
    }
    setFlowGraphs(loaded);
  }, []);

  useEffect(() => {
    Promise.all([loadGraph(), loadTaxonomy()]).then(([graphData, taxData]) => {
      if (graphData) {
        setNodes(graphData.nodes);
        setEdges(graphData.edges);
      }
      if (taxData) {
        setTaxonomy(taxData);
      }
      setLoading(false);
      setTimeout(() => { initialized.current = true; }, 100);
    });
    loadFlowGraphs();
  }, [loadFlowGraphs]);

  const scheduleSave = useCallback((currentNodes: GraphNode[], currentEdges: GraphEdge[]) => {
    if (!initialized.current) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      await saveGraph(currentNodes, currentEdges);
      setSaving(false);
    }, 1500);
  }, []);

  useEffect(() => {
    scheduleSave(nodes, edges);
  }, [nodes, edges, scheduleSave]);

  // --- State node operations ---
  const addStateNode = useCallback(() => {
    const id = `${Date.now()}`;
    const newNode: GraphStateNode = {
      id,
      type: "state",
      state_id: "",
      label: "",
      position_name: "New State",
      conditions: [],
      giNogi: "",
      description: "",
      media: [],
      position_x: Math.random() * 400 + 100,
      position_y: Math.random() * 400 + 100,
    };
    setNodes((prev) => [...prev, newNode]);
  }, []);

  const updateStateNode = useCallback((updated: GraphStateNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  // --- Action node operations ---
  const addActionNode = useCallback(() => {
    const id = `${Date.now()}`;
    const newNode: GraphActionNode = {
      id,
      type: "action",
      action_id: "",
      action_name: "",
      actor: "A",
      media: [],
      position_x: Math.random() * 400 + 100,
      position_y: Math.random() * 400 + 100,
    };
    setNodes((prev) => [...prev, newNode]);
  }, []);

  const updateActionNode = useCallback((updated: GraphActionNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source_node_id !== id && e.target_node_id !== id));
  }, []);

  const refreshTaxonomy = useCallback(() => {
    loadTaxonomy().then((data) => {
      if (data) setTaxonomy(data);
    });
  }, []);

  const handleCreateFlow = useCallback(async (name: string, source: GraphSource = "user"): Promise<string | null> => {
    const graph = await createGraph(name, "", source);
    if (!graph) return null;
    const flow: FlowGraph = { id: graph.id, name: graph.name, source: graph.source, nodes: [], edges: [] };
    setFlowGraphs((prev) => [...prev, flow]);
    return graph.id;
  }, []);

  const handleDeleteFlow = useCallback(async (id: string) => {
    await deleteGraph(id);
    setFlowGraphs((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleInsertFlow = useCallback((flowNodes: GraphNode[], flowEdges: GraphEdge[], targetFlowId: string | null) => {
    const now = Date.now();
    const idMap = new Map(flowNodes.map((n, i) => [n.id, `${now}-${i}`]));

    const targetNodes = targetFlowId
      ? (flowGraphs.find((f) => f.id === targetFlowId)?.nodes ?? [])
      : nodes;

    const maxX = targetNodes.reduce((max, n) => Math.max(max, n.position_x), 0);
    const offsetX = maxX + 300;

    const newNodes: GraphNode[] = flowNodes.map((n) => ({
      ...n, id: idMap.get(n.id)!, position_x: n.position_x + offsetX,
    }));

    const newEdges: GraphEdge[] = flowEdges.map((e, i) => ({
      id: `${now}-e${i}`,
      source_node_id: idMap.get(e.source_node_id) ?? e.source_node_id,
      target_node_id: idMap.get(e.target_node_id) ?? e.target_node_id,
    }));

    if (targetFlowId) {
      // Insert into a named flow
      setFlowGraphs((prev) => prev.map((f) =>
        f.id === targetFlowId
          ? { ...f, nodes: [...f.nodes, ...newNodes], edges: [...f.edges, ...newEdges] }
          : f,
      ));
      // Also persist
      const target = flowGraphs.find((f) => f.id === targetFlowId);
      if (target) {
        const allNodes = [...target.nodes, ...newNodes];
        const allEdges = [...target.edges, ...newEdges];
        saveFlowGraph(targetFlowId, allNodes, allEdges);
      }
    } else {
      // Insert into My Graph
      setNodes((prev) => [...prev, ...newNodes]);
      setEdges((prev) => [...prev, ...newEdges]);
    }
  }, [nodes, flowGraphs]);

  const handleFlowChange = useCallback((flowId: string, newNodes: GraphNode[], newEdges: GraphEdge[]) => {
    setFlowGraphs((prev) => prev.map((f) =>
      f.id === flowId ? { ...f, nodes: newNodes, edges: newEdges } : f,
    ));
  }, []);

  // Auto-save flow graphs
  const flowSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flowSaveRef = useRef<{ id: string; nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);

  const scheduleFlowSave = useCallback((flowId: string, flowNodes: GraphNode[], flowEdges: GraphEdge[]) => {
    flowSaveRef.current = { id: flowId, nodes: flowNodes, edges: flowEdges };
    if (flowSaveTimeout.current) clearTimeout(flowSaveTimeout.current);
    flowSaveTimeout.current = setTimeout(async () => {
      const pending = flowSaveRef.current;
      if (pending) {
        setSaving(true);
        await saveFlowGraph(pending.id, pending.nodes, pending.edges);
        setSaving(false);
      }
    }, 1500);
  }, []);

  // --- Merge all flows into the Auto Merged flow ---
  const handleMergeFlows = useCallback(async () => {
    // Collect all non-merge flows + main graph
    const sourceFlows = flowGraphs.filter((f) => f.source !== "merge");
    if (sourceFlows.length === 0 && nodes.length === 0) return;

    const mergedNodes: GraphNode[] = [...nodes];
    const mergedEdges: GraphEdge[] = [...edges];

    // Track state nodes by identity (position_name + sorted conditions key)
    function stateKey(n: GraphStateNode): string {
      const condKey = [...n.conditions]
        .sort((a, b) => `${a.groupId}:${a.role}:${a.value}`.localeCompare(`${b.groupId}:${b.role}:${b.value}`))
        .map((c) => `${c.groupId}:${c.role}:${c.value}`)
        .join("|");
      return `${n.position_name}::${condKey}`;
    }

    function finishKey(n: GraphFinishNode): string {
      return `finish::${n.label.toLowerCase()}`;
    }

    // Build index of existing nodes in the merged graph
    const stateIndex = new Map<string, string>(); // stateKey -> node id
    const finishIndex = new Map<string, string>(); // finishKey -> node id
    for (const n of mergedNodes) {
      if (n.type === "state") stateIndex.set(stateKey(n), n.id);
      if (n.type === "finish") finishIndex.set(finishKey(n), n.id);
    }

    const existingEdgeKeys = new Set(
      mergedEdges.map((e) => `${e.source_node_id}->${e.target_node_id}`),
    );

    let counter = Date.now();

    for (const flow of sourceFlows) {
      // Map from flow node id -> merged node id
      const idMap = new Map<string, string>();

      // First pass: map state/finish nodes (merge matching, add new)
      for (const n of flow.nodes) {
        if (n.type === "state") {
          const key = stateKey(n);
          const existingId = stateIndex.get(key);
          if (existingId) {
            // Merge into existing node
            idMap.set(n.id, existingId);
          } else {
            // Add as new node with new ID
            const newId = `${counter++}`;
            idMap.set(n.id, newId);
            const newNode: GraphStateNode = { ...n, id: newId };
            mergedNodes.push(newNode);
            stateIndex.set(key, newId);
          }
        } else if (n.type === "finish") {
          const key = finishKey(n);
          const existingId = finishIndex.get(key);
          if (existingId) {
            idMap.set(n.id, existingId);
          } else {
            const newId = `${counter++}`;
            idMap.set(n.id, newId);
            const newNode: GraphFinishNode = { ...n, id: newId };
            mergedNodes.push(newNode);
            finishIndex.set(key, newId);
          }
        }
      }

      // Second pass: action nodes always get added (they're edges between states)
      for (const n of flow.nodes) {
        if (n.type === "action") {
          const newId = `${counter++}`;
          idMap.set(n.id, newId);
          const newNode: GraphActionNode = { ...n, id: newId };
          mergedNodes.push(newNode);
        }
      }

      // Add edges with remapped IDs, skip duplicates
      for (const e of flow.edges) {
        const sourceId = idMap.get(e.source_node_id) ?? e.source_node_id;
        const targetId = idMap.get(e.target_node_id) ?? e.target_node_id;
        const edgeKey = `${sourceId}->${targetId}`;
        if (existingEdgeKeys.has(edgeKey)) continue;
        existingEdgeKeys.add(edgeKey);
        mergedEdges.push({
          ...e,
          id: `${counter++}`,
          source_node_id: sourceId,
          target_node_id: targetId,
        });
      }
    }

    // Auto-layout: spread out nodes that overlap
    // Group by position and apply force-directed-ish spacing
    const positionMap = new Map<string, GraphNode>();
    for (const n of mergedNodes) positionMap.set(n.id, n);

    // Simple layout: for newly added nodes without good positions,
    // arrange them in a grid-like pattern based on graph depth
    // (BFS from nodes with no incoming edges)
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();
    for (const e of mergedEdges) {
      if (!outgoing.has(e.source_node_id)) outgoing.set(e.source_node_id, []);
      outgoing.get(e.source_node_id)!.push(e.target_node_id);
      if (!incoming.has(e.target_node_id)) incoming.set(e.target_node_id, []);
      incoming.get(e.target_node_id)!.push(e.source_node_id);
    }

    // Find roots (no incoming edges)
    const roots = mergedNodes.filter((n) => !incoming.has(n.id) || incoming.get(n.id)!.length === 0);

    // BFS to assign layers
    const layer = new Map<string, number>();
    const queue = roots.map((n) => ({ id: n.id, depth: 0 }));
    const visited = new Set<string>();
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      layer.set(id, depth);
      for (const targetId of outgoing.get(id) ?? []) {
        if (!visited.has(targetId)) {
          queue.push({ id: targetId, depth: depth + 1 });
        }
      }
    }

    // Assign positions by layer
    const layerNodes = new Map<number, string[]>();
    for (const [id, d] of layer) {
      if (!layerNodes.has(d)) layerNodes.set(d, []);
      layerNodes.get(d)!.push(id);
    }

    const xSpacing = 250;
    const ySpacing = 150;
    for (const [d, nodeIds] of layerNodes) {
      const totalHeight = (nodeIds.length - 1) * ySpacing;
      nodeIds.forEach((id, i) => {
        const n = positionMap.get(id);
        if (n) {
          n.position_x = d * xSpacing + 100;
          n.position_y = i * ySpacing - totalHeight / 2 + 300;
        }
      });
    }

    // Handle unvisited nodes (disconnected)
    let offsetY = 600;
    for (const n of mergedNodes) {
      if (!visited.has(n.id)) {
        n.position_x = 100;
        n.position_y = offsetY;
        offsetY += 100;
      }
    }

    // Find or create the merge flow
    let mergeFlow = flowGraphs.find((f) => f.source === "merge");
    if (!mergeFlow) {
      const graph = await createGraph("Auto Merged", "", "merge");
      if (!graph) return;
      mergeFlow = { id: graph.id, name: graph.name, source: graph.source, nodes: [], edges: [] };
      setFlowGraphs((prev) => [...prev, mergeFlow!]);
    }

    // Update merge flow with merged data
    setFlowGraphs((prev) => prev.map((f) =>
      f.id === mergeFlow!.id
        ? { ...f, nodes: mergedNodes, edges: mergedEdges }
        : f,
    ));
    await saveFlowGraph(mergeFlow.id, mergedNodes, mergedEdges);
  }, [nodes, edges, flowGraphs]);

  if (loading || !taxonomy) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex items-center gap-1 border-b border-zinc-800 bg-zinc-950 px-4 py-1.5">
        {(["list", "graph", "import"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              view === v
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            {v === "list" ? "List" : v === "graph" ? "Graph" : "Import"}
          </button>
        ))}
        <a
          href="/database"
          className="ml-auto rounded-md px-3 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Database
        </a>
        {saving && (
          <span className="text-[10px] text-zinc-500">Saving...</span>
        )}
      </div>

      <div className="relative flex-1">
        {view === "import" ? (
          <ImportView
            onImported={() => {
              refreshTaxonomy();
              // Reload graph to pick up new state nodes
              loadGraph().then((graphData) => {
                if (graphData) {
                  setNodes(graphData.nodes);
                  setEdges(graphData.edges);
                }
              });
              loadFlowGraphs();
            }}
          />
        ) : view === "list" ? (
          <ListView
            stateNodes={nodes.filter((n): n is GraphStateNode => n.type === "state")}
            actionNodes={nodes.filter((n): n is GraphActionNode => n.type === "action")}
            taxonomy={taxonomy}
            onAddState={addStateNode}
            onUpdateState={updateStateNode}
            onDeleteState={deleteNode}
            onAddAction={addActionNode}
            onUpdateAction={updateActionNode}
            onDeleteAction={deleteNode}
            onTaxonomyChange={refreshTaxonomy}
          />
        ) : (
          <GraphEditor
            nodes={nodes}
            edges={edges}
            taxonomy={taxonomy}
            flowGraphs={flowGraphs}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
            onFlowChange={handleFlowChange}
            onFlowSave={scheduleFlowSave}
            onInsertFlow={handleInsertFlow}
            onCreateFlow={handleCreateFlow}
            onMergeFlows={handleMergeFlows}
            onTaxonomyChange={refreshTaxonomy}
            onDeleteFlow={handleDeleteFlow}
          />
        )}
      </div>
    </div>
  );
}
