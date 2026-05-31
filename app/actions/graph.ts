"use server";

import { auth } from "@/auth";
import { createSupabaseServer } from "@/lib/supabase";
import type { StateCondition } from "../concepts";

export interface GraphNode {
  id: string;
  position_name: string;
  conditions: StateCondition[];
  giNogi: GiNogi;
  description: string;
  position_x: number;
  position_y: number;
}

export type GiNogi = "gi" | "nogi" | "";

export interface GraphEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  label: string;
  actor: "A" | "B";
  giNogi: GiNogi;
  description: string;
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
      .select("id, label, description, position_x, position_y, metadata")
      .eq("user_id", userId),
    supabase
      .from("graph_edges")
      .select("id, source_node_id, target_node_id, relationship, metadata")
      .eq("user_id", userId),
  ]);

  if (nodesResult.error || edgesResult.error) {
    console.error("Failed to load graph:", nodesResult.error, edgesResult.error);
    return null;
  }

  const nodes: GraphNode[] = nodesResult.data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    position_name: (row.label as string) ?? "New State",
    description: (row.description as string) ?? "",
    position_x: row.position_x as number,
    position_y: row.position_y as number,
    conditions: ((row.metadata as Record<string, unknown>)?.conditions as StateCondition[]) ?? [],
    giNogi: ((row.metadata as Record<string, unknown>)?.giNogi as GiNogi) ?? "",
  }));

  const edges: GraphEdge[] = edgesResult.data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    source_node_id: row.source_node_id as string,
    target_node_id: row.target_node_id as string,
    label: (row.relationship as string) ?? "",
    actor: ((row.metadata as Record<string, unknown>)?.actor as "A" | "B") ?? "A",
    giNogi: ((row.metadata as Record<string, unknown>)?.giNogi as GiNogi) ?? "",
    description: ((row.metadata as Record<string, unknown>)?.description as string) ?? "",
  }));

  return { nodes, edges };
}

export async function saveGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };

  const supabase = createSupabaseServer();
  const userId = session.user.email;

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
        label: n.position_name,
        description: n.description,
        position_x: n.position_x,
        position_y: n.position_y,
        metadata: { conditions: n.conditions, giNogi: n.giNogi },
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
        relationship: e.label,
        metadata: { actor: e.actor, giNogi: e.giNogi, description: e.description },
      })),
    );
    if (error) {
      console.error("Failed to insert edges:", error);
      return { error: "Failed to save edges" };
    }
  }
  return {};
}
