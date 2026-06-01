import { describe, it, expect } from "vitest";
import { parseNotation } from "./import-parser";

describe("parseNotation", () => {
  // --- Positions ---

  it("parses a position with roles", () => {
    const result = parseNotation("position: Closed Guard (Top / Bottom)");
    expect(result.positions).toEqual([
      { name: "Closed Guard", description: "", roleA: "Top", roleB: "Bottom" },
    ]);
  });

  it("defaults roles to A/B when not specified", () => {
    const result = parseNotation("position: Mount");
    expect(result.positions[0]).toEqual({
      name: "Mount",
      description: "",
      roleA: "A",
      roleB: "B",
    });
  });

  it("parses position description on indented sub-line", () => {
    const input = `position: Half Guard (Top / Bottom)
  description: One leg trapped`;
    const result = parseNotation(input);
    expect(result.positions[0].description).toBe("One leg trapped");
  });

  it("parses multiple positions", () => {
    const input = `position: Mount (Top / Bottom)
position: Side Control (Top / Bottom)`;
    const result = parseNotation(input);
    expect(result.positions).toHaveLength(2);
    expect(result.positions[0].name).toBe("Mount");
    expect(result.positions[1].name).toBe("Side Control");
  });

  // --- Conditions ---

  it("parses a condition group with options", () => {
    const result = parseNotation("condition: Grip > Collar, Sleeve, Lapel [gi]");
    expect(result.conditionGroups).toEqual([
      {
        name: "Grip",
        options: [
          { label: "Collar", giOnly: false },
          { label: "Sleeve", giOnly: false },
          { label: "Lapel", giOnly: true },
        ],
      },
    ]);
  });

  it("warns when condition is missing > separator", () => {
    const result = parseNotation("condition: bad format");
    expect(result.conditionGroups).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("missing '>' separator");
  });

  // --- Actions ---

  it("parses a basic action", () => {
    const result = parseNotation("action: Scissor Sweep");
    expect(result.actions).toEqual([
      {
        name: "Scissor Sweep",
        description: "",
        giNogi: "",
        requires: [],
        forbids: [],
        adds: [],
        removes: [],
      },
    ]);
  });

  it("parses action with all sub-fields", () => {
    const input = `action: Cross Collar Choke
  description: Classic gi submission
  gi/nogi: gi
  requires: Grip = Collar (actor)
  forbids: Grip = Wrist (opponent)
  adds: Control = Pinned (opponent)
  removes: Grip = Collar (actor)`;
    const result = parseNotation(input);
    const action = result.actions[0];
    expect(action.name).toBe("Cross Collar Choke");
    expect(action.description).toBe("Classic gi submission");
    expect(action.giNogi).toBe("gi");
    expect(action.requires).toEqual([{ group: "Grip", value: "Collar", role: "actor" }]);
    expect(action.forbids).toEqual([{ group: "Grip", value: "Wrist", role: "opponent" }]);
    expect(action.adds).toEqual([{ group: "Control", value: "Pinned", role: "opponent" }]);
    expect(action.removes).toEqual([{ group: "Grip", value: "Collar", role: "actor" }]);
  });

  it("parses gi/nogi variants", () => {
    expect(parseNotation("action: A\n  gi/nogi: gi").actions[0].giNogi).toBe("gi");
    expect(parseNotation("action: A\n  gi/nogi: nogi").actions[0].giNogi).toBe("nogi");
    expect(parseNotation("action: A\n  gi/nogi: no-gi").actions[0].giNogi).toBe("nogi");
    expect(parseNotation("action: A\n  gi/nogi: both").actions[0].giNogi).toBe("");
  });

  it("parses multiple condition refs in requires", () => {
    const input = `action: Sweep
  requires: Grip = Collar (actor), Hook = Butterfly (actor)`;
    const result = parseNotation(input);
    expect(result.actions[0].requires).toHaveLength(2);
    expect(result.actions[0].requires[1]).toEqual({ group: "Hook", value: "Butterfly", role: "actor" });
  });

  // --- States ---

  it("parses a basic state", () => {
    const result = parseNotation("state: Closed Guard");
    expect(result.states).toEqual([
      { label: "", positionName: "Closed Guard", roleA: [], roleB: [], giNogi: "", description: "" },
    ]);
  });

  it("parses state with 'as' label syntax", () => {
    const result = parseNotation("state: Closed Guard as Guard Retention");
    expect(result.states[0].positionName).toBe("Closed Guard");
    expect(result.states[0].label).toBe("Guard Retention");
  });

  it("parses state with role conditions and gi/nogi", () => {
    const input = `state: Half Guard as Underhook Half
  role A: Grip = Underhook
  role B: Grip = Whizzer
  gi/nogi: nogi
  description: Strong underhook position`;
    const result = parseNotation(input);
    const state = result.states[0];
    expect(state.positionName).toBe("Half Guard");
    expect(state.label).toBe("Underhook Half");
    expect(state.roleA).toEqual([{ group: "Grip", value: "Underhook" }]);
    expect(state.roleB).toEqual([{ group: "Grip", value: "Whizzer" }]);
    expect(state.giNogi).toBe("nogi");
    expect(state.description).toBe("Strong underhook position");
  });

  it("parses state with multiple conditions per role", () => {
    const input = `state: Mount
  role A: Grip = Collar, Control = Crossface`;
    const result = parseNotation(input);
    expect(result.states[0].roleA).toHaveLength(2);
  });

  // --- Flows ---

  it("parses a flow with arrow separator", () => {
    const result = parseNotation("flow: Closed Guard → Scissor Sweep → Mount");
    expect(result.flows).toHaveLength(1);
    expect(result.flows[0].steps).toHaveLength(3);
    expect(result.flows[0].steps[0]).toEqual({ label: "Closed Guard", type: "unknown" });
    expect(result.flows[0].steps[1]).toEqual({ label: "Scissor Sweep", type: "unknown" });
    expect(result.flows[0].steps[2]).toEqual({ label: "Mount", type: "unknown" });
  });

  it("parses a flow with -> separator", () => {
    const result = parseNotation("flow: A -> B -> C");
    expect(result.flows[0].steps).toHaveLength(3);
  });

  it("marks finish steps", () => {
    const result = parseNotation("flow: Mount → Armbar → Submitted");
    expect(result.flows[0].steps[2]).toEqual({ label: "Submitted", type: "finish" });
  });

  it("recognizes various finish labels", () => {
    for (const label of ["submitted", "submission", "finish", "tap"]) {
      const result = parseNotation(`flow: A → ${label}`);
      expect(result.flows[0].steps[1].type).toBe("finish");
    }
  });

  it("ignores flows with fewer than 2 steps", () => {
    const result = parseNotation("flow: OnlyOne");
    expect(result.flows).toHaveLength(0);
  });

  // --- Comments and empty lines ---

  it("skips comments and empty lines", () => {
    const input = `# This is a comment

position: Mount (Top / Bottom)

# Another comment
action: Escape`;
    const result = parseNotation(input);
    expect(result.positions).toHaveLength(1);
    expect(result.actions).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  // --- Full integration ---

  it("parses a complete notation block", () => {
    const input = `position: Closed Guard (Guard Player / Passer)
  description: Full guard with legs wrapped

condition: Grip > Collar, Sleeve, Lapel [gi]

action: Scissor Sweep
  requires: Grip = Collar (actor)
  adds: Control = Top (actor)

state: Closed Guard as Standard Guard
  role A: Grip = Collar
  role B: Grip = Sleeve
  gi/nogi: gi

flow: Standard Guard → Scissor Sweep → Mount`;
    const result = parseNotation(input);
    expect(result.positions).toHaveLength(1);
    expect(result.conditionGroups).toHaveLength(1);
    expect(result.actions).toHaveLength(1);
    expect(result.states).toHaveLength(1);
    expect(result.flows).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  // --- Edge cases ---

  it("handles empty input", () => {
    const result = parseNotation("");
    expect(result.positions).toHaveLength(0);
    expect(result.conditionGroups).toHaveLength(0);
    expect(result.actions).toHaveLength(0);
    expect(result.states).toHaveLength(0);
    expect(result.flows).toHaveLength(0);
  });

  it("handles condition refs with dashes as empty", () => {
    const input = `action: Basic Move
  requires: —`;
    const result = parseNotation(input);
    expect(result.actions[0].requires).toEqual([]);
  });

  it("skips unknown top-level lines without warning", () => {
    const result = parseNotation("something: random");
    expect(result.warnings).toHaveLength(0);
  });

  it("stops reading sub-lines at empty line", () => {
    const input = `action: First

action: Second`;
    const result = parseNotation(input);
    expect(result.actions).toHaveLength(2);
  });
});
