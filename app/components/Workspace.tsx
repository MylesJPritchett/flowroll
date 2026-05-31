"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadGraph, saveGraph, type GraphNode, type GraphEdge, type GraphStateNode, type GraphActionNode } from "../actions/graph";
import { loadTaxonomy } from "../actions/taxonomy";
import GraphEditor from "./GraphEditor";
import ListView from "./StateListView";

type View = "list" | "graph";

import type { Taxonomy } from "../concepts";
export type { Taxonomy };

export default function Workspace() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [view, setView] = useState<View>("list");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

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
  }, []);

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
      position_name: "New State",
      conditions: [],
      giNogi: "",
      description: "",
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
        {(["list", "graph"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              view === v
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            {v === "list" ? "List" : "Graph"}
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
        {view === "list" ? (
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
          />
        ) : (
          <GraphEditor
            nodes={nodes}
            edges={edges}
            taxonomy={taxonomy}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
          />
        )}
      </div>
    </div>
  );
}
