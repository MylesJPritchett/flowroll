"use client";

import { useState, useEffect, useRef } from "react";
import type { Edge } from "@xyflow/react";
import type { GiNogi } from "../actions/graph";

interface EdgeEditorProps {
  edge: Edge;
  roleLabels: { roleA: string; roleB: string };
  position: { x: number; y: number };
  onUpdate: (id: string, data: { label: string; actor: "A" | "B"; giNogi: GiNogi; description: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function EdgeEditor({ edge, roleLabels, position, onUpdate, onDelete, onClose }: EdgeEditorProps) {
  const edgeData = edge.data as Record<string, unknown> | undefined;
  const [label, setLabel] = useState((edge.label as string) ?? "");
  const [actor, setActor] = useState<"A" | "B">((edgeData?.actor as "A" | "B") ?? "A");
  const [giNogi, setGiNogi] = useState<GiNogi>((edgeData?.giNogi as GiNogi) ?? "");
  const [description, setDescription] = useState((edgeData?.description as string) ?? "");
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = edge.data as Record<string, unknown> | undefined;
    setLabel((edge.label as string) ?? "");
    setActor((d?.actor as "A" | "B") ?? "A");
    setGiNogi((d?.giNogi as GiNogi) ?? "");
    setDescription((d?.description as string) ?? "");
  }, [edge.id, edge.label, edge.data]);

  useEffect(() => {
    if (labelRef.current && !label) {
      labelRef.current.focus();
    }
  }, [edge.id]);

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
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Action Name
          </label>
          <input
            ref={labelRef}
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              onUpdate(edge.id, { label: e.target.value, actor, giNogi, description });
            }}
            placeholder="e.g., Underhook Sweep"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Actor
          </label>
          <div className="flex gap-2">
            {(["A", "B"] as const).map((role) => {
              const roleLabel = role === "A" ? roleLabels.roleA : roleLabels.roleB;
              return (
                <button
                  key={role}
                  onClick={() => {
                    setActor(role);
                    onUpdate(edge.id, { label, actor: role, giNogi, description });
                  }}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium text-white transition-colors bg-indigo-600 ${
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

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Gi / No-Gi
          </label>
          <div className="flex gap-2">
            {([
              { value: "" as GiNogi, label: "Both" },
              { value: "gi" as GiNogi, label: "Gi Only" },
              { value: "nogi" as GiNogi, label: "No-Gi Only" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setGiNogi(opt.value);
                  onUpdate(edge.id, { label, actor, giNogi: opt.value, description });
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

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Notes
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              onUpdate(edge.id, { label, actor, giNogi, description: e.target.value });
            }}
            rows={2}
            placeholder="Execution details..."
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>

        <button
          onClick={() => onDelete(edge.id)}
          className="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
        >
          Delete Action
        </button>
      </div>
    </div>
  );
}
