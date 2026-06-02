"use server";

import { auth } from "@/auth";
import { createSupabaseServer } from "@/lib/supabase";
import { serializeNode, serializeEdge, deserializeNodes, deserializeEdges } from "@/lib/graph";
import type { GraphNode, GraphEdge, Graph } from "@/lib/graph";

// --- Shared save logic ---

async function saveGraphData(
  userId: string,
  graphId: string | null,
  nodes: GraphNode[],
  edges: GraphEdge[],
): Promise<{ error?: string }> {
  const supabase = createSupabaseServer();

  const nodesQuery = supabase.from("graph_nodes").delete().eq("user_id", userId);
  const edgesQuery = supabase.from("graph_edges").delete().eq("user_id", userId);
  const [deleteNodes, deleteEdges] = await Promise.all([
    graphId ? nodesQuery.eq("graph_id", graphId) : nodesQuery.is("graph_id", null),
    graphId ? edgesQuery.eq("graph_id", graphId) : edgesQuery.is("graph_id", null),
  ]);

  if (deleteNodes.error || deleteEdges.error) {
    console.error("Failed to clear graph:", deleteNodes.error, deleteEdges.error);
    return { error: "Failed to save" };
  }

  if (nodes.length > 0) {
    const { error } = await supabase.from("graph_nodes").insert(nodes.map((n) => serializeNode(n, userId, graphId)));
    if (error) {
      console.error("Failed to insert nodes:", error);
      return { error: "Failed to save nodes" };
    }
  }

  if (edges.length > 0) {
    const { error } = await supabase.from("graph_edges").insert(edges.map((e) => serializeEdge(e, userId, graphId)));
    if (error) {
      console.error("Failed to insert edges:", error);
      return { error: "Failed to save edges" };
    }
  }
  return {};
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
      .select("id, source_node_id, target_node_id, metadata")
      .eq("user_id", userId)
      .is("graph_id", null),
  ]);

  if (nodesResult.error || edgesResult.error) {
    console.error("Failed to load graph:", nodesResult.error, edgesResult.error);
    return null;
  }

  return { nodes: deserializeNodes(nodesResult.data), edges: deserializeEdges(edgesResult.data) };
}

// --- Save ---

export async function saveGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };
  return saveGraphData(session.user.email, null, nodes, edges);
}

// --- Save flow graph ---

export async function saveFlowGraph(
  graphId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };
  return saveGraphData(session.user.email, graphId, nodes, edges);
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
      .select("id, source_node_id, target_node_id, metadata")
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
