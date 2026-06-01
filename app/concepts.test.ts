import { describe, it, expect } from "vitest";
import {
  resolveConditionRole,
  getRoleLabels,
  getFilteredOptions,
  getAllowedOptionIds,
  type Taxonomy,
} from "./concepts";
import type { Position, ConditionGroup, ConditionOption } from "./actions/taxonomy";

// --- resolveConditionRole ---

describe("resolveConditionRole", () => {
  it("returns A when actor is A and ref is actor", () => {
    expect(resolveConditionRole("actor", "A")).toBe("A");
  });

  it("returns B when actor is A and ref is opponent", () => {
    expect(resolveConditionRole("opponent", "A")).toBe("B");
  });

  it("returns B when actor is B and ref is actor", () => {
    expect(resolveConditionRole("actor", "B")).toBe("B");
  });

  it("returns A when actor is B and ref is opponent", () => {
    expect(resolveConditionRole("opponent", "B")).toBe("A");
  });
});

// --- getRoleLabels ---

describe("getRoleLabels", () => {
  const positions: Position[] = [
    {
      id: "1",
      name: "Closed Guard",
      description: "",
      role_a: "Guard Player",
      role_b: "Passer",
      sort_order: 0,
      created_by: "test",
      is_official: true,
      is_public: true,
    },
    {
      id: "2",
      name: "Mount",
      description: "",
      role_a: "Top",
      role_b: "Bottom",
      sort_order: 1,
      created_by: "test",
      is_official: true,
      is_public: true,
    },
  ];

  it("returns role labels for a known position", () => {
    expect(getRoleLabels("Closed Guard", positions)).toEqual({
      roleA: "Guard Player",
      roleB: "Passer",
    });
  });

  it("defaults to A/B for unknown position", () => {
    expect(getRoleLabels("Unknown Position", positions)).toEqual({
      roleA: "A",
      roleB: "B",
    });
  });

  it("matches by exact name", () => {
    expect(getRoleLabels("Mount", positions)).toEqual({
      roleA: "Top",
      roleB: "Bottom",
    });
  });
});

// --- getFilteredOptions ---

describe("getFilteredOptions", () => {
  const options: ConditionOption[] = [
    { id: "o1", group_id: "g1", label: "Collar", gi_only: true, sort_order: 0, created_by: "t", is_official: true, is_public: true },
    { id: "o2", group_id: "g1", label: "Wrist", gi_only: false, sort_order: 1, created_by: "t", is_official: true, is_public: true },
    { id: "o3", group_id: "g1", label: "Sleeve", gi_only: true, sort_order: 2, created_by: "t", is_official: true, is_public: true },
  ];

  const group: ConditionGroup = {
    id: "g1",
    name: "Grip",
    sort_order: 0,
    options,
    created_by: "t",
    is_official: true,
    is_public: true,
  };

  it("returns all options when giNogi is empty (both)", () => {
    const result = getFilteredOptions(group, "", null);
    expect(result).toHaveLength(3);
  });

  it("returns all options for gi mode", () => {
    const result = getFilteredOptions(group, "gi", null);
    expect(result).toHaveLength(3);
  });

  it("filters out gi_only options in nogi mode", () => {
    const result = getFilteredOptions(group, "nogi", null);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Wrist");
  });

  it("filters by allowed option IDs", () => {
    const allowed = new Set(["o1", "o2"]);
    const result = getFilteredOptions(group, "", allowed);
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.label)).toEqual(["Collar", "Wrist"]);
  });

  it("combines giNogi and allowed filters", () => {
    const allowed = new Set(["o1", "o2"]);
    const result = getFilteredOptions(group, "nogi", allowed);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Wrist");
  });

  it("returns empty when no options match allowed set", () => {
    const allowed = new Set(["nonexistent"]);
    const result = getFilteredOptions(group, "", allowed);
    expect(result).toHaveLength(0);
  });

  it("returns all when allowedOptionIds is null", () => {
    const result = getFilteredOptions(group, "", null);
    expect(result).toHaveLength(3);
  });
});

// --- getAllowedOptionIds ---

describe("getAllowedOptionIds", () => {
  const taxonomy: Taxonomy = {
    positions: [
      { id: "p1", name: "Mount", description: "", role_a: "Top", role_b: "Bottom", sort_order: 0, created_by: "t", is_official: true, is_public: true },
      { id: "p2", name: "Guard", description: "", role_a: "A", role_b: "B", sort_order: 1, created_by: "t", is_official: true, is_public: true },
    ],
    conditionGroups: [],
    actions: [],
    states: [],
    positionConditions: {
      "p1:A": ["opt1", "opt2"],
      "p1:B": ["opt3"],
    },
    positionRequirements: {},
  };

  it("returns allowed option IDs for a position+role", () => {
    const result = getAllowedOptionIds("Mount", "A", taxonomy);
    expect(result).toEqual(new Set(["opt1", "opt2"]));
  });

  it("returns different set for different role", () => {
    const result = getAllowedOptionIds("Mount", "B", taxonomy);
    expect(result).toEqual(new Set(["opt3"]));
  });

  it("returns null for position with no mappings", () => {
    const result = getAllowedOptionIds("Guard", "A", taxonomy);
    expect(result).toBeNull();
  });

  it("returns null for unknown position", () => {
    const result = getAllowedOptionIds("Nonexistent", "A", taxonomy);
    expect(result).toBeNull();
  });
});
