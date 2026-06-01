"use server";

import { auth } from "@/auth";
import { createSupabaseServer } from "@/lib/supabase";
import type { StateCondition } from "../concepts";

export type GiNogi = "gi" | "nogi" | "";

// --- Node types ---

export interface GraphStateNode {
  id: string;
  type: "state";
  state_id: string;
  label: string;
  position_name: string;
  conditions: StateCondition[];
  giNogi: GiNogi;
  description: string;
  position_x: number;
  position_y: number;
}

export interface GraphActionNode {
  id: string;
  type: "action";
  action_id: string;
  action_name: string;
  actor: "A" | "B";
  position_x: number;
  position_y: number;
}

export interface GraphFinishNode {
  id: string;
  type: "finish";
  label: string;
  position_x: number;
  position_y: number;
}

export type GraphNode = GraphStateNode | GraphActionNode | GraphFinishNode;

// --- Edge type (simple connector) ---

export interface GraphEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
}

// --- Graph (container) type ---

export interface Graph {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// --- Load ---

export async function loadGraph(): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
} | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const supabase = createSupabaseServer();
  const userId = session.user.email;

  const [nodesResult, edgesResult] = await Promise.all([
    supabase
      .from("graph_nodes")
      .select("id, label, description, position_x, position_y, metadata")
      .eq("user_id", userId)
      .is("graph_id", null),
    supabase
      .from("graph_edges")
      .select("id, source_node_id, target_node_id")
      .eq("user_id", userId)
      .is("graph_id", null),
  ]);

  if (nodesResult.error || edgesResult.error) {
    console.error("Failed to load graph:", nodesResult.error, edgesResult.error);
    return null;
  }

  return { nodes: deserializeNodes(nodesResult.data), edges: deserializeEdges(edgesResult.data) };
}

function deserializeNodes(rows: Record<string, unknown>[]): GraphNode[] {
  return rows.map((row) => {
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    if (meta.type === "action") {
      return {
        id: row.id as string,
        type: "action" as const,
        action_id: (meta.action_id as string) ?? "",
        action_name: (row.label as string) ?? "",
        actor: (meta.actor as "A" | "B") ?? "A",
        position_x: row.position_x as number,
        position_y: row.position_y as number,
      };
    }
    if (meta.type === "finish") {
      return {
        id: row.id as string,
        type: "finish" as const,
        label: (row.label as string) ?? "Submitted",
        position_x: row.position_x as number,
        position_y: row.position_y as number,
      };
    }
    return {
      id: row.id as string,
      type: "state" as const,
      state_id: (meta.state_id as string) ?? "",
      label: (meta.label as string) ?? "",
      position_name: (row.label as string) ?? "New State",
      description: (row.description as string) ?? "",
      position_x: row.position_x as number,
      position_y: row.position_y as number,
      conditions: (meta.conditions as StateCondition[]) ?? [],
      giNogi: (meta.giNogi as GiNogi) ?? "",
    };
  });
}

function deserializeEdges(rows: Record<string, unknown>[]): GraphEdge[] {
  return rows.map((row) => ({
    id: row.id as string,
    source_node_id: row.source_node_id as string,
    target_node_id: row.target_node_id as string,
  }));
}

// --- Save ---

export async function saveGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };

  const supabase = createSupabaseServer();
  const userId = session.user.email;

  const [deleteNodes, deleteEdges] = await Promise.all([
    supabase.from("graph_nodes").delete().eq("user_id", userId).is("graph_id", null),
    supabase.from("graph_edges").delete().eq("user_id", userId).is("graph_id", null),
  ]);

  if (deleteNodes.error || deleteEdges.error) {
    console.error("Failed to clear graph:", deleteNodes.error, deleteEdges.error);
    return { error: "Failed to save" };
  }

  if (nodes.length > 0) {
    const { error } = await supabase.from("graph_nodes").insert(
      nodes.map((n) => {
        if (n.type === "action") {
          return {
            id: n.id,
            user_id: userId,
            label: n.action_name,
            description: "",
            position_x: n.position_x,
            position_y: n.position_y,
            metadata: { type: "action", action_id: n.action_id, actor: n.actor },
          };
        }
        if (n.type === "finish") {
          return {
            id: n.id,
            user_id: userId,
            label: n.label,
            description: "",
            position_x: n.position_x,
            position_y: n.position_y,
            metadata: { type: "finish" },
          };
        }
        return {
          id: n.id,
          user_id: userId,
          label: n.position_name,
          description: n.description,
          position_x: n.position_x,
          position_y: n.position_y,
          metadata: { type: "state", state_id: n.state_id, label: n.label, conditions: n.conditions, giNogi: n.giNogi },
        };
      }),
    );
    if (error) {
      console.error("Failed to insert nodes:", error);
      return { error: "Failed to save nodes" };
    }
  }

  if (edges.length > 0) {
    const { error } = await supabase.from("graph_edges").insert(
      edges.map((e) => ({
        id: e.id,
        user_id: userId,
        source_node_id: e.source_node_id,
        target_node_id: e.target_node_id,
        relationship: "",
        metadata: {},
      })),
    );
    if (error) {
      console.error("Failed to insert edges:", error);
      return { error: "Failed to save edges" };
    }
  }
  return {};
}

