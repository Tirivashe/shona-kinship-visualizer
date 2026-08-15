import { Handle, Position, type NodeProps } from "@xyflow/react";
import Image from "next/image";

export type PersonNodeData = {
  name: string;
  relationship: string;
  socialTerm?: string;
  isEgo: boolean;
  photoUrl?: string;
  onEdit?: () => void;
};

export function PersonNode({ data }: NodeProps) {
  const person = data as unknown as PersonNodeData;

  const initials = person.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <div
      className={`
        w-55
        relative
        rounded-xl
        border
        bg-white
        p-3
        shadow-sm
        ${person.isEgo ? "ring-2 ring-black" : ""}
      `}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle
        id="spouse-left"
        type="target"
        position={Position.Left}
        className="opacity-0"
      />
      <Handle
        id="spouse-right"
        type="source"
        position={Position.Right}
        className="opacity-0"
      />

      {person.onEdit && (
        <button
          type="button"
          aria-label={`Edit ${person.name}`}
          title={`Edit ${person.name}`}
          onClick={person.onEdit}
          className="nodrag nopan absolute top-2 right-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          Edit
        </button>
      )}

      <div className="flex items-center gap-3 pr-10">
        {person.photoUrl ? (
          <Image
            src={person.photoUrl}
            alt={`${person.name} profile`}
            width={48}
            height={48}
            unoptimized
            className="
              h-12
              w-12
              rounded-full
              object-cover
            "
          />
        ) : (
          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-full
              bg-neutral-200
              text-sm
              font-semibold
            "
          >
            {initials}
          </div>
        )}

        <div className="min-w-0">
          <div className="truncate font-semibold">{person.name}</div>

          <div className="text-sm text-neutral-500">{person.relationship}</div>

          {person.socialTerm && (
            <div className="text-xs text-neutral-400">
              Social: {person.socialTerm}
            </div>
          )}
        </div>
      </div>

      {person.isEgo && (
        <div
          className="
            mt-2
            text-xs
            font-medium
            uppercase
            tracking-wide
          "
        >
          Viewing as this person
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
