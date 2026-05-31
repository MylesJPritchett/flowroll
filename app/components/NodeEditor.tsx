"use client";

import { useState, useEffect, useRef } from "react";
import type { Node } from "@xyflow/react";
import { getRoleLabels, getFilteredOptions, getAllowedOptionIds } from "../concepts";
import type { StateCondition } from "../concepts";
import type { GiNogi } from "../actions/graph";
import type { Taxonomy } from "../concepts";

interface NodeEditorProps {
  node: Node;
  taxonomy: Taxonomy;
  focusTitle?: boolean;
  position: { x: number; y: number };
  onUpdate: (id: string, data: { position_name: string; conditions: StateCondition[]; giNogi: GiNogi; description: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function NodeEditor({ node, taxonomy, focusTitle, position, onUpdate, onDelete, onClose }: NodeEditorProps) {
  const data = node.data as Record<string, unknown>;
  const [positionName, setPositionName] = useState((data.position_name as string) ?? "New State");
  const [conditions, setConditions] = useState<StateCondition[]>((data.conditions as StateCondition[]) ?? []);
  const [giNogi, setGiNogi] = useState<GiNogi>((data.giNogi as GiNogi) ?? "");
  const [description, setDescription] = useState((data.description as string) ?? "");
  const [showPositionSuggestions, setShowPositionSuggestions] = useState(false);
  const [expandedRole, setExpandedRole] = useState<"A" | "B" | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = node.data as Record<string, unknown>;
    setPositionName((d.position_name as string) ?? "New State");
    setConditions((d.conditions as StateCondition[]) ?? []);
    setGiNogi((d.giNogi as GiNogi) ?? "");
    setDescription((d.description as string) ?? "");
  }, [node.id, node.data]);

  useEffect(() => {
    if (focusTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [focusTitle, node.id]);

  const roles = getRoleLabels(positionName, taxonomy.positions);

  const toggleCondition = (groupId: string, value: string, role: "A" | "B") => {
    const existing = conditions.find((c) => c.groupId === groupId && c.role === role);
    let next: StateCondition[];
    if (existing?.value === value) {
      // Deselect
      next = conditions.filter((c) => !(c.groupId === groupId && c.role === role));
    } else {
      // Replace within group+role (exclusive)
      next = [...conditions.filter((c) => !(c.groupId === groupId && c.role === role)), { groupId, value, role }];
    }
    setConditions(next);
    onUpdate(node.id, { position_name: positionName, conditions: next, giNogi, description });
  };

  const getActiveValue = (groupId: string, role: "A" | "B") => {
    return conditions.find((c) => c.groupId === groupId && c.role === role)?.value;
  };

  const isDefault = positionName === "New State";
  const filteredPositions = isDefault
    ? taxonomy.positions
    : taxonomy.positions.filter((p) => p.name.toLowerCase().includes(positionName.toLowerCase()));

  return (
    <div
      style={{ left: position.x, top: position.y }}
      className="absolute z-10 w-80 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 max-h-[85vh] overflow-y-auto"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Edit State
        </h3>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          &times;
        </button>
      </div>

      <div className="space-y-3">
        {/* Position */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Position
          </label>
          <input
            ref={titleRef}
            type="text"
            value={positionName}
            onFocus={() => setShowPositionSuggestions(true)}
            onBlur={() => setTimeout(() => setShowPositionSuggestions(false), 200)}
            onChange={(e) => {
              setPositionName(e.target.value);
              setShowPositionSuggestions(true);
              onUpdate(node.id, { position_name: e.target.value, conditions, giNogi, description });
            }}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
          {showPositionSuggestions && filteredPositions.length > 0 && (isDefault || positionName !== filteredPositions[0]?.name) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {filteredPositions.slice(0, 12).map((p) => (
                <button
                  key={p.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setPositionName(p.name);
                    setShowPositionSuggestions(false);
                    onUpdate(node.id, { position_name: p.name, conditions, giNogi, description });
                  }}
                  className="rounded-full bg-zinc-600/30 px-2 py-0.5 text-[10px] font-medium text-zinc-300 hover:bg-zinc-600/50 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 text-[10px] text-zinc-500">
            {roles.roleA} / {roles.roleB}
          </div>
        </div>

        {/* Gi / No-Gi */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Gi / No-Gi
          </label>
          <div className="flex gap-2">
            {([
              { value: "" as GiNogi, label: "Both" },
              { value: "gi" as GiNogi, label: "Gi" },
              { value: "nogi" as GiNogi, label: "No-Gi" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setGiNogi(opt.value);
                  // Strip gi-only conditions when switching to nogi
                  let nextConditions = conditions;
                  if (opt.value === "nogi") {
                    const giOnlyValues = new Set(
                      taxonomy.conditionGroups.flatMap((g) => g.options.filter((o) => o.gi_only).map((o) => o.label)),
                    );
                    nextConditions = conditions.filter((c) => !giOnlyValues.has(c.value));
                    setConditions(nextConditions);
                  }
                  onUpdate(node.id, { position_name: positionName, conditions: nextConditions, giNogi: opt.value, description });
                }}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium text-white transition-colors bg-zinc-600 ${
                  giNogi === opt.value
                    ? "ring-2 ring-offset-1 ring-offset-zinc-800 ring-white"
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
          <label className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Conditions
          </label>
          <div className="space-y-2">
            {(["A", "B"] as const).map((role) => {
              const roleLabel = role === "A" ? roles.roleA : roles.roleB;
              const activeConditions = conditions.filter((c) => c.role === role);
              const allowed = getAllowedOptionIds(positionName, role, taxonomy);
              const isExpanded = expandedRole === role;

              return (
                <div key={role}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-zinc-300">{roleLabel}</span>
                    <div className="flex flex-wrap gap-0.5 flex-1">
                      {activeConditions.map((c) => {
                        const group = taxonomy.conditionGroups.find((g) => g.id === c.groupId);
                        return (
                          <button
                            key={`${c.groupId}-${c.role}`}
                            onClick={() => toggleCondition(c.groupId, c.value, role)}
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-indigo-500 text-white hover:bg-red-500 transition-colors`}
                            title={`${group?.name}: ${c.value} (click to remove)`}
                          >
                            {c.value}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setExpandedRole(isExpanded ? null : role)}
                      className="rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-zinc-700 text-zinc-300 hover:bg-indigo-500 hover:text-white transition-colors"
                      title="Add condition"
                    >
                      {isExpanded ? "-" : "+"}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="ml-1 mb-2 space-y-1.5 rounded border border-zinc-700 bg-zinc-900 p-2">
                      {taxonomy.conditionGroups.map((group) => {
                        const opts = getFilteredOptions(group, giNogi, allowed);
                        if (opts.length === 0) return null;
                        const activeValue = getActiveValue(group.id, role);
                        return (
                          <div key={group.id} className="flex items-center gap-1">
                            <span className="w-20 shrink-0 text-[9px] font-medium text-zinc-500">
                              {group.name}
                            </span>
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
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Notes
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              onUpdate(node.id, { position_name: positionName, conditions, giNogi, description: e.target.value });
            }}
            rows={3}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>

        <button
          onClick={() => onDelete(node.id)}
          className="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
        >
          Delete State
        </button>
      </div>
    </div>
  );
}
