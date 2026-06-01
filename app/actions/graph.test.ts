import { describe, it, expect } from "vitest";
import { deserializeNodes, deserializeEdges, serializeNode, serializeEdge } from "@/lib/graph";
import type { GraphStateNode, GraphActionNode, GraphFinishNode, GraphEdge } from "@/lib/graph";

describe("deserializeNodes", () => {
  it("deserializes an action node", () => {
    const rows = [
      {
        id: "n1",
        label: "Scissor Sweep",
        description: "",
        position_x: 100,
        position_y: 200,
        metadata: { type: "action", action_id: "a1", actor: "B" },
      },
    ];
    const nodes = deserializeNodes(rows);
    expect(nodes).toEqual([
      {
        id: "n1",
        type: "action",
        action_id: "a1",
        action_name: "Scissor Sweep",
        actor: "B",
        position_x: 100,
        position_y: 200,
      },
    ]);
  });

  it("defaults actor to A when missing", () => {
    const rows = [
      {
        id: "n1",
        label: "Sweep",
        description: "",
        position_x: 0,
        position_y: 0,
        metadata: { type: "action", action_id: "a1" },
      },
    ];
    const nodes = deserializeNodes(rows);
    expect(nodes[0].type === "action" && nodes[0].actor).toBe("A");
  });

  it("deserializes a finish node", () => {
    const rows = [
      {
        id: "n2",
        label: "Tap",
        description: "",
        position_x: 300,
        position_y: 200,
        metadata: { type: "finish" },
      },
    ];
    const nodes = deserializeNodes(rows);
    expect(nodes).toEqual([
      {
        id: "n2",
        type: "finish",
        label: "Tap",
        position_x: 300,
        position_y: 200,
      },
    ]);
  });

  it("defaults finish label to Submitted when missing", () => {
    const rows = [
      {
        id: "n2",
        label: null,
        description: "",
        position_x: 0,
        position_y: 0,
        metadata: { type: "finish" },
      },
    ];
    const nodes = deserializeNodes(rows);
    expect(nodes[0].type === "finish" && nodes[0].label).toBe("Submitted");
  });

  it("deserializes a state node", () => {
    const rows = [
      {
        id: "n3",
        label: "Closed Guard",
        description: "Full guard",
        position_x: 100,
        position_y: 200,
        metadata: {
          type: "state",
          state_id: "s1",
          label: "Standard Guard",
          conditions: [{ groupId: "g1", value: "Collar", role: "A" }],
          giNogi: "gi",
        },
      },
    ];
    const nodes = deserializeNodes(rows);
    expect(nodes).toEqual([
      {
        id: "n3",
        type: "state",
        state_id: "s1",
        label: "Standard Guard",
        position_name: "Closed Guard",
        description: "Full guard",
        position_x: 100,
        position_y: 200,
        conditions: [{ groupId: "g1", value: "Collar", role: "A" }],
        giNogi: "gi",
      },
    ]);
  });

  it("defaults state fields when metadata is sparse", () => {
    const rows = [
      {
        id: "n3",
        label: null,
        description: null,
        position_x: 0,
        position_y: 0,
        metadata: {},
      },
    ];
    const nodes = deserializeNodes(rows);
    const node = nodes[0];
    expect(node.type).toBe("state");
    if (node.type === "state") {
      expect(node.position_name).toBe("New State");
      expect(node.description).toBe("");
      expect(node.state_id).toBe("");
      expect(node.label).toBe("");
      expect(node.conditions).toEqual([]);
      expect(node.giNogi).toBe("");
    }
  });

  it("defaults state when metadata is null", () => {
    const rows = [
      {
        id: "n4",
        label: "Guard",
        description: "",
        position_x: 50,
        position_y: 50,
        metadata: null,
      },
    ];
    const nodes = deserializeNodes(rows);
    expect(nodes[0].type).toBe("state");
  });

  it("deserializes mixed node types", () => {
    const rows = [
      { id: "1", label: "Guard", description: "", position_x: 0, position_y: 0, metadata: { type: "state", state_id: "s1", label: "", conditions: [], giNogi: "" } },
      { id: "2", label: "Sweep", description: "", position_x: 250, position_y: 0, metadata: { type: "action", action_id: "a1", actor: "A" } },
      { id: "3", label: "Tap", description: "", position_x: 500, position_y: 0, metadata: { type: "finish" } },
    ];
    const nodes = deserializeNodes(rows);
    expect(nodes.map((n) => n.type)).toEqual(["state", "action", "finish"]);
  });
});

