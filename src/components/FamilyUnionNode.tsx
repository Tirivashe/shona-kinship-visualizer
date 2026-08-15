import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface FamilyUnionNodeData extends Record<string, unknown> {
  personAId: string;
  personBId: string;
  married: boolean;
}

export function FamilyUnionNode({ data }: NodeProps) {
  const union = data as unknown as FamilyUnionNodeData;

  return (
    <div
      aria-label={
        union.married
          ? "Marriage and family branch point"
          : "Biological parent branch point"
      }
      className={`h-3 w-3 rounded-full border-2 border-white shadow-sm ${
        union.married ? "bg-pink-500" : "bg-red-600"
      }`}
    >
      <Handle
        id="union-left"
        type="target"
        position={Position.Left}
        className="opacity-0"
      />
      <Handle
        id="union-right"
        type="source"
        position={Position.Right}
        className="opacity-0"
      />
      <Handle
        id="union-child"
        type="source"
        position={Position.Bottom}
        className="opacity-0"
      />
    </div>
  );
}
