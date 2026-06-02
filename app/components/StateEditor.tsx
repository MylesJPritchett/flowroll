"use client";

import { useState, useEffect, useRef } from "react";
import { getRoleLabels, getFilteredOptions, getAllowedOptionIds } from "@/lib/concepts";
import type { StateCondition, Taxonomy } from "@/lib/concepts";
import type { GiNogi, MediaItem } from "@/lib/graph";
import { addPosition, addState, addConditionGroup, addConditionOption } from "../actions/taxonomy";
import MediaEditor from "./MediaEditor";

export interface StateData {
  state_id: string;
  label: string;
  position_name: string;
  conditions: StateCondition[];
  giNogi: GiNogi;
  description: string;
  media: MediaItem[];
}

interface StateEditorProps {
  data: StateData;
  taxonomy: Taxonomy;
  focusTitle?: boolean;
  onChange: (data: StateData) => void;
  onTaxonomyChange?: () => void;
}

export default function StateEditor({ data, taxonomy, focusTitle, onChange, onTaxonomyChange }: StateEditorProps) {
  const [stateId, setStateId] = useState(data.state_id);
  const [label, setLabel] = useState(data.label);
  const [positionName, setPositionName] = useState(data.position_name);
  const [conditions, setConditions] = useState<StateCondition[]>(data.conditions);
  const [giNogi, setGiNogi] = useState<GiNogi>(data.giNogi);
  const [description, setDescription] = useState(data.description);
  const [media, setMedia] = useState<MediaItem[]>(data.media);
  const [showPositionSuggestions, setShowPositionSuggestions] = useState(false);
  const [addingConditionRole, setAddingConditionRole] = useState<"A" | "B" | null>(null);
  const [conditionQuery, setConditionQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [creatingValue, setCreatingValue] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const conditionInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(data.position_name);

  // Sync from parent when data identity changes
  useEffect(() => {
    setStateId(data.state_id);
    setLabel(data.label);
    setPositionName(data.position_name);
    setConditions(data.conditions);
    setGiNogi(data.giNogi);
    setDescription(data.description);
    setMedia(data.media);
    idRef.current = data.position_name;
  }, [data]);

  useEffect(() => {
    if (focusTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [focusTitle]);

  const emit = (patch: Partial<StateData>) => {
    const next = {
      state_id: patch.state_id ?? stateId,
      label: patch.label ?? label,
      position_name: patch.position_name ?? positionName,
      conditions: patch.conditions ?? conditions,
      giNogi: patch.giNogi ?? giNogi,
      description: patch.description ?? description,
      media: patch.media ?? media,
    };
    onChange(next);
  };

  // States for the current position
  const pos = taxonomy.positions.find((p) => p.name === positionName);
  const positionStates = pos ? taxonomy.states.filter((s) => s.position_id === pos.id) : [];

  const roles = getRoleLabels(positionName, taxonomy.positions);

  const toggleCondition = (groupId: string, value: string, role: "A" | "B") => {
    const existing = conditions.find((c) => c.groupId === groupId && c.role === role);
    let next: StateCondition[];
    if (existing?.value === value) {
      next = conditions.filter((c) => !(c.groupId === groupId && c.role === role));
    } else {
      next = [...conditions.filter((c) => !(c.groupId === groupId && c.role === role)), { groupId, value, role }];
    }
    setConditions(next);
    emit({ conditions: next });
  };

  const getActiveValue = (groupId: string, role: "A" | "B") => {
    return conditions.find((c) => c.groupId === groupId && c.role === role)?.value;
  };

  const isDefault = positionName === "New State";
  const filteredPositions = isDefault
    ? taxonomy.positions
    : taxonomy.positions.filter((p) => p.name.toLowerCase().includes(positionName.toLowerCase()));

  return (
    <div className="space-y-3">
      {/* Label (display name override) */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Name</label>
        <input
          type="text"
          value={label}
          placeholder={positionName}
          onChange={(e) => {
            setLabel(e.target.value);
            emit({ label: e.target.value });
          }}
          className="w-full rounded-md border border-zinc-600 bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <div className="mt-0.5 text-[10px] text-zinc-600">Display name (e.g. &quot;High Mount&quot;). Leave empty to use position name.</div>
      </div>

      {/* Position */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Position</label>
        <input
          ref={titleRef}
          type="text"
          value={positionName}
          onFocus={() => setShowPositionSuggestions(true)}
          onBlur={() => setTimeout(() => setShowPositionSuggestions(false), 200)}
          onChange={(e) => {
            setPositionName(e.target.value);
            setShowPositionSuggestions(true);
            emit({ position_name: e.target.value });
          }}
          className="w-full rounded-md border border-zinc-600 bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        {showPositionSuggestions && (isDefault || !taxonomy.positions.some((p) => p.name === positionName)) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {filteredPositions.slice(0, 12).map((p) => (
              <button
                key={p.name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setPositionName(p.name);
                  setShowPositionSuggestions(false);
                  emit({ position_name: p.name });
                }}
                className="rounded-full bg-zinc-600/30 px-2 py-0.5 text-[10px] font-medium text-zinc-300 hover:bg-zinc-600/50 transition-colors"
              >
                {p.name}
              </button>
            ))}
            {!isDefault && positionName.trim() && !taxonomy.positions.some((p) => p.name.toLowerCase() === positionName.toLowerCase()) && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => {
                  const created = await addPosition(positionName.trim(), "A", "B");
                  if (created) {
                    setShowPositionSuggestions(false);
                    emit({ position_name: created.name });
                    onTaxonomyChange?.();
                  }
                }}
                className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                + Create &quot;{positionName.trim()}&quot;
              </button>
            )}
          </div>
        )}
        <div className="mt-1 text-[10px] text-zinc-500">{roles.roleA} / {roles.roleB}</div>
        {positionStates.length > 0 && (
          <div className="mt-1.5">
            <div className="text-[10px] text-zinc-500 mb-0.5">Load state preset:</div>
            <div className="flex flex-wrap gap-1">
              {positionStates.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setStateId(s.id);
                    setLabel(s.name);
                    setConditions(s.conditions);
                    setGiNogi(s.gi_nogi);
                    setDescription(s.description);
                    emit({ state_id: s.id, label: s.name, conditions: s.conditions, giNogi: s.gi_nogi, description: s.description });
                  }}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    stateId === s.id
                      ? "bg-green-600 text-white"
                      : "bg-zinc-600/30 text-zinc-300 hover:bg-zinc-600/50"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Gi / No-Gi */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Gi / No-Gi</label>
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
                let nextConditions = conditions;
                if (opt.value === "nogi") {
                  const giOnlyValues = new Set(
                    taxonomy.conditionGroups.flatMap((g) => g.options.filter((o) => o.gi_only).map((o) => o.label)),
                  );
                  nextConditions = conditions.filter((c) => !giOnlyValues.has(c.value));
                  setConditions(nextConditions);
                }
                emit({ giNogi: opt.value, conditions: nextConditions });
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
        <label className="mb-2 block text-xs font-medium text-zinc-400">Conditions</label>
        <div className="space-y-2">
          {(["A", "B"] as const).map((role) => {
            const roleLabel = role === "A" ? roles.roleA : roles.roleB;
            const activeConditions = conditions.filter((c) => c.role === role);
            const allowed = getAllowedOptionIds(positionName, role, taxonomy);
            const isAdding = addingConditionRole === role;

            // Build autocomplete suggestions from taxonomy
            const suggestions = taxonomy.conditionGroups.flatMap((group) => {
              const opts = getFilteredOptions(group, giNogi, allowed);
              return opts
                .filter((opt) => !activeConditions.some((c) => c.groupId === group.id && c.value === opt.label))
                .map((opt) => ({ groupId: group.id, groupName: group.name, value: opt.label }));
            });

            const query = conditionQuery.toLowerCase();
            const filtered = query
              ? suggestions.filter(
                  (s) => s.value.toLowerCase().includes(query) || s.groupName.toLowerCase().includes(query),
                )
              : suggestions;

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
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-indigo-500 text-white hover:bg-red-500 transition-colors"
                          title={`${group?.name}: ${c.value} (click to remove)`}
                        >
                          {c.value}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      if (isAdding) {
                        setAddingConditionRole(null);
                        setConditionQuery("");
                      } else {
                        setAddingConditionRole(role);
                        setConditionQuery("");
                        setHighlightedIndex(0);
                        setTimeout(() => conditionInputRef.current?.focus(), 0);
                      }
                    }}
                    className="rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-zinc-700 text-zinc-300 hover:bg-indigo-500 hover:text-white transition-colors"
                    title="Add condition"
                  >
                    {isAdding ? "×" : "+"}
                  </button>
                </div>
                {isAdding && (
                  <div className="ml-1 mb-2 relative">
                    {creatingValue === null ? (
                      <>
                        <input
                          ref={conditionInputRef}
                          type="text"
                          value={conditionQuery}
                          placeholder="Type to search or create conditions…"
                          onChange={(e) => {
                            setConditionQuery(e.target.value);
                            setHighlightedIndex(0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              // +1 for the create option at the bottom
                              const max = query ? filtered.length : filtered.length - 1;
                              setHighlightedIndex((i) => Math.min(i + 1, max));
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setHighlightedIndex((i) => Math.max(i - 1, 0));
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              if (query && highlightedIndex === filtered.length) {
                                // Create option selected
                                setCreatingValue(conditionQuery.trim());
                                setNewGroupName("");
                              } else if (filtered.length > 0) {
                                const pick = filtered[highlightedIndex];
                                if (pick) {
                                  toggleCondition(pick.groupId, pick.value, role);
                                  setConditionQuery("");
                                  setHighlightedIndex(0);
                                }
                              }
                            } else if (e.key === "Escape") {
                              setAddingConditionRole(null);
                              setConditionQuery("");
                            }
                          }}
                          className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        <div className="mt-1 max-h-44 overflow-y-auto rounded border border-zinc-700 bg-zinc-900">
                          {filtered.map((s, i) => (
                            <button
                              key={`${s.groupId}-${s.value}`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                toggleCondition(s.groupId, s.value, role);
                                setConditionQuery("");
                                setHighlightedIndex(0);
                                conditionInputRef.current?.focus();
                              }}
                              className={`w-full text-left px-2 py-1 text-[10px] flex items-center gap-1.5 transition-colors ${
                                i === highlightedIndex
                                  ? "bg-indigo-600 text-white"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              <span className="text-zinc-500 shrink-0">{s.groupName}</span>
                              <span className="font-medium">{s.value}</span>
                            </button>
                          ))}
                          {query && (
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setCreatingValue(conditionQuery.trim());
                                setNewGroupName("");
                              }}
                              className={`w-full text-left px-2 py-1 text-[10px] flex items-center gap-1.5 transition-colors border-t border-zinc-800 ${
                                highlightedIndex === filtered.length
                                  ? "bg-green-700 text-white"
                                  : "text-green-400 hover:bg-zinc-800"
                              }`}
                            >
                              <span className="font-medium">+ Create &quot;{conditionQuery.trim()}&quot;</span>
                            </button>
                          )}
                          {!query && filtered.length === 0 && (
                            <div className="px-2 py-1.5 text-[10px] text-zinc-500">
                              Type to search or create a condition
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="rounded border border-zinc-700 bg-zinc-900 p-2 space-y-2">
                        <div className="text-[10px] text-zinc-400">
                          Create <span className="font-semibold text-zinc-200">&quot;{creatingValue}&quot;</span> in group:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {taxonomy.conditionGroups.map((g) => (
                            <button
                              key={g.id}
                              disabled={isCreating}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={async () => {
                                setIsCreating(true);
                                const created = await addConditionOption(g.id, creatingValue, false);
                                setIsCreating(false);
                                if (created) {
                                  onTaxonomyChange?.();
                                  toggleCondition(g.id, creatingValue, role);
                                  setCreatingValue(null);
                                  setConditionQuery("");
                                  setHighlightedIndex(0);
                                }
                              }}
                              className="rounded-full px-2 py-0.5 text-[9px] font-medium bg-zinc-700 text-zinc-300 hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-50"
                            >
                              {g.name}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            autoFocus
                            value={newGroupName}
                            placeholder="Or new group name…"
                            onChange={(e) => setNewGroupName(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" && newGroupName.trim()) {
                                e.preventDefault();
                                setIsCreating(true);
                                const group = await addConditionGroup(newGroupName.trim());
                                if (group) {
                                  const created = await addConditionOption(group.id, creatingValue, false);
                                  setIsCreating(false);
                                  if (created) {
                                    onTaxonomyChange?.();
                                    toggleCondition(group.id, creatingValue, role);
                                    setCreatingValue(null);
                                    setConditionQuery("");
                                    setHighlightedIndex(0);
                                  }
                                } else {
                                  setIsCreating(false);
                                }
                              } else if (e.key === "Escape") {
                                setCreatingValue(null);
                              }
                            }}
                            disabled={isCreating}
                            className="flex-1 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                          />
                          {newGroupName.trim() && (
                            <button
                              disabled={isCreating}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={async () => {
                                setIsCreating(true);
                                const group = await addConditionGroup(newGroupName.trim());
                                if (group) {
                                  const created = await addConditionOption(group.id, creatingValue, false);
                                  setIsCreating(false);
                                  if (created) {
                                    onTaxonomyChange?.();
                                    toggleCondition(group.id, creatingValue, role);
                                    setCreatingValue(null);
                                    setConditionQuery("");
                                    setHighlightedIndex(0);
                                  }
                                } else {
                                  setIsCreating(false);
                                }
                              }}
                              className="rounded-md bg-green-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-green-500 transition-colors disabled:opacity-50"
                            >
                              Create
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => setCreatingValue(null)}
                          className="text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save as State */}
      {pos && label.trim() && !stateId && (
        <button
          onClick={async () => {
            const created = await addState(pos.id, label.trim(), description, conditions, giNogi);
            if (created) {
              setStateId(created.id);
              emit({ state_id: created.id });
              onTaxonomyChange?.();
            }
          }}
          className="w-full rounded-md border border-green-600/50 bg-green-950/30 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-950/50"
        >
          Save &quot;{label.trim()}&quot; as reusable state
        </button>
      )}

      {/* Notes */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Notes</label>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            emit({ description: e.target.value });
          }}
          rows={3}
          className="w-full rounded-md border border-zinc-600 bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Media */}
      <MediaEditor
        media={media}
        onChange={(next) => {
          setMedia(next);
          emit({ media: next });
        }}
      />
    </div>
  );
}