describe("deserializeEdges", () => {
  it("deserializes edges from rows", () => {
    const rows = [
      { id: "e1", source_node_id: "n1", target_node_id: "n2" },
      { id: "e2", source_node_id: "n2", target_node_id: "n3" },
    ];
    const edges = deserializeEdges(rows);
    expect(edges).toEqual([
      { id: "e1", source_node_id: "n1", target_node_id: "n2" },
      { id: "e2", source_node_id: "n2", target_node_id: "n3" },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(deserializeEdges([])).toEqual([]);
  });
});

// --- serializeNode ---

describe("serializeNode", () => {
  it("serializes a state node without graph_id", () => {
    const node: GraphStateNode = {
      id: "n1",
      type: "state",
      state_id: "s1",
      label: "High Mount",
      position_name: "Mount",
      description: "Dominant position",
      conditions: [{ groupId: "g1", value: "Heavy", role: "A" }],
      giNogi: "nogi",
      position_x: 100,
      position_y: 200,
    };
    const result = serializeNode(node, "user@test.com", null);
    expect(result).toEqual({
      id: "n1",
      user_id: "user@test.com",
      label: "Mount",
      description: "Dominant position",
      position_x: 100,
      position_y: 200,
      metadata: {
        type: "state",
        state_id: "s1",
        label: "High Mount",
        conditions: [{ groupId: "g1", value: "Heavy", role: "A" }],
        giNogi: "nogi",
      },
    });
    expect(result).not.toHaveProperty("graph_id");
  });

  it("serializes a state node with graph_id", () => {
    const node: GraphStateNode = {
      id: "n1",
      type: "state",
      state_id: "",
      label: "",
      position_name: "Guard",
      description: "",
      conditions: [],
      giNogi: "",
      position_x: 0,
      position_y: 0,
    };
    const result = serializeNode(node, "user@test.com", "graph-1");
    expect(result).toHaveProperty("graph_id", "graph-1");
  });

  it("serializes an action node", () => {
    const node: GraphActionNode = {
      id: "n2",
      type: "action",
      action_id: "a1",
      action_name: "Scissor Sweep",
      actor: "B",
      position_x: 250,
      position_y: 100,
    };
    const result = serializeNode(node, "user@test.com", null);
    expect(result).toEqual({
      id: "n2",
      user_id: "user@test.com",
      label: "Scissor Sweep",
      description: "",
      position_x: 250,
      position_y: 100,
      metadata: { type: "action", action_id: "a1", actor: "B" },
    });
  });

  it("serializes a finish node", () => {
    const node: GraphFinishNode = {
      id: "n3",
      type: "finish",
      label: "Tap",
      position_x: 500,
      position_y: 200,
    };
    const result = serializeNode(node, "user@test.com", "flow-1");
    expect(result).toEqual({
      id: "n3",
      user_id: "user@test.com",
      graph_id: "flow-1",
      label: "Tap",
      description: "",
      position_x: 500,
      position_y: 200,
      metadata: { type: "finish" },
    });
  });
});

// --- serializeEdge ---

describe("serializeEdge", () => {
  it("serializes an edge without graph_id", () => {
    const edge: GraphEdge = { id: "e1", source_node_id: "n1", target_node_id: "n2" };
    const result = serializeEdge(edge, "user@test.com", null);
    expect(result).toEqual({
      id: "e1",
      user_id: "user@test.com",
      source_node_id: "n1",
      target_node_id: "n2",
      relationship: "",
      metadata: {},
    });
    expect(result).not.toHaveProperty("graph_id");
  });

  it("serializes an edge with graph_id", () => {
    const edge: GraphEdge = { id: "e2", source_node_id: "n3", target_node_id: "n4" };
    const result = serializeEdge(edge, "user@test.com", "graph-1");
    expect(result).toHaveProperty("graph_id", "graph-1");
    expect(result.source_node_id).toBe("n3");
    expect(result.target_node_id).toBe("n4");
  });
});

// --- serialize/deserialize round-trip ---

describe("serialize/deserialize round-trip", () => {
  it("round-trips a state node", () => {
    const original: GraphStateNode = {
      id: "n1",
      type: "state",
      state_id: "s1",
      label: "Deep Half",
      position_name: "Half Guard",
      description: "Underhook deep",
      conditions: [{ groupId: "g1", value: "Underhook", role: "A" }],
      giNogi: "nogi",
      position_x: 100,
      position_y: 200,
    };
    const serialized = serializeNode(original, "user@test.com", null);
    const [deserialized] = deserializeNodes([serialized as Record<string, unknown>]);
    expect(deserialized).toEqual(original);
  });

  it("round-trips an action node", () => {
    const original: GraphActionNode = {
      id: "n2",
      type: "action",
      action_id: "a1",
      action_name: "Sweep",
      actor: "B",
      position_x: 250,
      position_y: 100,
    };
    const serialized = serializeNode(original, "user@test.com", null);
    const [deserialized] = deserializeNodes([serialized as Record<string, unknown>]);
    expect(deserialized).toEqual(original);
  });

  it("round-trips a finish node", () => {
    const original: GraphFinishNode = {
      id: "n3",
      type: "finish",
      label: "Tap",
      position_x: 500,
      position_y: 200,
    };
    const serialized = serializeNode(original, "user@test.com", null);
    const [deserialized] = deserializeNodes([serialized as Record<string, unknown>]);
    expect(deserialized).toEqual(original);
  });

  it("round-trips an edge", () => {
    const original: GraphEdge = { id: "e1", source_node_id: "n1", target_node_id: "n2" };
    const serialized = serializeEdge(original, "user@test.com", null);
    const [deserialized] = deserializeEdges([serialized as Record<string, unknown>]);
    expect(deserialized).toEqual(original);
  });
});
