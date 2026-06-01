import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createSupabaseServer: vi.fn() }));

import { deserializeNodes, deserializeEdges } from "./graph";

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
