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

  const warnings = (d.warnings as string[]) ?? [];

  return (
    <div className={`rounded-lg border px-4 py-3 shadow-sm ${
      warnings.length > 0
        ? "border-amber-500/60 bg-amber-950/20 dark:border-amber-500/60 dark:bg-amber-950/20"
        : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-indigo-500" />
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {positionName}
        </span>
        {warnings.length > 0 && (
          <span className="text-amber-400 text-[10px]" title={warnings.join("\n")}>&#9888;</span>
        )}
      </div>
      {conditions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {conditions.map((c) => (
            <span
              key={`${c.groupId}-${c.role}`}
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                c.role === "A"
                  ? "bg-blue-500/20 text-blue-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
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
