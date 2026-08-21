import { Handle, Position, type NodeProps } from "@xyflow/react";
import Image from "next/image";

export type PersonNodeData = {
  name: string;
  relationship: string;
  socialTerm?: string;
  isEgo: boolean;
  photoUrl?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  actionsDisabled?: boolean;
  isDeleting?: boolean;
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

      {person.onDelete && (
        <button
          type="button"
          aria-label={
            person.isDeleting
              ? `Deleting ${person.name}`
              : `Delete ${person.name}`
          }
          title={
            person.isDeleting
              ? `Deleting ${person.name}`
              : `Delete ${person.name}`
          }
          disabled={person.actionsDisabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            person.onDelete?.();
          }}
          className={`nodrag nopan nowheel absolute -top-2 -left-2 z-10 flex h-8 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-wait disabled:opacity-70 ${
            person.isDeleting ? "min-w-8 px-2" : "w-8"
          }`}
        >
          {person.isDeleting ? (
            <span className="text-xs font-semibold">Deleting…</span>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v5" />
              <path d="M14 11v5" />
            </svg>
          )}
        </button>
      )}

      {person.onEdit && (
        <button
          type="button"
          aria-label={`Edit ${person.name}`}
          title={`Edit ${person.name}`}
          disabled={person.actionsDisabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            person.onEdit?.();
          }}
          className="nodrag nopan nowheel absolute top-2 right-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-wait disabled:opacity-50"
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
