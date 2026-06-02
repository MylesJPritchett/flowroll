"use client";

import type { Node } from "@xyflow/react";
import StateEditor from "./StateEditor";
import type { StateData } from "./StateEditor";
import type { StateCondition, Taxonomy } from "@/lib/concepts";
import type { GiNogi, MediaItem } from "@/lib/graph";

interface NodeEditorProps {
  node: Node;
  taxonomy: Taxonomy;
  focusTitle?: boolean;
  position: { x: number; y: number };
  onUpdate: (id: string, data: { state_id: string; label: string; position_name: string; conditions: StateCondition[]; giNogi: GiNogi; description: string; media: MediaItem[] }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onTaxonomyChange?: () => void;
}

export default function NodeEditor({ node, taxonomy, focusTitle, position, onUpdate, onDelete, onClose, onTaxonomyChange }: NodeEditorProps) {
  const data = node.data as Record<string, unknown>;
  const stateData: StateData = {
    state_id: (data.state_id as string) ?? "",
    label: (data.label as string) ?? "",
    position_name: (data.position_name as string) ?? "New State",
    conditions: (data.conditions as StateCondition[]) ?? [],
    giNogi: (data.giNogi as GiNogi) ?? "",
    description: (data.description as string) ?? "",
    media: (data.media as MediaItem[]) ?? [],
  };

  return (
    <div
      style={{ left: position.x, top: position.y }}
      className="absolute z-10 w-80 rounded-lg border border-zinc-700 bg-zinc-800 p-4 shadow-lg max-h-[85vh] overflow-y-auto"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Edit State</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">&times;</button>
      </div>

      <StateEditor
        data={stateData}
        taxonomy={taxonomy}
        focusTitle={focusTitle}
        onChange={(d) => onUpdate(node.id, d)}
        onTaxonomyChange={onTaxonomyChange}
      />

      <button
        onClick={() => onDelete(node.id)}
        className="mt-3 w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
      >
        Delete State
      </button>
    </div>
  );
}
