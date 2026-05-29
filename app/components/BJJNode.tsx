"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export default function BJJNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border border-zinc-300 bg-white px-4 py-3 shadow-sm dark:border-zinc-600 dark:bg-zinc-800">
      <Handle type="target" position={Position.Top} className="!bg-indigo-500" />
      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {(data as Record<string, unknown>).label as string}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500" />
    </div>
  );
}
