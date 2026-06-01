"use server";

import { createSupabaseServer, getUserId } from "@/lib/supabase";
import { isAdmin } from "./admin";

// --- Types ---

interface OwnershipFields {
  created_by: string | null;
  is_official: boolean;
  is_public: boolean;
}

export interface Position extends OwnershipFields {
  id: string;
  name: string;
  description: string;
  role_a: string;
  role_b: string;
  sort_order: number;
}

export interface ConditionOption extends OwnershipFields {
  id: string;
  group_id: string;
  label: string;
  gi_only: boolean;
  sort_order: number;
}

export interface ConditionGroup extends OwnershipFields {
  id: string;
  name: string;
  sort_order: number;
  options: ConditionOption[];
}

export type ConditionRefRole = "actor" | "opponent";

export interface ConditionRef {
  groupId: string;
  value: string;
  role: ConditionRefRole;
}

export interface Action extends OwnershipFields {
  id: string;
  name: string;
  description: string;
  gi_nogi: "" | "gi" | "nogi";
  required_conditions: ConditionRef[];
  forbidden_conditions: ConditionRef[];
  adds_conditions: ConditionRef[];
  removes_conditions: ConditionRef[];
  sort_order: number;
}

export interface PositionRequirement {
  id: string;
  position_id: string;
  condition_option_id: string;
  role: "A" | "B";
}

export interface StateConditionEntry {
  groupId: string;
  value: string;
  role: "A" | "B";
}

export interface State extends OwnershipFields {
  id: string;
  position_id: string;
  name: string;
  description: string;
  conditions: StateConditionEntry[];
  gi_nogi: "" | "gi" | "nogi";
  sort_order: number;
}

// --- Load ---

export async function loadTaxonomy(): Promise<{
  positions: Position[];
  conditionGroups: ConditionGroup[];
  actions: Action[];
  states: State[];
  positionConditions: Record<string, string[]>;
  positionRequirements: Record<string, PositionRequirement[]>;
} | null> {
  const userId = await getUserId();
  const supabase = createSupabaseServer();

  // Load all visible items: official OR created by user OR public
  const orFilter = userId
    ? `is_official.eq.true,created_by.eq.${userId},is_public.eq.true`
    : "is_official.eq.true,is_public.eq.true";

  const [posResult, groupsResult, optionsResult, actionsResult, statesResult] = await Promise.all([
    supabase.from("positions").select("*").or(orFilter).order("sort_order"),
    supabase.from("condition_groups").select("*").or(orFilter).order("sort_order"),
    supabase.from("condition_options").select("*").or(orFilter).order("sort_order"),
    supabase.from("actions").select("*").or(orFilter).order("sort_order"),
    supabase.from("states").select("*").or(orFilter).order("sort_order"),
  ]);

  if (posResult.error || groupsResult.error || optionsResult.error || actionsResult.error || statesResult.error) {
    console.error("Failed to load taxonomy:", posResult.error, groupsResult.error, optionsResult.error, actionsResult.error, statesResult.error);
    return null;
  }

  // Paginate position_conditions
  const allPcRows: { position_id: string; condition_option_id: string; role: string }[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("position_conditions")
      .select("position_id, condition_option_id, role")
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Failed to load position_conditions:", error);
      return null;
    }
    allPcRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const optionsByGroup = new Map<string, ConditionOption[]>();
  for (const opt of optionsResult.data as ConditionOption[]) {
    const list = optionsByGroup.get(opt.group_id) ?? [];
    list.push(opt);
    optionsByGroup.set(opt.group_id, list);
  }

  const conditionGroups: ConditionGroup[] = (groupsResult.data as ConditionGroup[]).map((g) => ({
    ...g,
    options: optionsByGroup.get(g.id) ?? [],
  }));

  const positionConditions: Record<string, string[]> = {};
  for (const row of allPcRows) {
    const key = `${row.position_id}:${row.role}`;
    if (!positionConditions[key]) positionConditions[key] = [];
    positionConditions[key].push(row.condition_option_id);
  }

  // Load position requirements
  const { data: reqRows, error: reqError } = await supabase
    .from("position_requirements")
    .select("*");
  if (reqError) {
    console.error("Failed to load position_requirements:", reqError);
    return null;
  }
  const positionRequirements: Record<string, PositionRequirement[]> = {};
  for (const row of reqRows as PositionRequirement[]) {
    if (!positionRequirements[row.position_id]) positionRequirements[row.position_id] = [];
    positionRequirements[row.position_id].push(row);
  }

  return { positions: posResult.data as Position[], conditionGroups, actions: actionsResult.data as Action[], states: statesResult.data as State[], positionConditions, positionRequirements };
}

