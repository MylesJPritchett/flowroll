import { describe, it, expect, afterAll } from "vitest";
import { getTestClient, cleanupTestUser, TEST_USER } from "./setup-integration";
import {
  loadTaxonomy,
  addPosition,
  updatePosition,
  deletePosition,
  addConditionGroup,
  updateConditionGroup,
  deleteConditionGroup,
  addConditionOption,
  updateConditionOption,
  deleteConditionOption,
  addAction,
  updateAction,
  deleteAction,
  setPositionCondition,
  addState,
  updateState,
  deleteState,
  setPositionRequirement,
} from "@/app/actions/taxonomy";

const db = getTestClient();

afterAll(async () => {
  await cleanupTestUser(db);
});

// --- loadTaxonomy ---

describe("loadTaxonomy", () => {
  it("loads seeded positions, groups, and actions", async () => {
    const tax = await loadTaxonomy();
    expect(tax).not.toBeNull();
    // Seed has 21 positions, 8 groups, 17 actions
    expect(tax!.positions.length).toBeGreaterThanOrEqual(21);
    expect(tax!.conditionGroups.length).toBeGreaterThanOrEqual(8);
    expect(tax!.actions.length).toBeGreaterThanOrEqual(17);
  });

  it("includes condition options nested under groups", async () => {
    const tax = await loadTaxonomy();
    const nearArm = tax!.conditionGroups.find((g) => g.name === "Near Arm");
    expect(nearArm).toBeDefined();
    expect(nearArm!.options.length).toBeGreaterThanOrEqual(3);
  });

  it("includes position condition mappings", async () => {
    const tax = await loadTaxonomy();
    // Seed creates mappings for all positions × all options × both roles
    expect(Object.keys(tax!.positionConditions).length).toBeGreaterThan(0);
  });
});

// --- Positions CRUD ---

describe("positions CRUD", () => {
  it("creates a position", async () => {
    const pos = await addPosition("Test Position", "Attacker", "Defender", "test desc");
    expect(pos).not.toBeNull();
    expect(pos!.name).toBe("Test Position");
    expect(pos!.role_a).toBe("Attacker");
    expect(pos!.role_b).toBe("Defender");
    expect(pos!.created_by).toBe(TEST_USER);
    expect(pos!.is_official).toBe(false);
  });

  it("auto-enables all condition options for new position", async () => {
    const pos = await addPosition("Test Pos Conditions", "A", "B");
    expect(pos).not.toBeNull();

    const { data: mappings } = await db
      .from("position_conditions")
      .select("*")
      .eq("position_id", pos!.id);

    expect(mappings!.length).toBeGreaterThan(0);
  });

  it("updates a position", async () => {
    const pos = await addPosition("Before Update", "A", "B");
    const ok = await updatePosition(pos!.id, { name: "After Update", role_a: "Top" });
    expect(ok).toBe(true);

    const { data } = await db.from("positions").select("*").eq("id", pos!.id).single();
    expect(data!.name).toBe("After Update");
    expect(data!.role_a).toBe("Top");
  });

  it("deletes a position", async () => {
    const pos = await addPosition("To Delete", "A", "B");
    const ok = await deletePosition(pos!.id);
    expect(ok).toBe(true);

    const { data } = await db.from("positions").select("id").eq("id", pos!.id);
    expect(data).toHaveLength(0);
  });

  it("shows user-created position in taxonomy", async () => {
    await addPosition("My Custom Pos", "X", "Y");
    const tax = await loadTaxonomy();
    const found = tax!.positions.find((p) => p.name === "My Custom Pos");
    expect(found).toBeDefined();
  });
});

// --- Condition Groups CRUD ---

describe("condition groups CRUD", () => {
  it("creates a condition group", async () => {
    const group = await addConditionGroup("Test Group");
    expect(group).not.toBeNull();
    expect(group!.name).toBe("Test Group");
    expect(group!.options).toEqual([]);
  });

  it("updates a condition group", async () => {
    const group = await addConditionGroup("Old Name");
    const ok = await updateConditionGroup(group!.id, { name: "New Name" });
    expect(ok).toBe(true);

    const { data } = await db.from("condition_groups").select("name").eq("id", group!.id).single();
    expect(data!.name).toBe("New Name");
  });

  it("deletes a condition group", async () => {
    const group = await addConditionGroup("Doomed Group");
    const ok = await deleteConditionGroup(group!.id);
    expect(ok).toBe(true);

    const { data } = await db.from("condition_groups").select("id").eq("id", group!.id);
    expect(data).toHaveLength(0);
  });
});

// --- Condition Options CRUD ---

describe("condition options CRUD", () => {
  it("creates an option and auto-enables it for all positions", async () => {
    const group = await addConditionGroup("Opt Test Group");
    const opt = await addConditionOption(group!.id, "test option", false);
    expect(opt).not.toBeNull();
    expect(opt!.label).toBe("test option");
    expect(opt!.gi_only).toBe(false);

    // Should be mapped to positions
    const { data: mappings } = await db
      .from("position_conditions")
      .select("*")
      .eq("condition_option_id", opt!.id);
    expect(mappings!.length).toBeGreaterThan(0);
  });

  it("creates a gi-only option", async () => {
    const group = await addConditionGroup("Gi Test Group");
    const opt = await addConditionOption(group!.id, "gi grip", true);
    expect(opt!.gi_only).toBe(true);
  });

  it("updates an option", async () => {
    const group = await addConditionGroup("Update Opt Group");
    const opt = await addConditionOption(group!.id, "old label", false);
    const ok = await updateConditionOption(opt!.id, { label: "new label", gi_only: true });
    expect(ok).toBe(true);

    const { data } = await db.from("condition_options").select("*").eq("id", opt!.id).single();
    expect(data!.label).toBe("new label");
    expect(data!.gi_only).toBe(true);
  });

  it("deletes an option", async () => {
    const group = await addConditionGroup("Del Opt Group");
    const opt = await addConditionOption(group!.id, "bye", false);
    const ok = await deleteConditionOption(opt!.id);
    expect(ok).toBe(true);

    const { data } = await db.from("condition_options").select("id").eq("id", opt!.id);
    expect(data).toHaveLength(0);
  });
});

