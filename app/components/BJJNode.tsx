"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

const playerStyles = {
  A: {
    border: "border-blue-400 dark:border-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950",
    handle: "!bg-blue-500",
    badge: "bg-blue-500",
  },
  B: {
    border: "border-red-400 dark:border-red-500",
    bg: "bg-red-50 dark:bg-red-950",
    handle: "!bg-red-500",
    badge: "bg-red-500",
  },
  neutral: {
    border: "border-zinc-300 dark:border-zinc-600",
    bg: "bg-white dark:bg-zinc-800",
    handle: "!bg-indigo-500",
    badge: "",
  },
} as const;

export type Player = "A" | "B" | "neutral";

export default function BJJNode({ data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const player = (d.player as Player) ?? "neutral";
  const style = playerStyles[player];
  const label = d.label as string;
  const tags = (d.tags as string[] | undefined) ?? [];

  return (
    <div className={`rounded-lg border px-4 py-3 shadow-sm ${style.border} ${style.bg}`}>
      <Handle type="target" position={Position.Top} className={style.handle} />
      <div className="flex items-center gap-2">
        {player !== "neutral" && (
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${style.badge}`}>
            {player}
          </span>
        )}
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </span>
      </div>
      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-medium text-indigo-300"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={style.handle} />
    </div>
  );
}
