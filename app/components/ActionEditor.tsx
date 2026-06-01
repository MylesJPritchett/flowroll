"use client";

import { useState, useEffect, useRef } from "react";
import type { Taxonomy } from "@/lib/concepts";
import type { Action } from "../actions/taxonomy";
import { addAction } from "../actions/taxonomy";

export interface ActionData {
  action_id: string;
  action_name: string;
  actor: "A" | "B";
}

interface ActionEditorProps {
  data: ActionData;
  taxonomy: Taxonomy;
  roleLabels: { roleA: string; roleB: string };
  onChange: (data: ActionData) => void;
  onTaxonomyChange?: () => void;
}

export default function ActionEditor({ data, taxonomy, roleLabels, onChange, onTaxonomyChange }: ActionEditorProps) {
  const [actionId, setActionId] = useState(data.action_id);
  const [actionName, setActionName] = useState(data.action_name);
  const [actor, setActor] = useState<"A" | "B">(data.actor);
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActionId(data.action_id);
    setActionName(data.action_name);
    setActor(data.actor);
    setSearch("");
  }, [data]);

  useEffect(() => {
    if (!actionId && searchRef.current) {
      searchRef.current.focus();
    }
  }, [actionId]);

  const filteredActions = taxonomy.actions.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectAction = (action: Action) => {
    setActionId(action.id);
    setActionName(action.name);
    setShowSuggestions(false);
    setSearch("");
    onChange({ action_id: action.id, action_name: action.name, actor });
  };

  return (
    <div className="space-y-3">
      {/* Action picker */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Action</label>
        {actionName && (
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
              {actionName}
            </span>
            <button
              onClick={() => {
                setActionId("");
                setActionName("");
                onChange({ action_id: "", action_name: "", actor });
              }}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              change
            </button>
          </div>
        )}
        <input
          ref={searchRef}
          type="text"
          value={search}
          placeholder={actionName ? "Search to change..." : "Search actions..."}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowSuggestions(true);
          }}
          className="w-full rounded-md border border-zinc-600 bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        {showSuggestions && (
          <div className="mt-1 flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {filteredActions.map((a) => (
              <button
                key={a.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectAction(a)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  a.id === actionId
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-600/30 text-zinc-300 hover:bg-zinc-600/50"
                }`}
              >
                {a.name}
                {a.gi_nogi && <span className="ml-1 opacity-50">({a.gi_nogi})</span>}
              </button>
            ))}
            {search.trim() && !taxonomy.actions.some((a) => a.name.toLowerCase() === search.toLowerCase()) && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => {
                  const created = await addAction(search.trim(), "", "");
                  if (created) {
                    selectAction(created);
                    onTaxonomyChange?.();
                  }
                }}
                className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                + Create &quot;{search.trim()}&quot;
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actor */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Actor</label>
        <div className="flex gap-2">
          {(["A", "B"] as const).map((role) => {
            const roleLabel = role === "A" ? roleLabels.roleA : roleLabels.roleB;
            const isA = role === "A";
            return (
              <button
                key={role}
                onClick={() => {
                  setActor(role);
                  onChange({ action_id: actionId, action_name: actionName, actor: role });
                }}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium text-white transition-colors ${
                  isA ? "bg-blue-600" : "bg-amber-600"
                } ${
                  actor === role
                    ? "ring-2 ring-offset-1 ring-offset-zinc-800 ring-white"
                    : "opacity-50 hover:opacity-75"
                }`}
              >
                {roleLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