// --- Positions CRUD ---

export async function addPosition(name: string, roleA: string, roleB: string, description = ""): Promise<Position | null> {
  const userId = await getUserId();
  const supabase = createSupabaseServer();
  const { data: maxRow } = await supabase.from("positions").select("sort_order").order("sort_order", { ascending: false }).limit(1).single();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("positions")
    .insert({ name, description, role_a: roleA, role_b: roleB, sort_order: sortOrder, created_by: userId, is_official: false, is_public: true })
    .select()
    .single();

  if (error) { console.error("Failed to add position:", error); return null; }

  // Auto-enable all condition options for both roles
  const { data: options } = await supabase.from("condition_options").select("id");
  if (options && options.length > 0) {
    const mappings = options.flatMap((o) =>
      (["A", "B"] as const).map((role) => ({
        position_id: data.id,
        condition_option_id: o.id,
        role,
      })),
    );
    await supabase.from("position_conditions").insert(mappings);
  }

  return data;
}

export async function updatePosition(id: string, updates: { name?: string; description?: string; role_a?: string; role_b?: string; is_public?: boolean }): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("positions").update(updates).eq("id", id);
  if (error) { console.error("Failed to update position:", error); return false; }
  return true;
}

export async function deletePosition(id: string): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("positions").delete().eq("id", id);
  if (error) { console.error("Failed to delete position:", error); return false; }
  return true;
}

// --- Condition Groups CRUD ---

export async function addConditionGroup(name: string): Promise<ConditionGroup | null> {
  const userId = await getUserId();
  const supabase = createSupabaseServer();
  const { data: maxRow } = await supabase.from("condition_groups").select("sort_order").order("sort_order", { ascending: false }).limit(1).single();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("condition_groups")
    .insert({ name, sort_order: sortOrder, created_by: userId, is_official: false, is_public: true })
    .select()
    .single();

  if (error) { console.error("Failed to add condition group:", error); return null; }
  return { ...data, options: [] };
}

export async function updateConditionGroup(id: string, updates: { name?: string; is_public?: boolean }): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("condition_groups").update(updates).eq("id", id);
  if (error) { console.error("Failed to update condition group:", error); return false; }
  return true;
}

export async function deleteConditionGroup(id: string): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("condition_groups").delete().eq("id", id);
  if (error) { console.error("Failed to delete condition group:", error); return false; }
  return true;
}

// --- Condition Options CRUD ---

export async function addConditionOption(groupId: string, label: string, giOnly: boolean): Promise<ConditionOption | null> {
  const userId = await getUserId();
  const supabase = createSupabaseServer();
  const { data: maxRow } = await supabase.from("condition_options").select("sort_order").eq("group_id", groupId).order("sort_order", { ascending: false }).limit(1).single();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("condition_options")
    .insert({ group_id: groupId, label, gi_only: giOnly, sort_order: sortOrder, created_by: userId, is_official: false, is_public: true })
    .select()
    .single();

  if (error) { console.error("Failed to add condition option:", error); return null; }

  // Auto-enable for all positions + both roles
  const { data: positions } = await supabase.from("positions").select("id");
  if (positions && positions.length > 0) {
    const mappings = positions.flatMap((p) =>
      (["A", "B"] as const).map((role) => ({
        position_id: p.id,
        condition_option_id: data.id,
        role,
      })),
    );
    await supabase.from("position_conditions").insert(mappings);
  }

  return data;
}

export async function updateConditionOption(id: string, updates: { label?: string; gi_only?: boolean; is_public?: boolean }): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("condition_options").update(updates).eq("id", id);
  if (error) { console.error("Failed to update condition option:", error); return false; }
  return true;
}

