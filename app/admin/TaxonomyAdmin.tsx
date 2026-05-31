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
  type Position,
  type ConditionGroup,
  type Action,
} from "../actions/taxonomy";

export default function TaxonomyAdmin() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [groups, setGroups] = useState<ConditionGroup[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [pcMap, setPcMap] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"positions" | "conditions" | "actions" | "mappings">("positions");

  useEffect(() => {
    loadTaxonomy().then((data) => {
      if (data) {
        setPositions(data.positions);
        setGroups(data.conditionGroups);
        setActions(data.actions);
        // Convert string[] to Set for easier toggling
        const map: Record<string, Set<string>> = {};
        for (const [key, ids] of Object.entries(data.positionConditions)) {
          map[key] = new Set(ids);
        }
        setPcMap(map);
      }
      setLoading(false);
    });
  }, []);

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
    const key = `${posId}:${role}`;
    return pcMap[key]?.has(optionId) ?? false;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-sm text-zinc-500">Loading...</p></div>;
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-zinc-800 pb-2">
        {(["positions", "conditions", "actions", "mappings"] as const).map((tab) => (
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
              <PositionRow
                key={pos.id}
                position={pos}
                onUpdate={(updates) => {
                  updatePosition(pos.id, updates);
                  setPositions((prev) => prev.map((p) => (p.id === pos.id ? { ...p, ...updates } : p)));
                }}
                onDelete={() => {
                  deletePosition(pos.id);
                  setPositions((prev) => prev.filter((p) => p.id !== pos.id));
                }}
              />
            ))}
          </div>
        </section>
      )}

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
            {groups.map((group) => (
              <ConditionGroupRow
                key={group.id}
                group={group}
                onUpdateGroup={(updates) => {
                  updateConditionGroup(group.id, updates);
                  setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, ...updates } : g)));
                }}
                onDeleteGroup={() => {
                  deleteConditionGroup(group.id);
                  setGroups((prev) => prev.filter((g) => g.id !== group.id));
                }}
                onAddOption={async (label, giOnly) => {
                  const opt = await addConditionOption(group.id, label, giOnly);
                  if (opt) {
                    setGroups((prev) =>
                      prev.map((g) => (g.id === group.id ? { ...g, options: [...g.options, opt] } : g)),
                    );
                  }
                }}
                onUpdateOption={(optId, updates) => {
                  updateConditionOption(optId, updates);
                  setGroups((prev) =>
                    prev.map((g) =>
                      g.id === group.id
                        ? { ...g, options: g.options.map((o) => (o.id === optId ? { ...o, ...updates } : o)) }
                        : g,
                    ),
                  );
                }}
                onDeleteOption={(optId) => {
                  deleteConditionOption(optId);
                  setGroups((prev) =>
                    prev.map((g) =>
                      g.id === group.id ? { ...g, options: g.options.filter((o) => o.id !== optId) } : g,
                    ),
                  );
                }}
              />
            ))}
          </div>
        </section>
      )}

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
              <ActionRow
                key={action.id}
                action={action}
                onUpdate={(updates) => {
                  updateAction(action.id, updates);
                  setActions((prev) => prev.map((a) => (a.id === action.id ? { ...a, ...updates } : a)));
                }}
                onDelete={() => {
                  deleteAction(action.id);
                  setActions((prev) => prev.filter((a) => a.id !== action.id));
                }}
              />
            ))}
          </div>
        </section>
      )}

      {activeTab === "mappings" && (
        <section>
          <p className="mb-4 text-xs text-zinc-500">
            Toggle which conditions are available for each position + role. Unchecked conditions won&apos;t appear when editing states with that position.
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

// --- Position Row ---

function PositionRow({
  position,
  onUpdate,
  onDelete,
}: {
  position: Position;
  onUpdate: (updates: { name?: string; role_a?: string; role_b?: string }) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
      <input
        type="text"
        value={position.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500"
        placeholder="Position name"
      />
      <input
        type="text"
        value={position.role_a}
        onChange={(e) => onUpdate({ role_a: e.target.value })}
        className="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500"
        placeholder="Role A"
      />
      <input
        type="text"
        value={position.role_b}
        onChange={(e) => onUpdate({ role_b: e.target.value })}
        className="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500"
        placeholder="Role B"
      />
      <button onClick={onDelete} className="text-zinc-500 hover:text-red-400 transition-colors px-1">&times;</button>
    </div>
  );
}

// --- Condition Group Row ---

function ConditionGroupRow({
  group,
  onUpdateGroup,
  onDeleteGroup,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
}: {
  group: ConditionGroup;
  onUpdateGroup: (updates: { name?: string }) => void;
  onDeleteGroup: () => void;
  onAddOption: (label: string, giOnly: boolean) => void;
  onUpdateOption: (optId: string, updates: { label?: string; gi_only?: boolean }) => void;
  onDeleteOption: (optId: string) => void;
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={group.name}
          onChange={(e) => onUpdateGroup({ name: e.target.value })}
          className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm font-medium text-zinc-100 outline-none focus:border-indigo-500"
          placeholder="Group name"
        />
        <button onClick={onDeleteGroup} className="text-zinc-500 hover:text-red-400 transition-colors px-1">&times;</button>
      </div>
      <div className="ml-4 space-y-1">
        {group.options.map((opt) => (
          <div key={opt.id} className="flex items-center gap-2">
            <input
              type="text"
              value={opt.label}
              onChange={(e) => onUpdateOption(opt.id, { label: e.target.value })}
              className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-indigo-500"
              placeholder="Option label"
            />
            <label className="flex items-center gap-1 text-[10px] text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={opt.gi_only}
                onChange={(e) => onUpdateOption(opt.id, { gi_only: e.target.checked })}
                className="rounded border-zinc-600"
              />
              Gi only
            </label>
            <button onClick={() => onDeleteOption(opt.id)} className="text-zinc-500 hover:text-red-400 transition-colors px-1 text-xs">&times;</button>
          </div>
        ))}
        <button
          onClick={() => onAddOption("new option", false)}
          className="mt-1 text-[10px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Add Option
        </button>
      </div>
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

// --- Action Row ---

function ActionRow({
  action,
  onUpdate,
  onDelete,
}: {
  action: Action;
  onUpdate: (updates: { name?: string; description?: string; gi_nogi?: "" | "gi" | "nogi" }) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
      <input
        type="text"
        value={action.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500"
        placeholder="Action name"
      />
      <select
        value={action.gi_nogi}
        onChange={(e) => onUpdate({ gi_nogi: e.target.value as "" | "gi" | "nogi" })}
        className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-indigo-500"
      >
        <option value="">Both</option>
        <option value="gi">Gi</option>
        <option value="nogi">No-Gi</option>
      </select>
      <button onClick={onDelete} className="text-zinc-500 hover:text-red-400 transition-colors px-1">&times;</button>
    </div>
  );
}
