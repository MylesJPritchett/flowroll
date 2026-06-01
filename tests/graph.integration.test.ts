import { describe, it, expect, afterAll } from "vitest";
import { getTestClient, cleanupTestUser } from "./setup-integration";
import {
  createGraph,
  loadGraphs,
  loadGraphById,
  saveFlowGraph,
  deleteGraph,
} from "@/app/actions/graph";
import type { GraphNode, GraphEdge } from "@/lib/graph";

const db = getTestClient();

afterAll(async () => {
  await cleanupTestUser(db);
});

let idCounter = 0;
function uid(prefix = "t") {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

describe("graph CRUD", () => {
  it("creates a graph", async () => {
    const graph = await createGraph("Test Flow", "a test graph");
    expect(graph).not.toBeNull();
    expect(graph!.name).toBe("Test Flow");
    expect(graph!.description).toBe("a test graph");
  });

  it("lists user graphs", async () => {
    await createGraph("Flow A");
    await createGraph("Flow B");

    const graphs = await loadGraphs();
    const testGraphs = graphs.filter((g) => g.name === "Flow A" || g.name === "Flow B");
    expect(testGraphs).toHaveLength(2);
  });

  it("loads a graph by ID with empty nodes/edges", async () => {
    const graph = await createGraph("Empty Flow");
    const loaded = await loadGraphById(graph!.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.graph.name).toBe("Empty Flow");
    expect(loaded!.nodes).toHaveLength(0);
    expect(loaded!.edges).toHaveLength(0);
  });

  it("deletes a graph", async () => {
    const graph = await createGraph("Delete Me");
    const ok = await deleteGraph(graph!.id);
    expect(ok).toBe(true);

    const { data } = await db.from("graphs").select("id").eq("id", graph!.id);
    expect(data).toHaveLength(0);
  });
});

describe("saveFlowGraph + loadGraphById round-trip", () => {
  it("saves and loads nodes and edges", async () => {
    const graph = await createGraph("Round Trip Flow");
    const graphId = graph!.id;
    const n1 = uid("n"), n2 = uid("n"), n3 = uid("n");
    const e1 = uid("e"), e2 = uid("e");

    const nodes: GraphNode[] = [
      {
        id: n1,
        type: "state",
        state_id: "",
        label: "Standard",
        position_name: "Closed Guard",
        conditions: [],
        giNogi: "",
        description: "",
        position_x: 100,
        position_y: 200,
      },
      {
        id: n2,
        type: "action",
        action_id: "",
        action_name: "Scissor Sweep",
        actor: "A",
        position_x: 350,
        position_y: 200,
      },
      {
        id: n3,
        type: "finish",
        label: "Submitted",
        position_x: 600,
        position_y: 200,
      },
    ];

    const edges: GraphEdge[] = [
      { id: e1, source_node_id: n1, target_node_id: n2 },
      { id: e2, source_node_id: n2, target_node_id: n3 },
    ];

    const saveResult = await saveFlowGraph(graphId, nodes, edges);
    expect(saveResult.error).toBeUndefined();

    const loaded = await loadGraphById(graphId);
    expect(loaded).not.toBeNull();
    expect(loaded!.nodes).toHaveLength(3);
    expect(loaded!.edges).toHaveLength(2);

    // Verify node types are deserialized correctly
    const stateNode = loaded!.nodes.find((n) => n.type === "state");
    const actionNode = loaded!.nodes.find((n) => n.type === "action");
    const finishNode = loaded!.nodes.find((n) => n.type === "finish");
    expect(stateNode).toBeDefined();
    expect(actionNode).toBeDefined();
    expect(finishNode).toBeDefined();

    if (stateNode?.type === "state") {
      expect(stateNode.position_name).toBe("Closed Guard");
      expect(stateNode.label).toBe("Standard");
    }
    if (actionNode?.type === "action") {
      expect(actionNode.action_name).toBe("Scissor Sweep");
      expect(actionNode.actor).toBe("A");
    }
    if (finishNode?.type === "finish") {
      expect(finishNode.label).toBe("Submitted");
    }
  });

  it("overwrites previous nodes on re-save", async () => {
    const graph = await createGraph("Overwrite Flow");
    const graphId = graph!.id;

    // Save 3 nodes
    await saveFlowGraph(graphId, [
      { id: uid("n"), type: "state", state_id: "", label: "", position_name: "Guard", conditions: [], giNogi: "", description: "", position_x: 0, position_y: 0 },
      { id: uid("n"), type: "state", state_id: "", label: "", position_name: "Mount", conditions: [], giNogi: "", description: "", position_x: 0, position_y: 0 },
      { id: uid("n"), type: "state", state_id: "", label: "", position_name: "Back", conditions: [], giNogi: "", description: "", position_x: 0, position_y: 0 },
    ], []);

    // Re-save with 1 node
    await saveFlowGraph(graphId, [
      { id: uid("n"), type: "finish", label: "Done", position_x: 0, position_y: 0 },
    ], []);

    const loaded = await loadGraphById(graphId);
    expect(loaded!.nodes).toHaveLength(1);
    expect(loaded!.nodes[0].type).toBe("finish");
  });

  it("deleting a graph cascades to nodes and edges", async () => {
    const graph = await createGraph("Cascade Flow");
    const graphId = graph!.id;

    await saveFlowGraph(graphId, [
      { id: uid("n"), type: "finish", label: "End", position_x: 0, position_y: 0 },
    ], []);

    await deleteGraph(graphId);

    const { data: nodes } = await db.from("graph_nodes").select("id").eq("graph_id", graphId);
    const { data: edges } = await db.from("graph_edges").select("id").eq("graph_id", graphId);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });
});
