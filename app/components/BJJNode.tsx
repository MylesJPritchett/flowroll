"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StateCondition } from "../concepts";

export default function BJJNode({ data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const positionName = (d.position_name as string) ?? "New State";
  const conditions = (d.conditions as StateCondition[]) ?? [];
  const roleA = (d.roleA as string) ?? "A";
  const roleB = (d.roleB as string) ?? "B";

  const roleLabel = (role: "A" | "B") => (role === "A" ? roleA : roleB);

  return (
    <div className="rounded-lg border border-zinc-300 bg-white px-4 py-3 shadow-sm dark:border-zinc-600 dark:bg-zinc-800">
      <Handle type="target" position={Position.Top} className="!bg-indigo-500" />
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {positionName}
      </span>
      {conditions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {conditions.map((c) => (
            <span
              key={`${c.groupId}-${c.role}`}
              className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-medium text-indigo-300"
            >
              <span className="opacity-60">{roleLabel(c.role)}</span> {c.value}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500" />
    </div>
  );
}