// --- Save flow graph ---

export async function saveFlowGraph(
  graphId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };

  const supabase = createSupabaseServer();
  const userId = session.user.email;

  const [deleteNodes, deleteEdges] = await Promise.all([
    supabase.from("graph_nodes").delete().eq("user_id", userId).eq("graph_id", graphId),
    supabase.from("graph_edges").delete().eq("user_id", userId).eq("graph_id", graphId),
  ]);

  if (deleteNodes.error || deleteEdges.error) {
    return { error: "Failed to save" };
  }

  if (nodes.length > 0) {
    const { error } = await supabase.from("graph_nodes").insert(
      nodes.map((n) => {
        if (n.type === "action") {
          return {
            id: n.id, user_id: userId, graph_id: graphId,
            label: n.action_name, description: "",
            position_x: n.position_x, position_y: n.position_y,
            metadata: { type: "action", action_id: n.action_id, actor: n.actor },
          };
        }
        if (n.type === "finish") {
          return {
            id: n.id, user_id: userId, graph_id: graphId,
            label: n.label, description: "",
            position_x: n.position_x, position_y: n.position_y,
            metadata: { type: "finish" },
          };
        }
        return {
          id: n.id, user_id: userId, graph_id: graphId,
          label: n.position_name, description: n.description,
          position_x: n.position_x, position_y: n.position_y,
          metadata: { type: "state", state_id: n.state_id, label: n.label, conditions: n.conditions, giNogi: n.giNogi },
        };
      }),
    );
    if (error) return { error: "Failed to save nodes" };
  }

  if (edges.length > 0) {
    const { error } = await supabase.from("graph_edges").insert(
      edges.map((e) => ({
        id: e.id, user_id: userId, graph_id: graphId,
        source_node_id: e.source_node_id, target_node_id: e.target_node_id,
        relationship: "", metadata: {},
      })),
    );
    if (error) return { error: "Failed to save edges" };
  }

  return {};
}

// --- Sub-graph CRUD ---

export async function loadGraphs(): Promise<Graph[]> {
  const session = await auth();
  if (!session?.user?.email) return [];

  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("graphs")
    .select("*")
    .eq("user_id", session.user.email)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load graphs:", error);
    return [];
  }
  return data as Graph[];
}

export async function loadGraphById(graphId: string): Promise<{
  graph: Graph;
  nodes: GraphNode[];
  edges: GraphEdge[];
} | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const supabase = createSupabaseServer();
  const userId = session.user.email;

  const [graphResult, nodesResult, edgesResult] = await Promise.all([
    supabase.from("graphs").select("*").eq("id", graphId).eq("user_id", userId).single(),
    supabase
      .from("graph_nodes")
      .select("id, label, description, position_x, position_y, metadata")
      .eq("user_id", userId)
      .eq("graph_id", graphId),
    supabase
      .from("graph_edges")
      .select("id, source_node_id, target_node_id")
      .eq("user_id", userId)
      .eq("graph_id", graphId),
  ]);

  if (graphResult.error || nodesResult.error || edgesResult.error) return null;

  return {
    graph: graphResult.data as Graph,
    nodes: deserializeNodes(nodesResult.data),
    edges: deserializeEdges(edgesResult.data),
  };
}

export async function createGraph(name: string, description = ""): Promise<Graph | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("graphs")
    .insert({ user_id: session.user.email, name, description })
    .select()
    .single();

  if (error) {
    console.error("Failed to create graph:", error);
    return null;
  }
  return data as Graph;
}

export async function deleteGraph(graphId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.email) return false;

  const supabase = createSupabaseServer();
  // Nodes/edges cascade-delete via FK
  const { error } = await supabase
    .from("graphs")
    .delete()
    .eq("id", graphId)
    .eq("user_id", session.user.email);

  if (error) {
    console.error("Failed to delete graph:", error);
    return false;
  }
  return true;
}
