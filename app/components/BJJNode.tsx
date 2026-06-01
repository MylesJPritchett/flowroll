"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StateCondition } from "@/lib/concepts";

export default function BJJNode({ data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const label = (d.label as string) ?? "";
  const positionName = (d.position_name as string) ?? "New State";
  const conditions = (d.conditions as StateCondition[]) ?? [];
  const roleA = (d.roleA as string) ?? "A";
  const roleB = (d.roleB as string) ?? "B";

  const warnings = (d.warnings as string[]) ?? [];
  const displayName = label || positionName;

  const conditionsA = conditions.filter((c) => c.role === "A");
  const conditionsB = conditions.filter((c) => c.role === "B");

  return (
    <div
      className={`rounded-lg border shadow-sm min-w-[140px] ${
        warnings.length > 0
          ? "border-amber-500/60 bg-amber-950/20 dark:border-amber-500/60 dark:bg-amber-950/20"
          : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
      }`}
    >
      {/* Role A section (top) */}
      <div className="rounded-t-lg border-b border-blue-500/30 bg-blue-950/30 px-3 py-1.5">
        <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wide">
          {roleA}
        </span>
        {conditionsA.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-0.5">
            {conditionsA.map((c) => (
              <span
                key={`${c.groupId}-${c.role}`}
                className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[8px] font-medium text-blue-300"
              >
                {c.value}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* State info (middle) */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {displayName}
          </span>
          {warnings.length > 0 && (
            <span className="text-amber-400 text-[10px]" title={warnings.join("\n")}>&#9888;</span>
          )}
        </div>
        {label && (
          <div className="text-[10px] text-zinc-400">{positionName}</div>
        )}
      </div>

      {/* Role B section (bottom) */}
      <div className="rounded-b-lg border-t border-amber-500/30 bg-amber-950/30 px-3 py-1.5">
        <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wide">
          {roleB}
        </span>
        {conditionsB.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-0.5">
            {conditionsB.map((c) => (
              <span
                key={`${c.groupId}-${c.role}`}
                className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-medium text-amber-300"
              >
                {c.value}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Source handles — visible at rest, hidden during drag */}
      <Handle type="source" position={Position.Top} id="source-a"
        isConnectableEnd={false}
        className="!bg-blue-400 !w-3 !h-3 source-handle" />
      <Handle type="source" position={Position.Bottom} id="source-b"
        isConnectableEnd={false}
        className="!bg-amber-400 !w-3 !h-3 source-handle" />

      {/* Target handles — hidden by CSS, shown during connection drag.
          isConnectableStart={false} ensures connectionindicator only appears when dragging. */}
      {/* Role A targets: centered in A section */}
      <Handle type="target" position={Position.Left} id="target-a-left"
        isConnectableStart={false}
        className="!bg-blue-400 !w-2.5 !h-2.5 target-handle"
        style={{ top: "15%" }} />
      <Handle type="target" position={Position.Right} id="target-a-right"
        isConnectableStart={false}
        className="!bg-blue-400 !w-2.5 !h-2.5 target-handle"
        style={{ top: "15%" }} />

      {/* Role B targets: centered in B section */}
      <Handle type="target" position={Position.Left} id="target-b-left"
        isConnectableStart={false}
        className="!bg-amber-400 !w-2.5 !h-2.5 target-handle"
        style={{ top: "85%" }} />
      <Handle type="target" position={Position.Right} id="target-b-right"
        isConnectableStart={false}
        className="!bg-amber-400 !w-2.5 !h-2.5 target-handle"
        style={{ top: "85%" }} />
    </div>
  );
}
