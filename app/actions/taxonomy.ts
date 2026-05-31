"use server";

import { createSupabaseServer } from "@/lib/supabase";

// --- Types ---

export interface Position {
  id: string;
  name: string;
  role_a: string;
  role_b: string;
  sort_order: number;
}

export interface ConditionOption {
  id: string;
  group_id: string;
  label: string;
  gi_only: boolean;
  sort_order: number;
}

export interface ConditionGroup {
  id: string;
  name: string;
  sort_order: number;
  options: ConditionOption[];
}

// --- Load ---

export async function loadTaxonomy(): Promise<{
  positions: Position[];
  conditionGroups: ConditionGroup[];
  // key: "positionId:role" → Set of allowed condition_option_ids
  positionConditions: Record<string, string[]>;
} | null> {
  const supabase = createSupabaseServer();

  const [posResult, groupsResult, optionsResult] = await Promise.all([
    supabase.from("positions").select("*").order("sort_order"),
    supabase.from("condition_groups").select("*").order("sort_order"),
    supabase.from("condition_options").select("*").order("sort_order"),
  ]);

  if (posResult.error || groupsResult.error || optionsResult.error) {
    console.error("Failed to load taxonomy:", posResult.error, groupsResult.error, optionsResult.error);
    return null;
  }

  // Paginate position_conditions to avoid the 1000-row default cap
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
  for (const opt of optionsResult.data) {
    const list = optionsByGroup.get(opt.group_id) ?? [];
    list.push(opt);
    optionsByGroup.set(opt.group_id, list);
  }

  const conditionGroups: ConditionGroup[] = groupsResult.data.map((g) => ({
    ...g,
    options: optionsByGroup.get(g.id) ?? [],
  }));

  // Build position+role → allowed option ids
  const positionConditions: Record<string, string[]> = {};
  for (const row of allPcRows) {
    const key = `${row.position_id}:${row.role}`;
    if (!positionConditions[key]) positionConditions[key] = [];
    positionConditions[key].push(row.condition_option_id);
  }

  return { positions: posResult.data, conditionGroups, positionConditions };
}

// --- Positions CRUD ---

export async function addPosition(name: string, roleA: string, roleB: string): Promise<Position | null> {
  const supabase = createSupabaseServer();
  const { data: maxRow } = await supabase.from("positions").select("sort_order").order("sort_order", { ascending: false }).limit(1).single();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("positions")
    .insert({ name, role_a: roleA, role_b: roleB, sort_order: sortOrder })
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

export async function updatePosition(id: string, updates: { name?: string; role_a?: string; role_b?: string }): Promise<boolean> {
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
  const supabase = createSupabaseServer();
  const { data: maxRow } = await supabase.from("condition_groups").select("sort_order").order("sort_order", { ascending: false }).limit(1).single();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("condition_groups")
    .insert({ name, sort_order: sortOrder })
    .select()
    .single();

  if (error) { console.error("Failed to add condition group:", error); return null; }
  return { ...data, options: [] };
}

export async function updateConditionGroup(id: string, updates: { name?: string }): Promise<boolean> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("condition_groups").update(updates).eq("id", id);
  if (error) { console.error("Failed to update condition group:", error); return false; }
  return true;
}

export async function deleteConditionGroup(id: string): Promise<boolean> {
  const supabase = createSupabaseServer();
  // Options cascade-delete via FK
  const { error } = await supabase.from("condition_groups").delete().eq("id", id);
  if (error) { console.error("Failed to delete condition group:", error); return false; }
  return true;
}

// --- Condition Options CRUD ---

export async function addConditionOption(groupId: string, label: string, giOnly: boolean): Promise<ConditionOption | null> {
  const supabase = createSupabaseServer();
  const { data: maxRow } = await supabase.from("condition_options").select("sort_order").eq("group_id", groupId).order("sort_order", { ascending: false }).limit(1).single();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("condition_options")
    .insert({ group_id: groupId, label, gi_only: giOnly, sort_order: sortOrder })
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

export async function updateConditionOption(id: string, updates: { label?: string; gi_only?: boolean }): Promise<boolean> {
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
