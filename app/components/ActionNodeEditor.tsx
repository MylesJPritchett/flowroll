"use client";

import type { Node } from "@xyflow/react";
import ActionEditor from "./ActionEditor";
import type { ActionData } from "./ActionEditor";
import type { Taxonomy } from "@/lib/concepts";

interface ActionNodeEditorProps {
  node: Node;
  taxonomy: Taxonomy;
  roleLabels: { roleA: string; roleB: string };
  position: { x: number; y: number };
  onUpdate: (id: string, data: { action_id: string; action_name: string; actor: "A" | "B" }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onTaxonomyChange?: () => void;
}

export default function ActionNodeEditor({ node, taxonomy, roleLabels, position, onUpdate, onDelete, onClose, onTaxonomyChange }: ActionNodeEditorProps) {
  const data = node.data as Record<string, unknown>;
  const actionData: ActionData = {
    action_id: (data.action_id as string) ?? "",
    action_name: (data.action_name as string) ?? "",
    actor: (data.actor as "A" | "B") ?? "A",
  };

  return (
    <div
      style={{ left: position.x, top: position.y }}
      className="absolute z-10 w-72 rounded-lg border border-zinc-700 bg-zinc-800 p-4 shadow-lg"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Edit Action</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">&times;</button>
      </div>

      <ActionEditor
        data={actionData}
        taxonomy={taxonomy}
        roleLabels={roleLabels}
        onChange={(d) => onUpdate(node.id, d)}
        onTaxonomyChange={onTaxonomyChange}
      />

      <button
        onClick={() => onDelete(node.id)}
        className="mt-3 w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
      >
        Delete Action
      </button>
    </div>
  );
}
