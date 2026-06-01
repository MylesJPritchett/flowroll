import { describe, it, expect, afterAll } from "vitest";
import { getTestClient, cleanupTestUser } from "./setup-integration";
import { importNotation } from "@/app/actions/import";

const db = getTestClient();

afterAll(async () => {
  await cleanupTestUser(db);
});

describe("importNotation", () => {
  it("creates a new position from notation", async () => {
    const result = await importNotation(`position: Integration Test Pos (Attacker / Defender)`);
    expect(result.positionsCreated).toBe(1);
    expect(result.warnings).toHaveLength(0);

    const { data } = await db.from("positions").select("*").eq("name", "Integration Test Pos").single();
    expect(data).not.toBeNull();
    expect(data!.role_a).toBe("Attacker");
    expect(data!.role_b).toBe("Defender");
  });

  it("reuses existing position by name", async () => {
    // "Closed Guard" is seeded
    const result = await importNotation(`position: Closed Guard (Bottom / Top)`);
    expect(result.positionsCreated).toBe(0);
  });

  it("creates a condition group and options", async () => {
    const result = await importNotation(`condition: Integration Grips > collar, sleeve, lapel [gi]`);
    expect(result.conditionGroupsCreated).toBe(1);
    expect(result.conditionOptionsCreated).toBe(3);

    const { data: group } = await db.from("condition_groups").select("*").eq("name", "Integration Grips").single();
    expect(group).not.toBeNull();

    const { data: options } = await db.from("condition_options").select("*").eq("group_id", group!.id);
    expect(options).toHaveLength(3);
    const lapel = options!.find((o: { label: string }) => o.label === "lapel");
    expect(lapel!.gi_only).toBe(true);
  });

  it("creates an action with condition refs", async () => {
    const input = `condition: Test Grip > collar
action: Test Choke
  gi/nogi: gi
  requires: Test Grip = collar (actor)`;
    const result = await importNotation(input);
    expect(result.actionsCreated).toBe(1);

    const { data: action } = await db.from("actions").select("*").eq("name", "Test Choke").single();
    expect(action).not.toBeNull();
    expect(action!.gi_nogi).toBe("gi");
    expect(action!.required_conditions).toHaveLength(1);
    expect(action!.required_conditions[0].value).toBe("collar");
    expect(action!.required_conditions[0].role).toBe("actor");
  });

  it("creates a state linked to a position", async () => {
    const input = `position: Import State Pos (A / B)
state: Import State Pos as Test Named State
  description: a test state`;
    const result = await importNotation(input);
    expect(result.statesCreated).toBe(1);

    const { data: state } = await db.from("states").select("*").eq("name", "Test Named State").single();
    expect(state).not.toBeNull();
    expect(state!.description).toBe("a test state");
  });

  it("creates a flow graph with nodes and edges", async () => {
    const input = `position: Flow Start Pos (A / B)
state: Flow Start Pos
action: Flow Test Sweep
flow: Flow Start Pos → Flow Test Sweep → Finish`;
    const result = await importNotation(input);
    expect(result.flowsCreated).toBe(1);

    // Verify graph was created
    const { data: graphs } = await db.from("graphs").select("*").eq("name", "Flow Test Sweep from Flow Start Pos → Finish");
    expect(graphs!.length).toBe(1);

    const graphId = graphs![0].id;

    // Verify nodes exist
    const { data: nodes } = await db.from("graph_nodes").select("*").eq("graph_id", graphId);
    expect(nodes!.length).toBe(3); // state → action → finish

    // Verify edges link them
    const { data: edges } = await db.from("graph_edges").select("*").eq("graph_id", graphId);
    expect(edges!.length).toBe(2);
  });

  it("auto-creates groups and options referenced by action conditions", async () => {
    const input = `action: Auto Create Test
  requires: Brand New Group = brand new option (actor)`;
    const result = await importNotation(input);

    // Group and option should have been created on the fly
    expect(result.conditionGroupsCreated).toBe(1);
    expect(result.conditionOptionsCreated).toBe(1);
    expect(result.actionsCreated).toBe(1);
  });

  it("handles a full notation block end-to-end", async () => {
    const input = `position: Full Test Guard (Guard / Passer)
condition: Full Test Hook > butterfly, de la riva
action: Full Test Sweep
  requires: Full Test Hook = butterfly (actor)
state: Full Test Guard as Butterfly Variant
  role A: Full Test Hook = butterfly
flow: Butterfly Variant → Full Test Sweep → Mount`;
    const result = await importNotation(input);

    expect(result.positionsCreated).toBe(1);
    expect(result.conditionGroupsCreated).toBe(1);
    expect(result.conditionOptionsCreated).toBe(2);
    expect(result.actionsCreated).toBe(1);
    expect(result.statesCreated).toBe(1);
    expect(result.flowsCreated).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns on unknown position in state definition", async () => {
    const result = await importNotation(`state: Totally Nonexistent Position`);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Unknown position");
  });

  it("is idempotent for existing items", async () => {
    const input = `position: Idempotent Pos (A / B)
action: Idempotent Action`;

    const first = await importNotation(input);
    expect(first.positionsCreated).toBe(1);
    expect(first.actionsCreated).toBe(1);

    const second = await importNotation(input);
    expect(second.positionsCreated).toBe(0);
    expect(second.actionsCreated).toBe(0);
  });
});
