"use client";

import { useState, useEffect, useRef } from "react";
import type { Node } from "@xyflow/react";
import type { Player } from "./BJJNode";
import { BJJ_CONCEPTS } from "../concepts";

interface NodeEditorProps {
  node: Node;
  focusTitle?: boolean;
  position: { x: number; y: number };
  onUpdate: (id: string, data: { label: string; description: string; player: Player; tags: string[] }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function NodeEditor({ node, focusTitle, position, onUpdate, onDelete, onClose }: NodeEditorProps) {
  const data = node.data as Record<string, unknown>;
  const [label, setLabel] = useState((data.label as string) ?? "");
  const [description, setDescription] = useState((data.description as string) ?? "");
  const [player, setPlayer] = useState<Player>((data.player as Player) ?? "neutral");
  const [tags, setTags] = useState<string[]>((data.tags as string[]) ?? []);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = node.data as Record<string, unknown>;
    setLabel((d.label as string) ?? "");
    setDescription((d.description as string) ?? "");
    setPlayer((d.player as Player) ?? "neutral");
    setTags((d.tags as string[]) ?? []);
  }, [node.id, node.data]);

  useEffect(() => {
    if (focusTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [focusTitle, node.id]);

  return (
    <div
      style={{ left: position.x, top: position.y }}
      className="absolute z-10 w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
    >
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
            ref={titleRef}
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              onUpdate(node.id, { label: e.target.value, description, player, tags });
            }}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Concepts
          </label>
          <div className="flex flex-wrap gap-1">
            {BJJ_CONCEPTS.map((concept) => {
              const active = tags.includes(concept);
              return (
                <button
                  key={concept}
                  onClick={() => {
                    const newTags = active
                      ? tags.filter((t) => t !== concept)
                      : [...tags, concept];
                    setTags(newTags);
                    onUpdate(node.id, { label, description, player, tags: newTags });
                  }}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    active
                      ? "bg-indigo-500 text-white"
                      : "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40"
                  }`}
                >
                  {concept}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Player
          </label>
          <div className="flex gap-2">
            {([
              { value: "neutral", label: "None", color: "bg-zinc-600" },
              { value: "A", label: "Player A", color: "bg-blue-500" },
              { value: "B", label: "Player B", color: "bg-red-500" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setPlayer(opt.value);
                  onUpdate(node.id, { label, description, player: opt.value, tags });
                }}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium text-white transition-colors ${opt.color} ${
                  player === opt.value
                    ? "ring-2 ring-offset-1 ring-offset-zinc-800 ring-white"
                    : "opacity-50 hover:opacity-75"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              onUpdate(node.id, { label, description: e.target.value, player, tags });
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
