"use client";

import { useEffect, useState } from "react";
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
  setPositionCondition,
  addAction,
  updateAction,
  deleteAction,
  setOfficial,
  setPositionRequirement,
  type Position,
  type ConditionGroup,
  type Action,
  type PositionRequirement,
  type ConditionRef,
} from "../actions/taxonomy";

function OfficialBadge() {
  return <span className="text-green-400 text-[10px]" title="Official">&#10003;</span>;
}

function CreatedByBadge({ createdBy }: { createdBy: string | null }) {
  if (!createdBy) return null;
  return <span className="text-[9px] text-zinc-500 ml-1" title={createdBy}>by {createdBy.split("@")[0]}</span>;
}

interface DatabaseViewProps {
  mode: "database" | "admin";
  userId: string;
}

export default function DatabaseView({ mode, userId }: DatabaseViewProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [groups, setGroups] = useState<ConditionGroup[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [pcMap, setPcMap] = useState<Record<string, Set<string>>>({});
  const [posReqs, setPosReqs] = useState<Record<string, PositionRequirement[]>>({});
  const [loading, setLoading] = useState(true);

  const tabs = ["positions", "conditions", "actions", "mappings"] as const;
  type Tab = (typeof tabs)[number];
  const [activeTab, setActiveTab] = useState<Tab>("positions");

  useEffect(() => {
    loadTaxonomy().then((data) => {
      if (data) {
        let pos = data.positions;
        let grps = data.conditionGroups;
        let acts = data.actions;
        // In admin mode, only show official items
        if (mode === "admin") {
          pos = pos.filter((p) => p.is_official);
          grps = grps.filter((g) => g.is_official).map((g) => ({
            ...g,
            options: g.options.filter((o) => o.is_official),
          }));
          acts = acts.filter((a) => a.is_official);
        }
        setPositions(pos);
        setGroups(grps);
        setActions(acts);
        const map: Record<string, Set<string>> = {};
        for (const [key, ids] of Object.entries(data.positionConditions)) {
          map[key] = new Set(ids);
        }
        setPcMap(map);
        setPosReqs(data.positionRequirements);
      }
      setLoading(false);
    });
  }, [mode]);

  const canEdit = (item: { created_by: string | null; is_official: boolean }) => {
    if (mode === "admin") return true;
    if (item.created_by === userId) return true;
    return false;
  };

  const toggleMapping = async (posId: string, optionId: string, role: "A" | "B") => {
    const key = `${posId}:${role}`;
    const current = pcMap[key] ?? new Set();
    const enabled = !current.has(optionId);
    await setPositionCondition(posId, optionId, role, enabled);
    setPcMap((prev) => {
      const next = new Set(prev[key] ?? []);
      if (enabled) next.add(optionId);
      else next.delete(optionId);
      return { ...prev, [key]: next };
    });
  };

  const isEnabled = (posId: string, optionId: string, role: "A" | "B") => {
    return pcMap[`${posId}:${role}`]?.has(optionId) ?? false;
  };

  const handleToggleOfficial = async (table: "positions" | "condition_groups" | "condition_options" | "actions", id: string, current: boolean) => {
    await setOfficial(table, id, !current);
    // Update local state
    const toggle = <T extends { id: string; is_official: boolean }>(items: T[]) =>
      items.map((i) => (i.id === id ? { ...i, is_official: !current } : i));
    if (table === "positions") setPositions(toggle);
    else if (table === "condition_groups") setGroups((prev) => toggle(prev));
    else if (table === "condition_options") {
      setGroups((prev) => prev.map((g) => ({ ...g, options: toggle(g.options) })));
    }
    else if (table === "actions") setActions(toggle);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-sm text-zinc-500">Loading...</p></div>;
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex gap-1 border-b border-zinc-800 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            {tab === "positions" ? "Positions" : tab === "conditions" ? "Conditions" : tab === "actions" ? "Actions" : "Position Conditions"}
          </button>
        ))}
      </div>

      {/* --- Positions --- */}
      {activeTab === "positions" && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Positions</h2>
            <button
              onClick={async () => {
                const pos = await addPosition("New Position", "A", "B");
                if (pos) setPositions((prev) => [...prev, pos]);
              }}
              className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              + Add Position
            </button>
          </div>
          <div className="space-y-1">
            {positions.map((pos) => (
              <PositionRowWithReqs
                key={pos.id}
                position={pos}
                groups={groups}
                requirements={posReqs[pos.id] ?? []}
                editable={canEdit(pos)}
                mode={mode}
                onUpdate={(updates) => {
                  updatePosition(pos.id, updates);
                  setPositions((prev) => prev.map((p) => (p.id === pos.id ? { ...p, ...updates } : p)));
                }}
                onDelete={() => { deletePosition(pos.id); setPositions((prev) => prev.filter((p) => p.id !== pos.id)); }}
                onToggleOfficial={() => handleToggleOfficial("positions", pos.id, pos.is_official)}
                onToggleRequirement={async (optionId, role, required) => {
                  await setPositionRequirement(pos.id, optionId, role, required);
                  setPosReqs((prev) => {
                    const current = prev[pos.id] ?? [];
                    if (required) {
                      return { ...prev, [pos.id]: [...current, { id: "", position_id: pos.id, condition_option_id: optionId, role }] };
                    }
                    return { ...prev, [pos.id]: current.filter((r) => !(r.condition_option_id === optionId && r.role === role)) };
                  });
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* --- Conditions --- */}
      {activeTab === "conditions" && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Condition Groups</h2>
            <button
              onClick={async () => {
                const group = await addConditionGroup("New Group");
                if (group) setGroups((prev) => [...prev, group]);
              }}
              className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              + Add Group
            </button>
          </div>
          <div className="space-y-3">
            {groups.map((group) => {
              const editable = canEdit(group);
              return (
                <div key={group.id} className="rounded border border-zinc-800 bg-zinc-900 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    {group.is_official && <OfficialBadge />}
                    {mode === "admin" && (
                      <button
                        onClick={() => handleToggleOfficial("condition_groups", group.id, group.is_official)}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${group.is_official ? "bg-green-600/20 text-green-400" : "bg-zinc-700 text-zinc-500 hover:text-green-400"}`}
                      >
                        {group.is_official ? "official" : "set official"}
                      </button>
                    )}
                    <input
                      type="text"
                      value={group.name}
                      disabled={!editable}
                      onChange={(e) => {
                        updateConditionGroup(group.id, { name: e.target.value });
                        setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, name: e.target.value } : g)));
                      }}
                      className={`flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm font-medium text-zinc-100 outline-none focus:border-indigo-500 ${!editable ? "opacity-50" : ""}`}
                    />
                    <CreatedByBadge createdBy={group.created_by} />
                    {editable && (
                      <button onClick={() => { deleteConditionGroup(group.id); setGroups((prev) => prev.filter((g) => g.id !== group.id)); }} className="text-zinc-500 hover:text-red-400 transition-colors px-1">&times;</button>
                    )}
                  </div>
                  <div className="ml-4 space-y-1">
                    {group.options.map((opt) => {
                      const optEditable = canEdit(opt);
                      return (
                        <div key={opt.id} className="flex items-center gap-2">
                          {opt.is_official && <OfficialBadge />}
                          {mode === "admin" && (
                            <button
                              onClick={() => handleToggleOfficial("condition_options", opt.id, opt.is_official)}
                              className={`text-[9px] px-1 py-0.5 rounded transition-colors ${opt.is_official ? "bg-green-600/20 text-green-400" : "bg-zinc-700 text-zinc-500 hover:text-green-400"}`}
                            >
                              {opt.is_official ? "off." : "set"}
                            </button>
                          )}
                          <input
                            type="text"
                            value={opt.label}
                            disabled={!optEditable}
                            onChange={(e) => {
                              updateConditionOption(opt.id, { label: e.target.value });
                              setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, options: g.options.map((o) => o.id === opt.id ? { ...o, label: e.target.value } : o) } : g));
                            }}
                            className={`flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-indigo-500 ${!optEditable ? "opacity-50" : ""}`}
                          />
                          <label className="flex items-center gap-1 text-[10px] text-zinc-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={opt.gi_only}
                              disabled={!optEditable}
                              onChange={(e) => {
                                updateConditionOption(opt.id, { gi_only: e.target.checked });
                                setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, options: g.options.map((o) => o.id === opt.id ? { ...o, gi_only: e.target.checked } : o) } : g));
                              }}
                              className="rounded border-zinc-600"
                            />
                            Gi only
                          </label>
                          {optEditable && (
                            <button onClick={() => { deleteConditionOption(opt.id); setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, options: g.options.filter((o) => o.id !== opt.id) } : g)); }} className="text-zinc-500 hover:text-red-400 transition-colors px-1 text-xs">&times;</button>
                          )}
                        </div>
                      );
                    })}
                    {editable && (
                      <button
                        onClick={async () => {
                          const opt = await addConditionOption(group.id, "new option", false);
                          if (opt) setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, options: [...g.options, opt] } : g));
                        }}
                        className="mt-1 text-[10px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        + Add Option
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* --- Actions --- */}
      {activeTab === "actions" && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Actions</h2>
            <button
              onClick={async () => {
                const action = await addAction("New Action", "", "");
                if (action) setActions((prev) => [...prev, action]);
              }}
              className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              + Add Action
            </button>
          </div>
          <div className="space-y-1">
            {actions.map((action) => (
              <ActionRowWithPrereqs
                key={action.id}
                action={action}
                groups={groups}
                editable={canEdit(action)}
                mode={mode}
                onUpdate={(updates) => {
                  updateAction(action.id, updates);
                  setActions((prev) => prev.map((a) => a.id === action.id ? { ...a, ...updates } : a));
                }}
                onDelete={() => { deleteAction(action.id); setActions((prev) => prev.filter((a) => a.id !== action.id)); }}
                onToggleOfficial={() => handleToggleOfficial("actions", action.id, action.is_official)}
              />
            ))}
          </div>
        </section>
      )}

      {/* --- Position Conditions (admin only) --- */}
      {activeTab === "mappings" && (
        <section>
          <p className="mb-4 text-xs text-zinc-500">
            Toggle which conditions are available for each position + role.
          </p>
          <div className="space-y-4">
            {positions.map((pos) => (
              <PositionMappingRow
                key={pos.id}
                position={pos}
                groups={groups}
                isEnabled={isEnabled}
                onToggle={toggleMapping}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// --- Position Condition Mapping Row ---

function PositionMappingRow({
  position,
  groups,
  isEnabled,
  onToggle,
}: {
  position: Position;
  groups: ConditionGroup[];
  isEnabled: (posId: string, optionId: string, role: "A" | "B") => boolean;
  onToggle: (posId: string, optionId: string, role: "A" | "B") => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-zinc-500 text-xs select-none">{expanded ? "▼" : "▶"}</span>
        <span className="font-medium text-sm text-zinc-100">{position.name}</span>
        <span className="text-[10px] text-zinc-500">{position.role_a} / {position.role_b}</span>
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="mb-1 text-[10px] font-medium text-zinc-400">{group.name}</div>
              {(["A", "B"] as const).map((role) => {
                const roleLabel = role === "A" ? position.role_a : position.role_b;
                return (
                  <div key={role} className="mb-1 flex items-center gap-1">
                    <span className="w-16 shrink-0 text-[9px] font-medium text-zinc-500">{roleLabel}</span>
                    <div className="flex flex-wrap gap-0.5">
                      {group.options.map((opt) => {
                        const enabled = isEnabled(position.id, opt.id, role);
                        return (
                          <button
                            key={opt.id}
                            onClick={() => onToggle(position.id, opt.id, role)}
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                              enabled
                                ? "bg-indigo-500 text-white"
                                : "bg-zinc-700 text-zinc-500 line-through"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Position Row with Requirements ---

function PositionRowWithReqs({
  position,
  groups,
  requirements,
  editable,
  mode,
  onUpdate,
  onDelete,
  onToggleOfficial,
  onToggleRequirement,
}: {
  position: Position;
  groups: ConditionGroup[];
  requirements: PositionRequirement[];
  editable: boolean;
  mode: "database" | "admin";
  onUpdate: (updates: { name?: string; role_a?: string; role_b?: string }) => void;
  onDelete: () => void;
  onToggleOfficial: () => void;
  onToggleRequirement: (optionId: string, role: "A" | "B", required: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRequired = (optionId: string, role: "A" | "B") =>
    requirements.some((r) => r.condition_option_id === optionId && r.role === role);

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setExpanded(!expanded)} className="text-zinc-500 text-xs select-none">
          {expanded ? "▼" : "▶"}
        </button>
        {position.is_official && <OfficialBadge />}
        {mode === "admin" && (
          <button
            onClick={onToggleOfficial}
            className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${position.is_official ? "bg-green-600/20 text-green-400" : "bg-zinc-700 text-zinc-500 hover:text-green-400"}`}
          >
            {position.is_official ? "official" : "set official"}
          </button>
        )}
        <input
          type="text" value={position.name} disabled={!editable}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className={`flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500 ${!editable ? "opacity-50" : ""}`}
        />
        <input
          type="text" value={position.role_a} disabled={!editable}
          onChange={(e) => onUpdate({ role_a: e.target.value })}
          className={`w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500 ${!editable ? "opacity-50" : ""}`}
        />
        <input
          type="text" value={position.role_b} disabled={!editable}
          onChange={(e) => onUpdate({ role_b: e.target.value })}
          className={`w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500 ${!editable ? "opacity-50" : ""}`}
        />
        <CreatedByBadge createdBy={position.created_by} />
        {editable && (
          <button onClick={onDelete} className="text-zinc-500 hover:text-red-400 transition-colors px-1">&times;</button>
        )}
      </div>
      {expanded && (
        <div className="px-4 pb-3 pt-1">
          <div className="text-[10px] font-medium text-zinc-400 mb-2">Required Conditions</div>
          <p className="text-[9px] text-zinc-600 mb-2">Toggle conditions that MUST be present for this position to be valid.</p>
          <div className="space-y-2">
            {(["A", "B"] as const).map((role) => {
              const roleLabel = role === "A" ? position.role_a : position.role_b;
              return (
                <div key={role}>
                  <div className="mb-1 text-[9px] font-semibold text-zinc-300">{roleLabel}</div>
                  <div className="space-y-1 ml-1">
                    {groups.map((group) => {
                      if (group.options.length === 0) return null;
                      return (
                        <div key={group.id} className="flex items-center gap-1">
                          <span className="w-20 shrink-0 text-[9px] font-medium text-zinc-500">{group.name}</span>
                          <div className="flex flex-wrap gap-0.5">
                            {group.options.map((opt) => {
                              const req = isRequired(opt.id, role);
                              return (
                                <button
                                  key={opt.id}
                                  disabled={!editable}
                                  onClick={() => onToggleRequirement(opt.id, role, !req)}
                                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                                    req
                                      ? "bg-amber-500 text-white"
                                      : "bg-zinc-700/50 text-zinc-500 hover:bg-zinc-700"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Action Row with Prerequisites ---

function ActionRowWithPrereqs({
  action,
  groups,
  editable,
  mode,
  onUpdate,
  onDelete,
  onToggleOfficial,
}: {
  action: Action;
  groups: ConditionGroup[];
  editable: boolean;
  mode: "database" | "admin";
  onUpdate: (updates: Partial<Action>) => void;
  onDelete: () => void;
  onToggleOfficial: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const toggleConditionRef = (list: ConditionRef[], ref: ConditionRef): ConditionRef[] => {
    const exists = list.some((r) => r.groupId === ref.groupId && r.value === ref.value && r.role === ref.role);
    if (exists) return list.filter((r) => !(r.groupId === ref.groupId && r.value === ref.value && r.role === ref.role));
    return [...list, ref];
  };

  const isInList = (list: ConditionRef[], groupId: string, value: string, role: "A" | "B") =>
    list.some((r) => r.groupId === groupId && r.value === value && r.role === role);

  const renderConditionPicker = (label: string, list: ConditionRef[], color: string, onToggle: (ref: ConditionRef) => void) => (
    <div>
      <div className="text-[10px] font-medium text-zinc-400 mb-1">{label}</div>
      <div className="space-y-2">
        {(["A", "B"] as const).map((role) => (
          <div key={role}>
            <div className="mb-0.5 text-[9px] font-semibold text-zinc-300">Player {role}</div>
            <div className="space-y-1 ml-1">
              {groups.map((group) => {
                if (group.options.length === 0) return null;
                return (
                  <div key={group.id} className="flex items-center gap-1">
                    <span className="w-20 shrink-0 text-[9px] font-medium text-zinc-500">{group.name}</span>
                    <div className="flex flex-wrap gap-0.5">
                      {group.options.map((opt) => {
                        const active = isInList(list, group.id, opt.label, role);
                        return (
                          <button
                            key={opt.label}
                            disabled={!editable}
                            onClick={() => onToggle({ groupId: group.id, value: opt.label, role })}
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                              active ? `${color} text-white` : "bg-zinc-700/50 text-zinc-500 hover:bg-zinc-700"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setExpanded(!expanded)} className="text-zinc-500 text-xs select-none">
          {expanded ? "▼" : "▶"}
        </button>
        {action.is_official && <OfficialBadge />}
        {mode === "admin" && (
          <button
            onClick={onToggleOfficial}
            className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${action.is_official ? "bg-green-600/20 text-green-400" : "bg-zinc-700 text-zinc-500 hover:text-green-400"}`}
          >
            {action.is_official ? "official" : "set official"}
          </button>
        )}
        <input
          type="text" value={action.name} disabled={!editable}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className={`flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500 ${!editable ? "opacity-50" : ""}`}
        />
        <select
          value={action.gi_nogi} disabled={!editable}
          onChange={(e) => onUpdate({ gi_nogi: e.target.value as "" | "gi" | "nogi" })}
          className={`rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-indigo-500 ${!editable ? "opacity-50" : ""}`}
        >
          <option value="">Both</option>
          <option value="gi">Gi</option>
          <option value="nogi">No-Gi</option>
        </select>
        {action.required_conditions.length > 0 && (
          <span className="text-[9px] text-green-400" title="Has required conditions">req:{action.required_conditions.length}</span>
        )}
        {action.forbidden_conditions.length > 0 && (
          <span className="text-[9px] text-red-400" title="Has forbidden conditions">forb:{action.forbidden_conditions.length}</span>
        )}
        <CreatedByBadge createdBy={action.created_by} />
        {editable && (
          <button onClick={onDelete} className="text-zinc-500 hover:text-red-400 transition-colors px-1">&times;</button>
        )}
      </div>
      {expanded && (
        <div className="px-4 pb-3 pt-1 space-y-3">
          {renderConditionPicker(
            "Required Conditions (must be present to use this action)",
            action.required_conditions,
            "bg-green-600",
            (ref) => {
              const next = toggleConditionRef(action.required_conditions, ref);
              onUpdate({ required_conditions: next });
            },
          )}
          {renderConditionPicker(
            "Forbidden Conditions (action cannot be used if present)",
            action.forbidden_conditions,
            "bg-red-600",
            (ref) => {
              const next = toggleConditionRef(action.forbidden_conditions, ref);
              onUpdate({ forbidden_conditions: next });
            },
          )}
        </div>
      )}
    </div>
  );
}
