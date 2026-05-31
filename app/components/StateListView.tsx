"use client";

import { useState } from "react";
import type { GraphStateNode, GiNogi } from "../actions/graph";
import type { StateCondition } from "../concepts";
import { getRoleLabels, getFilteredOptions, getAllowedOptionIds } from "../concepts";
import type { Taxonomy } from "../concepts";

interface StateListViewProps {
  nodes: GraphStateNode[];
  taxonomy: Taxonomy;
  onAdd: () => void;
  onUpdate: (node: GraphStateNode) => void;
  onDelete: (id: string) => void;
}

function StateRow({ node, taxonomy, onUpdate, onDelete }: { node: GraphStateNode; taxonomy: Taxonomy; onUpdate: (n: GraphStateNode) => void; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showPositionSuggestions, setShowPositionSuggestions] = useState(false);
  const roles = getRoleLabels(node.position_name, taxonomy.positions);

  const update = (patch: Partial<GraphStateNode>) => {
    onUpdate({ ...node, ...patch });
  };

  const toggleCondition = (groupId: string, value: string, role: "A" | "B") => {
    const existing = node.conditions.find((c) => c.groupId === groupId && c.role === role);
    let next: StateCondition[];
    if (existing?.value === value) {
      next = node.conditions.filter((c) => !(c.groupId === groupId && c.role === role));
    } else {
      next = [...node.conditions.filter((c) => !(c.groupId === groupId && c.role === role)), { groupId, value, role }];
    }
    update({ conditions: next });
  };

  const getActiveValue = (groupId: string, role: "A" | "B") => {
    return node.conditions.find((c) => c.groupId === groupId && c.role === role)?.value;
  };

  const filteredPositions = taxonomy.positions.filter((p) =>
    p.name.toLowerCase().includes(node.position_name.toLowerCase()),
  );

  return (
    <div className="border-b border-zinc-800">
      {/* Summary row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-zinc-500 text-xs select-none">{expanded ? "▼" : "▶"}</span>
        <span className="font-medium text-sm text-zinc-100 min-w-[160px]">{node.position_name}</span>
        <div className="flex flex-wrap gap-1 flex-1">
          {node.conditions.map((c) => {
            const roleLabel = c.role === "A" ? roles.roleA : roles.roleB;
            return (
              <span
                key={`${c.groupId}-${c.role}`}
                className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-medium text-indigo-300"
              >
                <span className="opacity-60">{roleLabel}</span> {c.value}
              </span>
            );
          })}
        </div>
        {node.giNogi && (
          <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
            {node.giNogi === "gi" ? "Gi" : "No-Gi"}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
          className="text-zinc-500 hover:text-red-400 text-xs transition-colors px-1"
        >
          &times;
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 bg-zinc-900/50">
          {/* Position */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Position</label>
            <input
              type="text"
              value={node.position_name}
              onFocus={() => setShowPositionSuggestions(true)}
              onBlur={() => setTimeout(() => setShowPositionSuggestions(false), 200)}
              onChange={(e) => {
                setShowPositionSuggestions(true);
                update({ position_name: e.target.value });
              }}
              className="w-full max-w-sm rounded-md border border-zinc-600 bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {showPositionSuggestions && filteredPositions.length > 0 && node.position_name !== filteredPositions[0]?.name && (
              <div className="mt-1 flex flex-wrap gap-1">
                {filteredPositions.slice(0, 8).map((p) => (
                  <button
                    key={p.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setShowPositionSuggestions(false);
                      update({ position_name: p.name });
                    }}
                    className="rounded-full bg-zinc-600/30 px-2 py-0.5 text-[10px] font-medium text-zinc-300 hover:bg-zinc-600/50 transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-1 text-[10px] text-zinc-500">{roles.roleA} / {roles.roleB}</div>
          </div>

          {/* Gi / No-Gi */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Gi / No-Gi</label>
            <div className="flex gap-2 max-w-xs">
              {([
                { value: "" as GiNogi, label: "Both" },
                { value: "gi" as GiNogi, label: "Gi" },
                { value: "nogi" as GiNogi, label: "No-Gi" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    let nextConditions = node.conditions;
                    if (opt.value === "nogi") {
                      const giOnlyValues = new Set(
                        taxonomy.conditionGroups.flatMap((g) => g.options.filter((o) => o.gi_only).map((o) => o.label)),
                      );
                      nextConditions = node.conditions.filter((c) => !giOnlyValues.has(c.value));
                    }
                    update({ giNogi: opt.value, conditions: nextConditions });
                  }}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium text-white transition-colors bg-zinc-600 ${
                    node.giNogi === opt.value
                      ? "ring-2 ring-offset-1 ring-offset-zinc-900 ring-white"
                      : "opacity-50 hover:opacity-75"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-400">Conditions</label>
            <div className="space-y-3">
              {(["A", "B"] as const).map((role) => {
                const roleLabel = role === "A" ? roles.roleA : roles.roleB;
                const allowed = getAllowedOptionIds(node.position_name, role, taxonomy);
                const groupRows = taxonomy.conditionGroups.map((group) => {
                  const opts = getFilteredOptions(group, node.giNogi, allowed);
                  return { group, opts };
                }).filter((r) => r.opts.length > 0);

                if (groupRows.length === 0) return null;
                return (
                  <div key={role}>
                    <div className="mb-1.5 text-[10px] font-semibold text-zinc-300">
                      {roleLabel}
                    </div>
                    <div className="space-y-1.5 ml-1">
                      {groupRows.map(({ group, opts }) => {
                        const activeValue = getActiveValue(group.id, role);
                        return (
                          <div key={group.id} className="flex items-center gap-1">
                            <span className="w-20 shrink-0 text-[9px] font-medium text-zinc-500">{group.name}</span>
                            <div className="flex flex-wrap gap-0.5">
                              {opts.map((opt) => {
                                const active = activeValue === opt.label;
                                return (
                                  <button
                                    key={opt.label}
                                    onClick={() => toggleCondition(group.id, opt.label, role)}
                                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                                      active
                                        ? "bg-indigo-500 text-white"
                                        : "bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/30"
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

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Notes</label>
            <textarea
              value={node.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
              className="w-full max-w-lg rounded-md border border-zinc-600 bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function StateListView({ nodes, taxonomy, onAdd, onUpdate, onDelete }: StateListViewProps) {
  return (
    <div className="h-full overflow-y-auto bg-zinc-950">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <span className="text-sm font-medium text-zinc-400">{nodes.length} states</span>
        <button
          onClick={onAdd}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-indigo-500"
        >
          + Add State
        </button>
      </div>
      {nodes.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-zinc-500">No states yet. Add one to get started.</p>
        </div>
      )}
      {nodes.map((node) => (
        <StateRow key={node.id} node={node} taxonomy={taxonomy} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  );
}