export async function deleteConditionOption(id: string): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("condition_options").delete().eq("id", id);
  if (error) { console.error("Failed to delete condition option:", error); return false; }
  return true;
}

// --- Position Condition Mappings ---

export async function setPositionCondition(
  positionId: string,
  conditionOptionId: string,
  role: "A" | "B",
  enabled: boolean,
): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error: delError } = await supabase
    .from("position_conditions")
    .delete()
    .eq("position_id", positionId)
    .eq("condition_option_id", conditionOptionId)
    .eq("role", role);
  if (delError) return false;

  if (enabled) {
    const { error } = await supabase
      .from("position_conditions")
      .insert({ position_id: positionId, condition_option_id: conditionOptionId, role });
    if (error) return false;
  }
  return true;
}

// --- Actions CRUD ---

export async function addAction(name: string, description: string, giNogi: "" | "gi" | "nogi"): Promise<Action | null> {
  const userId = await getUserId();
  const supabase = createSupabaseServer();
  const { data: maxRow } = await supabase.from("actions").select("sort_order").order("sort_order", { ascending: false }).limit(1).single();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("actions")
    .insert({ name, description, gi_nogi: giNogi, sort_order: sortOrder, created_by: userId, is_official: false, is_public: true })
    .select()
    .single();

  if (error) { console.error("Failed to add action:", error); return null; }
  return data;
}

export async function updateAction(id: string, updates: { name?: string; description?: string; gi_nogi?: "" | "gi" | "nogi"; is_public?: boolean; required_conditions?: ConditionRef[]; forbidden_conditions?: ConditionRef[]; adds_conditions?: ConditionRef[]; removes_conditions?: ConditionRef[] }): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("actions").update(updates).eq("id", id);
  if (error) { console.error("Failed to update action:", error); return false; }
  return true;
}

export async function deleteAction(id: string): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("actions").delete().eq("id", id);
  if (error) { console.error("Failed to delete action:", error); return false; }
  return true;
}

// --- States CRUD ---

export async function addState(positionId: string, name: string, description: string, conditions: StateConditionEntry[], giNogi: "" | "gi" | "nogi"): Promise<State | null> {
  const userId = await getUserId();
  const supabase = createSupabaseServer();
  const { data: maxRow } = await supabase.from("states").select("sort_order").eq("position_id", positionId).order("sort_order", { ascending: false }).limit(1).single();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("states")
    .insert({ position_id: positionId, name, description, conditions, gi_nogi: giNogi, sort_order: sortOrder, created_by: userId, is_official: false, is_public: true })
    .select()
    .single();

  if (error) { console.error("Failed to add state:", error); return null; }
  return data;
}

export async function updateState(id: string, updates: { name?: string; description?: string; conditions?: StateConditionEntry[]; gi_nogi?: "" | "gi" | "nogi"; is_public?: boolean }): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("states").update(updates).eq("id", id);
  if (error) { console.error("Failed to update state:", error); return false; }
  return true;
}

export async function deleteState(id: string): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("states").delete().eq("id", id);
  if (error) { console.error("Failed to delete state:", error); return false; }
  return true;
}

// --- Position Requirements ---

export async function setPositionRequirement(
  positionId: string,
  conditionOptionId: string,
  role: "A" | "B",
  required: boolean,
): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error: delError } = await supabase
    .from("position_requirements")
    .delete()
    .eq("position_id", positionId)
    .eq("condition_option_id", conditionOptionId)
    .eq("role", role);
  if (delError) return false;

  if (required) {
    const { error } = await supabase
      .from("position_requirements")
      .insert({ position_id: positionId, condition_option_id: conditionOptionId, role });
    if (error) return false;
  }
  return true;
}

// --- Admin: Toggle Official ---

export async function setOfficial(
  table: "positions" | "condition_groups" | "condition_options" | "actions" | "states",
  id: string,
  isOfficial: boolean,
): Promise<boolean> {
  if (!(await isAdmin())) return false;
  const supabase = createSupabaseServer();
  const { error } = await supabase.from(table).update({ is_official: isOfficial }).eq("id", id);
  if (error) { console.error("Failed to set official:", error); return false; }
  return true;
}
