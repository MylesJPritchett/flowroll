import type { StateCondition } from "@/lib/concepts";

export type GiNogi = "gi" | "nogi" | "";

// --- Media types ---

export interface MediaItem {
  type: "image" | "youtube";
  url: string;
  caption?: string;
  start?: number; // YouTube start time in seconds
  end?: number;   // YouTube end time in seconds
}

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
  media: MediaItem[];
  position_x: number;
  position_y: number;
}

export interface GraphActionNode {
  id: string;
  type: "action";
  action_id: string;
  action_name: string;
  actor: "A" | "B";
  media: MediaItem[];
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
  source_handle?: string;
  target_handle?: string;
  actor?: "A" | "B";
}

// --- Graph (container) type ---

export type GraphSource = "user" | "import" | "merge";

export interface Graph {
  id: string;
  name: string;
  description: string;
  source: GraphSource;
  created_at: string;
  updated_at: string;
}

// --- Serialization helpers ---

export function serializeNode(n: GraphNode, userId: string, graphId: string | null) {
  const base = {
    id: n.id,
    user_id: userId,
    ...(graphId ? { graph_id: graphId } : {}),
    position_x: n.position_x,
    position_y: n.position_y,
  };
  if (n.type === "action") {
    return { ...base, label: n.action_name, description: "", metadata: { type: "action", action_id: n.action_id, actor: n.actor, ...(n.media.length > 0 ? { media: n.media } : {}) } };
  }
  if (n.type === "finish") {
    return { ...base, label: n.label, description: "", metadata: { type: "finish" } };
  }
  return { ...base, label: n.position_name, description: n.description, metadata: { type: "state", state_id: n.state_id, label: n.label, conditions: n.conditions, giNogi: n.giNogi, ...(n.media.length > 0 ? { media: n.media } : {}) } };
}

export function serializeEdge(e: GraphEdge, userId: string, graphId: string | null) {
  return {
    id: e.id,
    user_id: userId,
    ...(graphId ? { graph_id: graphId } : {}),
    source_node_id: e.source_node_id,
    target_node_id: e.target_node_id,
    relationship: "",
    metadata: {
      ...(e.source_handle ? { source_handle: e.source_handle } : {}),
      ...(e.target_handle ? { target_handle: e.target_handle } : {}),
      ...(e.actor ? { actor: e.actor } : {}),
    },
  };
}

// --- Deserialization helpers ---

export function deserializeNodes(rows: Record<string, unknown>[]): GraphNode[] {
  return rows.map((row) => {
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    if (meta.type === "action") {
      return {
        id: row.id as string,
        type: "action" as const,
        action_id: (meta.action_id as string) ?? "",
        action_name: (row.label as string) ?? "",
        actor: (meta.actor as "A" | "B") ?? "A",
        media: (meta.media as MediaItem[]) ?? [],
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
      media: (meta.media as MediaItem[]) ?? [],
      position_x: row.position_x as number,
      position_y: row.position_y as number,
      conditions: (meta.conditions as StateCondition[]) ?? [],
      giNogi: (meta.giNogi as GiNogi) ?? "",
    };
  });
}

export function deserializeEdges(rows: Record<string, unknown>[]): GraphEdge[] {
  return rows.map((row) => {
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    return {
      id: row.id as string,
      source_node_id: row.source_node_id as string,
      target_node_id: row.target_node_id as string,
      ...(meta.source_handle ? { source_handle: meta.source_handle as string } : {}),
      ...(meta.target_handle ? { target_handle: meta.target_handle as string } : {}),
      ...(meta.actor ? { actor: meta.actor as "A" | "B" } : {}),
    };
  });
}
