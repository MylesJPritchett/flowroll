"use client";

import { useState, useEffect } from "react";
import type { Edge } from "@xyflow/react";

const RELATIONSHIP_TYPES = [
  "leads to",
  "responds by",
  "threatens",
  "prevents",
] as const;

interface EdgeEditorProps {
  edge: Edge;
  position: { x: number; y: number };
  onUpdate: (id: string, relationship: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function EdgeEditor({ edge, position, onUpdate, onDelete, onClose }: EdgeEditorProps) {
  const [relationship, setRelationship] = useState((edge.label as string) ?? "leads to");

  useEffect(() => {
    setRelationship((edge.label as string) ?? "leads to");
  }, [edge.id, edge.label]);

  return (
    <div
      style={{ left: position.x, top: position.y }}
      className="absolute z-10 w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Edit Edge
        </h3>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          &times;
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Relationship
          </label>
          <select
            value={relationship}
            onChange={(e) => {
              setRelationship(e.target.value);
              onUpdate(edge.id, e.target.value);
            }}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          >
            {RELATIONSHIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => onDelete(edge.id)}
          className="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
        >
          Delete Edge
        </button>
      </div>
    </div>
  );
}
