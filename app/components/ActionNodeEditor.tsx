"use client";

import { useState, useEffect, useRef } from "react";
import type { Node } from "@xyflow/react";
import type { Taxonomy } from "../concepts";
import type { Action } from "../actions/taxonomy";

interface ActionNodeEditorProps {
  node: Node;
  taxonomy: Taxonomy;
  roleLabels: { roleA: string; roleB: string };
  position: { x: number; y: number };
  onUpdate: (id: string, data: { action_id: string; action_name: string; actor: "A" | "B" }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function ActionNodeEditor({ node, taxonomy, roleLabels, position, onUpdate, onDelete, onClose }: ActionNodeEditorProps) {
  const data = node.data as Record<string, unknown>;
  const [actionId, setActionId] = useState((data.action_id as string) ?? "");
  const [actionName, setActionName] = useState((data.action_name as string) ?? "");
  const [actor, setActor] = useState<"A" | "B">((data.actor as "A" | "B") ?? "A");
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = node.data as Record<string, unknown>;
    setActionId((d.action_id as string) ?? "");
    setActionName((d.action_name as string) ?? "");
    setActor((d.actor as "A" | "B") ?? "A");
    setSearch("");
  }, [node.id, node.data]);

  useEffect(() => {
    if (!actionId && searchRef.current) {
      searchRef.current.focus();
    }
  }, [node.id]);

  const filteredActions = taxonomy.actions.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectAction = (action: Action) => {
    setActionId(action.id);
    setActionName(action.name);
    setShowSuggestions(false);
    setSearch("");
    onUpdate(node.id, { action_id: action.id, action_name: action.name, actor });
  };

  return (
    <div
      style={{ left: position.x, top: position.y }}
      className="absolute z-10 w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Edit Action
        </h3>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          &times;
        </button>
      </div>

      <div className="space-y-3">
        {/* Action picker */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Action
          </label>
          {actionName && (
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
                {actionName}
              </span>
              <button
                onClick={() => {
                  setActionId("");
                  setActionName("");
                  onUpdate(node.id, { action_id: "", action_name: "", actor });
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
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
          {showSuggestions && filteredActions.length > 0 && (
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
            </div>
          )}
        </div>

        {/* Actor */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Actor
          </label>
          <div className="flex gap-2">
            {(["A", "B"] as const).map((role) => {
              const roleLabel = role === "A" ? roleLabels.roleA : roleLabels.roleB;
              const isA = role === "A";
              return (
                <button
                  key={role}
                  onClick={() => {
                    setActor(role);
                    onUpdate(node.id, { action_id: actionId, action_name: actionName, actor: role });
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

        <button
          onClick={() => onDelete(node.id)}
          className="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
        >
          Delete Action
        </button>
      </div>
    </div>
  );
}
