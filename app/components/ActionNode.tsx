"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export default function ActionNode({ data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const actionName = (d.action_name as string) || "Select Action";
  const actor = (d.actor as "A" | "B") ?? "A";

  const isA = actor === "A";
  const warnings = (d.warnings as string[]) ?? [];

  return (
    <div
      className={`rounded-full border-2 px-4 py-2 shadow-sm ${
        warnings.length > 0
          ? "border-red-400 bg-red-950 text-red-200"
          : isA
            ? "border-blue-400 bg-blue-950 text-blue-200"
            : "border-amber-400 bg-amber-950 text-amber-200"
      }`}
    >
      <Handle type="target" position={Position.Top} className={isA ? "!bg-blue-400" : "!bg-amber-400"} />
      <span className="text-xs font-semibold whitespace-nowrap flex items-center gap-1">
        {actionName}
        {warnings.length > 0 && (
          <span className="text-red-300 text-[10px]" title={warnings.join("\n")}>&#9888;</span>
        )}
      </span>
      <Handle type="source" position={Position.Bottom} className={isA ? "!bg-blue-400" : "!bg-amber-400"} />
    </div>
  );
}
