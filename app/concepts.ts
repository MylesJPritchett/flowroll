import type { Position, ConditionGroup, ConditionOption, Action, PositionRequirement, ConditionRef } from "./actions/taxonomy";

// Re-export taxonomy types for convenience
export type { Position, ConditionGroup, ConditionOption, Action, PositionRequirement, ConditionRef };

export interface Taxonomy {
  positions: Position[];
  conditionGroups: ConditionGroup[];
  actions: Action[];
  positionConditions: Record<string, string[]>;
  positionRequirements: Record<string, PositionRequirement[]>;
}

// --- Helpers ---

export function getRoleLabels(positionName: string, positions: Position[]): { roleA: string; roleB: string } {
  const pos = positions.find((p) => p.name === positionName);
  return pos ? { roleA: pos.role_a, roleB: pos.role_b } : { roleA: "A", roleB: "B" };
}

export function getFilteredOptions(
  group: ConditionGroup,
  giNogi: "" | "gi" | "nogi",
  allowedOptionIds: Set<string> | null, // null = allow all
): ConditionOption[] {
  let opts = group.options;
  if (giNogi === "nogi") opts = opts.filter((o) => !o.gi_only);
  if (allowedOptionIds) opts = opts.filter((o) => allowedOptionIds.has(o.id));
  return opts;
}

/**
 * Get the set of allowed condition option IDs for a position+role.
 * Returns null if no mappings exist (= all allowed).
 */
export function getAllowedOptionIds(
  positionName: string,
  role: "A" | "B",
  taxonomy: Taxonomy,
): Set<string> | null {
  const pos = taxonomy.positions.find((p) => p.name === positionName);
  if (!pos) return null;
  const key = `${pos.id}:${role}`;
  const ids = taxonomy.positionConditions[key];
  if (!ids) return null;
  return new Set(ids);
}

// --- State Conditions (used in graph data) ---

export interface StateCondition {
  groupId: string;
  value: string;
  role: "A" | "B";
}
