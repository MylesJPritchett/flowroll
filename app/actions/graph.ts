"use server";

import { auth } from "@/auth";
import { createSupabaseServer } from "@/lib/supabase";
import type { StateCondition } from "../concepts";

export type GiNogi = "gi" | "nogi" | "";

// --- Node types ---

export interface GraphStateNode {
  id: string;
  type: "state";
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

export type GraphNode = GraphStateNode | GraphActionNode;

// --- Edge type (simple connector) ---

export interface GraphEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
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
      .eq("user_id", userId),
    supabase
      .from("graph_edges")
      .select("id, source_node_id, target_node_id")
      .eq("user_id", userId),
  ]);

  if (nodesResult.error || edgesResult.error) {
    console.error("Failed to load graph:", nodesResult.error, edgesResult.error);
    return null;
  }

  const nodes: GraphNode[] = nodesResult.data.map((row: Record<string, unknown>) => {
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
    return {
      id: row.id as string,
      type: "state" as const,
      position_name: (row.label as string) ?? "New State",
      description: (row.description as string) ?? "",
      position_x: row.position_x as number,
      position_y: row.position_y as number,
      conditions: (meta.conditions as StateCondition[]) ?? [],
      giNogi: (meta.giNogi as GiNogi) ?? "",
    };
  });

  const edges: GraphEdge[] = edgesResult.data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    source_node_id: row.source_node_id as string,
    target_node_id: row.target_node_id as string,
  }));

  return { nodes, edges };
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
    supabase.from("graph_nodes").delete().eq("user_id", userId),
    supabase.from("graph_edges").delete().eq("user_id", userId),
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
        return {
          id: n.id,
          user_id: userId,
          label: n.position_name,
          description: n.description,
          position_x: n.position_x,
          position_y: n.position_y,
          metadata: { type: "state", conditions: n.conditions, giNogi: n.giNogi },
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
