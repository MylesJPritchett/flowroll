"use client";

import { useState, useEffect } from "react";
import type { Node } from "@xyflow/react";

interface NodeEditorProps {
  node: Node;
  onUpdate: (id: string, data: { label: string; description: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function NodeEditor({ node, onUpdate, onDelete, onClose }: NodeEditorProps) {
  const data = node.data as Record<string, string>;
  const [label, setLabel] = useState(data.label ?? "");
  const [description, setDescription] = useState(data.description ?? "");

  useEffect(() => {
    const d = node.data as Record<string, string>;
    setLabel(d.label ?? "");
    setDescription(d.description ?? "");
  }, [node.id, node.data]);

  return (
    <div className="absolute right-4 top-4 z-10 w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Edit Node
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
            Title
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              onUpdate(node.id, { label: e.target.value, description });
            }}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              onUpdate(node.id, { label, description: e.target.value });
            }}
            rows={4}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>

        <button
          onClick={() => onDelete(node.id)}
          className="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
        >
          Delete Node
        </button>
      </div>
    </div>
  );
}
