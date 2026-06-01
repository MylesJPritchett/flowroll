"use server";

import { auth } from "@/auth";
import { createSupabaseServer } from "@/lib/supabase";
import { parseNotation, type ParseResult, type ParsedConditionRef } from "@/lib/import-parser";
import type { ConditionRef } from "./taxonomy";
import { loadTaxonomy } from "./taxonomy";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}

export interface ImportResult {
  positionsCreated: number;
  conditionGroupsCreated: number;
  conditionOptionsCreated: number;
  actionsCreated: number;
  statesCreated: number;
  flowsCreated: number;
  warnings: string[];
}

/**
 * Import parsed notation into the database.
 * - Positions, condition groups/options, and actions are matched by name (case-insensitive).
 * - Existing items are reused; new items are created.
 * - States are created as graph nodes for the user.
 */
export async function importNotation(input: string): Promise<ImportResult> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");

  const parsed = parseNotation(input);
  const warnings = [...parsed.warnings];
  const supabase = createSupabaseServer();

  let positionsCreated = 0;
  let conditionGroupsCreated = 0;
  let conditionOptionsCreated = 0;
  let actionsCreated = 0;
  let statesCreated = 0;
  let flowsCreated = 0;

  // Load existing taxonomy for name matching
  const taxonomy = await loadTaxonomy();
  if (!taxonomy) throw new Error("Failed to load taxonomy");

  // Build lookup maps (case-insensitive)
  const positionsByName = new Map(taxonomy.positions.map((p) => [p.name.toLowerCase(), p]));
  const groupsByName = new Map(taxonomy.conditionGroups.map((g) => [g.name.toLowerCase(), g]));
  // option lookup: "groupname:optionlabel" -> option
  const optionLookup = new Map<string, { id: string; group_id: string; label: string }>();
  for (const g of taxonomy.conditionGroups) {
    for (const o of g.options) {
      optionLookup.set(`${g.name.toLowerCase()}:${o.label.toLowerCase()}`, o);
    }
  }
  const actionsByName = new Map(taxonomy.actions.map((a) => [a.name.toLowerCase(), a]));

  // --- 1. Create missing positions (or update description on existing) ---
  for (const p of parsed.positions) {
    if (positionsByName.has(p.name.toLowerCase())) {
      // Update description if provided
      if (p.description) {
        const existing = positionsByName.get(p.name.toLowerCase())!;
        await supabase.from("positions").update({ description: p.description }).eq("id", existing.id);
      }
      continue;
    }

    const { data: maxRow } = await supabase
      .from("positions")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    const sortOrder = (maxRow?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from("positions")
      .insert({
        name: p.name,
        description: p.description,
        role_a: p.roleA,
        role_b: p.roleB,
        sort_order: sortOrder,
        created_by: userId,
        is_official: false,
        is_public: true,
      })
      .select()
      .single();

    if (error) {
      warnings.push(`Failed to create position "${p.name}": ${error.message}`);
      continue;
    }

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

    positionsByName.set(p.name.toLowerCase(), data);
    positionsCreated++;
  }

  // --- 2. Create missing condition groups and options from explicit condition: lines ---
  for (const g of parsed.conditionGroups) {
    const group = await ensureGroup(g.name);
    if (!group) continue;
    for (const opt of g.options) {
      await ensureOption(g.name, group.id, opt.label, opt.giOnly);
    }
  }

  // --- Helper: ensure a condition group exists, creating if needed ---
  async function ensureGroup(name: string): Promise<{ id: string } | null> {
    const existing = groupsByName.get(name.toLowerCase());
    if (existing) return existing;

    const { data: maxRow } = await supabase
      .from("condition_groups")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    const sortOrder = (maxRow?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from("condition_groups")
      .insert({
        name,
        sort_order: sortOrder,
        created_by: userId,
        is_official: false,
        is_public: true,
      })
      .select()
      .single();

    if (error) {
      warnings.push(`Failed to create condition group "${name}": ${error.message}`);
      return null;
    }

    const group = { ...data, options: [] } as NonNullable<typeof taxonomy>["conditionGroups"][number];
    groupsByName.set(name.toLowerCase(), group);
    conditionGroupsCreated++;
    return group;
  }

  // --- Helper: ensure a condition option exists in a group, creating if needed ---
  async function ensureOption(groupName: string, groupId: string, label: string, giOnly = false): Promise<{ id: string; group_id: string; label: string } | null> {
    const key = `${groupName.toLowerCase()}:${label.toLowerCase()}`;
    const existing = optionLookup.get(key);
    if (existing) return existing;

    const { data: maxRow } = await supabase
      .from("condition_options")
      .select("sort_order")
      .eq("group_id", groupId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    const sortOrder = (maxRow?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from("condition_options")
      .insert({
        group_id: groupId,
        label,
        gi_only: giOnly,
        sort_order: sortOrder,
        created_by: userId,
        is_official: false,
        is_public: true,
      })
      .select()
      .single();

    if (error) {
      warnings.push(`Failed to create option "${label}" in group "${groupName}": ${error.message}`);
      return null;
    }

    // Auto-enable for all positions
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

    optionLookup.set(key, data);
    conditionOptionsCreated++;
    return data;
  }

  // --- Helper: resolve ParsedConditionRef[] to ConditionRef[], auto-creating missing groups/options ---
  async function resolveConditionRefs(refs: ParsedConditionRef[]): Promise<ConditionRef[]> {
    const resolved: ConditionRef[] = [];
    for (const ref of refs) {
      const group = await ensureGroup(ref.group);
      if (!group) continue;
      const option = await ensureOption(ref.group, group.id, ref.value);
      if (!option) continue;
      resolved.push({
        groupId: group.id,
        value: ref.value,
        role: ref.role,
      });
    }
    return resolved;
  }

  // --- 3. Create missing actions ---
  for (const a of parsed.actions) {
    if (actionsByName.has(a.name.toLowerCase())) {
      // Update existing action's condition refs if provided
      const existing = actionsByName.get(a.name.toLowerCase())!;
      const updates: Record<string, unknown> = {};
      if (a.requires.length) updates.required_conditions = await resolveConditionRefs(a.requires);
      if (a.forbids.length) updates.forbidden_conditions = await resolveConditionRefs(a.forbids);
      if (a.adds.length) updates.adds_conditions = await resolveConditionRefs(a.adds);
      if (a.removes.length) updates.removes_conditions = await resolveConditionRefs(a.removes);
      if (a.giNogi) updates.gi_nogi = a.giNogi;
      if (a.description) updates.description = a.description;

      if (Object.keys(updates).length > 0) {
        await supabase.from("actions").update(updates).eq("id", existing.id);
      }
      continue;
    }

    const { data: maxRow } = await supabase
      .from("actions")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    const sortOrder = (maxRow?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from("actions")
      .insert({
        name: a.name,
        description: a.description,
        gi_nogi: a.giNogi,
        sort_order: sortOrder,
        created_by: userId,
        is_official: false,
        is_public: true,
        required_conditions: await resolveConditionRefs(a.requires),
        forbidden_conditions: await resolveConditionRefs(a.forbids),
        adds_conditions: await resolveConditionRefs(a.adds),
        removes_conditions: await resolveConditionRefs(a.removes),
      })
      .select()
      .single();

    if (error) {
      warnings.push(`Failed to create action "${a.name}": ${error.message}`);
      continue;
    }

    actionsByName.set(a.name.toLowerCase(), data);
    actionsCreated++;
  }

  // --- 4. Create state graph nodes ---
  for (const s of parsed.states) {
    // Resolve position
    const pos = positionsByName.get(s.positionName.toLowerCase());
    if (!pos) {
      warnings.push(`Unknown position "${s.positionName}" for state`);
      continue;
    }

    // Resolve conditions to StateCondition format, auto-creating missing groups/options
    const conditions: { groupId: string; value: string; role: "A" | "B" }[] = [];
    for (const c of s.roleA) {
      const group = await ensureGroup(c.group);
      if (!group) continue;
      const option = await ensureOption(c.group, group.id, c.value);
      if (!option) continue;
      conditions.push({ groupId: group.id, value: c.value, role: "A" });
    }
    for (const c of s.roleB) {
      const group = await ensureGroup(c.group);
      if (!group) continue;
      const option = await ensureOption(c.group, group.id, c.value);
      if (!option) continue;
      conditions.push({ groupId: group.id, value: c.value, role: "B" });
    }

    const nodeId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const metadata = {
      type: "state",
      conditions,
      giNogi: s.giNogi,
    };

    const { error } = await supabase.from("graph_nodes").insert({
      id: nodeId,
      user_id: userId,
      label: pos.name,
      description: s.description,
      position_x: Math.random() * 600 + 100,
      position_y: Math.random() * 600 + 100,
      metadata,
    });

    if (error) {
      warnings.push(`Failed to create state node for "${s.positionName}": ${error.message}`);
      continue;
    }

    statesCreated++;
  }

  // --- 5. Create flow graphs ---
  for (const flow of parsed.flows) {
    const flowName = flow.steps.map((s) => s.label).join(" → ");

    // Create a graph container
    const { data: graph, error: graphError } = await supabase
      .from("graphs")
      .insert({ user_id: userId, name: flowName })
      .select()
      .single();

    if (graphError || !graph) {
      warnings.push(`Failed to create flow graph: ${graphError?.message}`);
      continue;
    }

    const graphId = graph.id as string;
    const nodeIds: string[] = [];
    const xSpacing = 250;

    for (let idx = 0; idx < flow.steps.length; idx++) {
      const step = flow.steps[idx];
      const nodeId = `flow-${graphId}-${idx}-${Math.random().toString(36).slice(2, 8)}`;
      nodeIds.push(nodeId);

      if (step.type === "state") {
        // Try to match an existing position
        const pos = positionsByName.get(step.label.toLowerCase());
        const { error } = await supabase.from("graph_nodes").insert({
          id: nodeId,
          user_id: userId,
          graph_id: graphId,
          label: pos?.name ?? step.label,
          description: "",
          position_x: idx * xSpacing + 100,
          position_y: 200,
          metadata: { type: "state", conditions: [], giNogi: "" },
        });
        if (error) warnings.push(`Failed to create flow node "${step.label}": ${error.message}`);
      } else {
        // Action step
        const action = actionsByName.get(step.label.toLowerCase());
        const { error } = await supabase.from("graph_nodes").insert({
          id: nodeId,
          user_id: userId,
          graph_id: graphId,
          label: action?.name ?? step.label,
          description: "",
          position_x: idx * xSpacing + 100,
          position_y: 200,
          metadata: { type: "action", action_id: action?.id ?? "", actor: "A" },
        });
        if (error) warnings.push(`Failed to create flow node "${step.label}": ${error.message}`);
      }
    }

    // Create edges between consecutive nodes
    const edgeRows = [];
    for (let idx = 0; idx < nodeIds.length - 1; idx++) {
      edgeRows.push({
        id: `edge-${graphId}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        user_id: userId,
        graph_id: graphId,
        source_node_id: nodeIds[idx],
        target_node_id: nodeIds[idx + 1],
        relationship: "",
        metadata: {},
      });
    }
    if (edgeRows.length > 0) {
      const { error } = await supabase.from("graph_edges").insert(edgeRows);
      if (error) warnings.push(`Failed to create flow edges: ${error.message}`);
    }

    flowsCreated++;
  }

  return {
    positionsCreated,
    conditionGroupsCreated,
    conditionOptionsCreated,
    actionsCreated,
    statesCreated,
    flowsCreated,
    warnings,
  };
}
