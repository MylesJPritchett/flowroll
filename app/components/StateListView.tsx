"use client";

import { useState } from "react";
import type { GraphStateNode, GraphActionNode } from "@/lib/graph";
import type { Taxonomy } from "@/lib/concepts";
import { getRoleLabels } from "@/lib/concepts";
import StateEditor from "./StateEditor";
import ActionEditor from "./ActionEditor";

interface ListViewProps {
  stateNodes: GraphStateNode[];
  actionNodes: GraphActionNode[];
  taxonomy: Taxonomy;
  onAddState: () => void;
  onUpdateState: (node: GraphStateNode) => void;
  onDeleteState: (id: string) => void;
  onAddAction: () => void;
  onUpdateAction: (node: GraphActionNode) => void;
  onDeleteAction: (id: string) => void;
  onTaxonomyChange?: () => void;
}

// --- State Row ---

function StateRow({ node, taxonomy, onUpdate, onDelete, onTaxonomyChange }: { node: GraphStateNode; taxonomy: Taxonomy; onUpdate: (n: GraphStateNode) => void; onDelete: (id: string) => void; onTaxonomyChange?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const roles = getRoleLabels(node.position_name, taxonomy.positions);

  return (
    <div className="border-b border-zinc-800">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-zinc-500 text-xs select-none">{expanded ? "▼" : "▶"}</span>
        <span className="font-medium text-sm text-zinc-100 min-w-[160px]">
          {node.label || node.position_name}
          {node.label && <span className="text-[10px] text-zinc-500 ml-1">({node.position_name})</span>}
        </span>
        <div className="flex flex-wrap gap-1 flex-1">
          {node.conditions.map((c) => {
            const roleLabel = c.role === "A" ? roles.roleA : roles.roleB;
            return (
              <span
                key={`${c.groupId}-${c.role}`}
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                  c.role === "A" ? "bg-blue-500/20 text-blue-300" : "bg-amber-500/20 text-amber-300"
                }`}
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

      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-zinc-900/50">
          <StateEditor
            data={{
              state_id: node.state_id,
              label: node.label,
              position_name: node.position_name,
              conditions: node.conditions,
              giNogi: node.giNogi,
              description: node.description,
            }}
            taxonomy={taxonomy}
            onChange={(d) => onUpdate({ ...node, ...d })}
            onTaxonomyChange={onTaxonomyChange}
          />
        </div>
      )}
    </div>
  );
}

// --- Action Row ---

function ActionRow({ node, taxonomy, onUpdate, onDelete, onTaxonomyChange }: { node: GraphActionNode; taxonomy: Taxonomy; onUpdate: (n: GraphActionNode) => void; onDelete: (id: string) => void; onTaxonomyChange?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isA = node.actor === "A";

  return (
    <div className="border-b border-zinc-800">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-zinc-500 text-xs select-none">{expanded ? "▼" : "▶"}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          isA ? "bg-blue-500/20 text-blue-300" : "bg-amber-500/20 text-amber-300"
        }`}>
          {node.action_name || "Select Action"}
        </span>
        <span className="text-[10px] text-zinc-500">
          {isA ? "Role A" : "Role B"}
        </span>
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
          className="text-zinc-500 hover:text-red-400 text-xs transition-colors px-1"
        >
          &times;
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-zinc-900/50">
          <ActionEditor
            data={{
              action_id: node.action_id,
              action_name: node.action_name,
              actor: node.actor,
            }}
            taxonomy={taxonomy}
            roleLabels={{ roleA: "Role A", roleB: "Role B" }}
            onChange={(d) => onUpdate({ ...node, ...d })}
            onTaxonomyChange={onTaxonomyChange}
          />
        </div>
      )}
    </div>
  );
}

// --- Main List View ---

export default function ListView({ stateNodes, actionNodes, taxonomy, onAddState, onUpdateState, onDeleteState, onAddAction, onUpdateAction, onDeleteAction, onTaxonomyChange }: ListViewProps) {
  const [tab, setTab] = useState<"states" | "actions">("states");

  return (
    <div className="h-full overflow-y-auto bg-zinc-950">
      <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {(["states", "actions"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  tab === t ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {t === "states" ? `States (${stateNodes.length})` : `Actions (${actionNodes.length})`}
              </button>
            ))}
          </div>
          <button
            onClick={tab === "states" ? onAddState : onAddAction}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-indigo-500"
          >
            + Add {tab === "states" ? "State" : "Action"}
          </button>
        </div>
      </div>

      {tab === "states" && (
        <>
          {stateNodes.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-zinc-500">No states yet. Add one to get started.</p>
            </div>
          )}
          {stateNodes.map((node) => (
            <StateRow key={node.id} node={node} taxonomy={taxonomy} onUpdate={onUpdateState} onDelete={onDeleteState} onTaxonomyChange={onTaxonomyChange} />
          ))}
        </>
      )}

      {tab === "actions" && (
        <>
          {actionNodes.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-zinc-500">No actions yet. Add one to get started.</p>
            </div>
          )}
          {actionNodes.map((node) => (
            <ActionRow key={node.id} node={node} taxonomy={taxonomy} onUpdate={onUpdateAction} onDelete={onDeleteAction} onTaxonomyChange={onTaxonomyChange} />
          ))}
        </>
      )}
    </div>
  );
}
