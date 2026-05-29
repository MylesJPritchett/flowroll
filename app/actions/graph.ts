"use server";

import { auth } from "@/auth";
import { createSupabaseServer } from "@/lib/supabase";

export interface GraphNode {
  id: string;
  label: string;
  description: string;
  position_x: number;
  position_y: number;
}

export interface GraphEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship: string;
}

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
      .select("id, label, description, position_x, position_y")
      .eq("user_id", userId),
    supabase
      .from("graph_edges")
      .select("id, source_node_id, target_node_id, relationship")
      .eq("user_id", userId),
  ]);

  if (nodesResult.error || edgesResult.error) {
    console.error("Failed to load graph:", nodesResult.error, edgesResult.error);
    return null;
  }

  return { nodes: nodesResult.data, edges: edgesResult.data };
}

export async function saveGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };

  const supabase = createSupabaseServer();
  const userId = session.user.email;

  // Delete existing data and replace with current state
  const [deleteNodes, deleteEdges] = await Promise.all([
    supabase.from("graph_nodes").delete().eq("user_id", userId),
    supabase.from("graph_edges").delete().eq("user_id", userId),
  ]);

  if (deleteNodes.error || deleteEdges.error) {
    console.error("Failed to clear graph:", deleteNodes.error, deleteEdges.error);
    return { error: "Failed to save" };
  }

  if (nodes.length > 0) {
    const { error } = await supabase.from("graph_nodes").insert(
      nodes.map((n) => ({
        id: n.id,
        user_id: userId,
        label: n.label,
        description: n.description,
        position_x: n.position_x,
        position_y: n.position_y,
      })),
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
        relationship: e.relationship,
      })),
    );
    if (error) {
      console.error("Failed to insert edges:", error);
      return { error: "Failed to save edges" };
    }
  }
  return {};
}
