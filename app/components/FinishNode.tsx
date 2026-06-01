"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export default function FinishNode({ data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const label = (d.label as string) || "Submitted";

  return (
    <div className="rounded-lg border-2 border-red-500 bg-red-950 px-4 py-2.5 shadow-sm">
      <Handle type="target" position={Position.Left} id="target" className="!bg-red-400" />
      <span className="text-xs font-bold text-red-200 whitespace-nowrap">{label}</span>
    </div>
  );
}