// --- setPositionCondition ---

describe("setPositionCondition", () => {
  it("disables and re-enables a condition mapping", async () => {
    const pos = await addPosition("Toggle Pos", "A", "B");
    const group = await addConditionGroup("Toggle Group");
    const opt = await addConditionOption(group!.id, "toggle opt", false);

    // Should be auto-enabled — disable it
    const disabled = await setPositionCondition(pos!.id, opt!.id, "A", false);
    expect(disabled).toBe(true);

    const { data: afterDisable } = await db
      .from("position_conditions")
      .select("id")
      .eq("position_id", pos!.id)
      .eq("condition_option_id", opt!.id)
      .eq("role", "A");
    expect(afterDisable).toHaveLength(0);

    // Re-enable
    const enabled = await setPositionCondition(pos!.id, opt!.id, "A", true);
    expect(enabled).toBe(true);

    const { data: afterEnable } = await db
      .from("position_conditions")
      .select("id")
      .eq("position_id", pos!.id)
      .eq("condition_option_id", opt!.id)
      .eq("role", "A");
    expect(afterEnable).toHaveLength(1);
  });
});

// --- Actions CRUD ---

describe("actions CRUD", () => {
  it("creates an action", async () => {
    const action = await addAction("Test Sweep", "a sweep", "nogi");
    expect(action).not.toBeNull();
    expect(action!.name).toBe("Test Sweep");
    expect(action!.gi_nogi).toBe("nogi");
    expect(action!.created_by).toBe(TEST_USER);
  });

  it("updates an action", async () => {
    const action = await addAction("Old Action", "", "");
    const ok = await updateAction(action!.id, { name: "New Action", gi_nogi: "gi" });
    expect(ok).toBe(true);

    const { data } = await db.from("actions").select("*").eq("id", action!.id).single();
    expect(data!.name).toBe("New Action");
    expect(data!.gi_nogi).toBe("gi");
  });

  it("deletes an action", async () => {
    const action = await addAction("Doomed Action", "", "");
    const ok = await deleteAction(action!.id);
    expect(ok).toBe(true);

    const { data } = await db.from("actions").select("id").eq("id", action!.id);
    expect(data).toHaveLength(0);
  });
});

// --- States CRUD ---

describe("states CRUD", () => {
  it("creates a state linked to a position", async () => {
    const pos = await addPosition("State Pos", "A", "B");
    const state = await addState(pos!.id, "High Mount", "high position", [], "");
    expect(state).not.toBeNull();
    expect(state!.name).toBe("High Mount");
    expect(state!.position_id).toBe(pos!.id);
  });

  it("creates a state with conditions", async () => {
    const pos = await addPosition("Cond State Pos", "A", "B");
    const conditions = [{ groupId: "near_arm", value: "underhook", role: "A" as const }];
    const state = await addState(pos!.id, "Underhook State", "", conditions, "nogi");
    expect(state!.conditions).toEqual(conditions);
    expect(state!.gi_nogi).toBe("nogi");
  });

  it("updates a state", async () => {
    const pos = await addPosition("Upd State Pos", "A", "B");
    const state = await addState(pos!.id, "Old State", "", [], "");
    const ok = await updateState(state!.id, { name: "New State", gi_nogi: "gi" });
    expect(ok).toBe(true);

    const { data } = await db.from("states").select("*").eq("id", state!.id).single();
    expect(data!.name).toBe("New State");
    expect(data!.gi_nogi).toBe("gi");
  });

  it("deletes a state", async () => {
    const pos = await addPosition("Del State Pos", "A", "B");
    const state = await addState(pos!.id, "Temp State", "", [], "");
    const ok = await deleteState(state!.id);
    expect(ok).toBe(true);

    const { data } = await db.from("states").select("id").eq("id", state!.id);
    expect(data).toHaveLength(0);
  });
});

// --- Position Requirements ---

describe("setPositionRequirement", () => {
  it("sets and removes a requirement", async () => {
    const pos = await addPosition("Req Pos", "A", "B");
    const group = await addConditionGroup("Req Group");
    const opt = await addConditionOption(group!.id, "req opt", false);

    const set = await setPositionRequirement(pos!.id, opt!.id, "A", true);
    expect(set).toBe(true);

    const { data: reqs } = await db
      .from("position_requirements")
      .select("*")
      .eq("position_id", pos!.id)
      .eq("condition_option_id", opt!.id)
      .eq("role", "A");
    expect(reqs).toHaveLength(1);

    const removed = await setPositionRequirement(pos!.id, opt!.id, "A", false);
    expect(removed).toBe(true);

    const { data: afterRemove } = await db
      .from("position_requirements")
      .select("*")
      .eq("position_id", pos!.id)
      .eq("condition_option_id", opt!.id)
      .eq("role", "A");
    expect(afterRemove).toHaveLength(0);
  });
});
