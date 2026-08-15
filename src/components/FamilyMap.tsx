"use client";

import {
  Background,
  Controls,
  ReactFlow,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";

import dagre from "@dagrejs/dagre";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  createInMemoryFamilyDatabase,
  type NewCharacterInput,
} from "@/data/in-memory-family-database";

import { resolveKinship } from "@/kinship/resolve";
import type { Person, Relationship } from "@/types/family";

import { CharacterDialog } from "./AddCharacterDialog";
import {
  FamilyUnionNode,
  type FamilyUnionNodeData,
} from "./FamilyUnionNode";
import { PersonNode, type PersonNodeData } from "./PersonNode";
import { deriveFamilyUnions } from "./family-unions";

const nodeTypes = {
  person: PersonNode,
  familyUnion: FamilyUnionNode,
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 112;
const UNION_SIZE = 12;

const EDGE_COLORS: Record<Relationship["type"], string> = {
  SPOUSE_OF: "#ff2d95",
  SIBLING_OF: "#4b2e1f",
  PARENT_OF: "#dc2626",
};

const EDGE_LEGEND: Array<{
  type: Relationship["type"];
  label: string;
}> = [
  { type: "SPOUSE_OF", label: "Married spouses" },
  { type: "SIBLING_OF", label: "Sibling" },
  { type: "PARENT_OF", label: "Biological parent–child" },
];

function isVisibleRelationship(relationship: Relationship) {
  if (relationship.type === "PARENT_OF") {
    return relationship.biological === true;
  }
  if (relationship.type === "SPOUSE_OF") {
    return relationship.married === true;
  }
  return true;
}

function fullName(person: Person) {
  return `${person.firstName} ${person.surname}`;
}

function familyStructureKey(
  people: readonly Person[],
  relationships: readonly Relationship[],
) {
  const personKey = people
    .map((person) => person.id)
    .sort()
    .join("|");
  const relationshipKey = relationships
    .map((relationship) =>
      relationship.type === "SIBLING_OF"
        ? `${relationship.type}:${relationship.personAId}:${relationship.personBId}:${relationship.seniority}`
        : relationship.type === "PARENT_OF"
          ? `${relationship.type}:${relationship.personAId}:${relationship.personBId}:${relationship.biological === true ? "biological" : "unqualified"}:${relationship.biologicalUnionId ?? "no-union"}`
          : `${relationship.type}:${relationship.personAId}:${relationship.personBId}:${relationship.married === true ? "married" : "not-married"}`,
    )
    .sort()
    .join("|");
  return `${personKey}::${relationshipKey}`;
}

function nodeCenter(node: Node) {
  const width =
    node.measured?.width ??
    (node.type === "familyUnion" ? UNION_SIZE : NODE_WIDTH);
  const height =
    node.measured?.height ??
    (node.type === "familyUnion" ? UNION_SIZE : NODE_HEIGHT);
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

function alignFamilyUnionNodes(nodes: Node[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return nodes.map((node) => {
    if (node.type !== "familyUnion") return node;
    const data = node.data as unknown as FamilyUnionNodeData;
    const personA = byId.get(data.personAId);
    const personB = byId.get(data.personBId);
    if (!personA || !personB) return node;

    const centerA = nodeCenter(personA);
    const centerB = nodeCenter(personB);
    return {
      ...node,
      position: {
        x: (centerA.x + centerB.x) / 2 - UNION_SIZE / 2,
        y: (centerA.y + centerB.y) / 2 - UNION_SIZE / 2,
      },
    };
  });
}

function buildFlowElements(
  egoId: string,
  people: Person[],
  relationships: Relationship[],
  onEdit: (personId: string) => void,
): {
  nodes: Node[];
  edges: Edge[];
} {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  graph.setGraph({
    rankdir: "TB",
    ranksep: 100,
    nodesep: 60,
  });

  const personNodes: Node[] = people.map((person) => {
    const relation = resolveKinship(
      egoId,
      person.id,
      people,
      relationships,
    );

    const data: PersonNodeData = {
      name: fullName(person),
      relationship: relation.title,
      socialTerm: relation.socialTerm,
      isEgo: person.id === egoId,
      photoUrl: person.photoUrl,
      onEdit: () => onEdit(person.id),
    };

    graph.setNode(person.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });

    return {
      id: person.id,
      type: "person",
      position: {
        x: 0,
        y: 0,
      },
      data,
    };
  });

  const personIds = new Set(people.map((person) => person.id));
  const familyUnions = deriveFamilyUnions(relationships).filter(
    (union) =>
      personIds.has(union.personAId) && personIds.has(union.personBId),
  );
  const unionByMarriageId = new Map<
    string,
    (typeof familyUnions)[number]
  >();
  for (const union of familyUnions) {
    if (union.spouseRelationshipId) {
      unionByMarriageId.set(union.spouseRelationshipId, union);
    }
  }
  const joinedParentRelationshipIds = new Set(
    familyUnions.flatMap((union) => union.parentRelationshipIds),
  );

  const unionNodes: Node[] = familyUnions.map((union) => {
    const data: FamilyUnionNodeData = {
      personAId: union.personAId,
      personBId: union.personBId,
      married: union.married,
    };
    graph.setNode(union.id, { width: UNION_SIZE, height: UNION_SIZE });
    return {
      id: union.id,
      type: "familyUnion",
      position: { x: 0, y: 0 },
      data,
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
    };
  });

  // Union junctions keep a married couple or two biological co-parents on one
  // rank. Biological children descend from the junction independently of the
  // pair's marriage state.
  for (const relationship of relationships) {
    if (!isVisibleRelationship(relationship)) continue;
    if (joinedParentRelationshipIds.has(relationship.id)) continue;
    if (unionByMarriageId.has(relationship.id)) continue;
    graph.setEdge(relationship.personAId, relationship.personBId);
  }
  for (const union of familyUnions) {
    graph.setEdge(union.personAId, union.id);
    graph.setEdge(union.personBId, union.id);
    for (const childId of union.childIds) graph.setEdge(union.id, childId);
  }

  dagre.layout(graph);

  const layoutedNodes = alignFamilyUnionNodes(
    [...personNodes, ...unionNodes].map((node) => {
      const position = graph.node(node.id);
      const width = node.type === "familyUnion" ? UNION_SIZE : NODE_WIDTH;
      const height = node.type === "familyUnion" ? UNION_SIZE : NODE_HEIGHT;

      return {
        ...node,
        position: {
          x: position.x - width / 2,
          y: position.y - height / 2,
        },
      };
    }),
  );

  const layoutedById = new Map(layoutedNodes.map((node) => [node.id, node]));
  const edges: Edge[] = relationships
    .filter(
      (relationship) =>
        isVisibleRelationship(relationship) &&
        !joinedParentRelationshipIds.has(relationship.id) &&
        !unionByMarriageId.has(relationship.id),
    )
    .map((relationship) => ({
      id: relationship.id,
      source: relationship.personAId,
      target: relationship.personBId,
      type: "smoothstep",
      style: {
        stroke: EDGE_COLORS[relationship.type],
        strokeWidth: 3,
      },
    }));

  for (const union of familyUnions) {
    const personA = layoutedById.get(union.personAId);
    const personB = layoutedById.get(union.personBId);
    if (!personA || !personB) continue;
    const [leftPerson, rightPerson] =
      nodeCenter(personA).x <= nodeCenter(personB).x
        ? [personA, personB]
        : [personB, personA];
    const horizontalColor = union.married
      ? EDGE_COLORS.SPOUSE_OF
      : EDGE_COLORS.PARENT_OF;
    const horizontalEdgeId = union.spouseRelationshipId ?? union.id;

    edges.push(
      {
        id: `${horizontalEdgeId}-left`,
        source: leftPerson.id,
        sourceHandle: "spouse-right",
        target: union.id,
        targetHandle: "union-left",
        type: "straight",
        style: { stroke: horizontalColor, strokeWidth: 3 },
      },
      {
        id: `${horizontalEdgeId}-right`,
        source: union.id,
        sourceHandle: "union-right",
        target: rightPerson.id,
        targetHandle: "spouse-left",
        type: "straight",
        style: { stroke: horizontalColor, strokeWidth: 3 },
      },
    );

    for (const childId of union.childIds) {
      edges.push({
        id: `${union.id}-child-${childId}`,
        source: union.id,
        sourceHandle: "union-child",
        target: childId,
        type: "smoothstep",
        style: { stroke: EDGE_COLORS.PARENT_OF, strokeWidth: 3 },
      });
    }
  }

  return {
    nodes: layoutedNodes,
    edges,
  };
}

interface FlowCanvasProps {
  egoId: string;
  people: Person[];
  relationships: Relationship[];
  onEdit: (personId: string) => void;
}

function FlowCanvas({
  egoId,
  people,
  relationships,
  onEdit,
}: FlowCanvasProps) {
  // Capture the initial layout once. Subsequent ego changes update node data
  // without replacing the nodes, so dragged positions and viewport state stay
  // intact.
  const [initialElements] = useState(() =>
    buildFlowElements(egoId, people, relationships, onEdit),
  );

  const [nodes, setNodes] = useNodesState(initialElements.nodes);

  const [edges, setEdges, onEdgesChange] = useEdgesState(initialElements.edges);
  const flowInstance = useRef<ReactFlowInstance>(null);
  const previousPersonCount = useRef(people.length);
  const structureKey = familyStructureKey(people, relationships);
  const previousStructureKey = useRef(structureKey);

  useEffect(() => {
    const structureChanged = structureKey !== previousStructureKey.current;
    const nextElements = buildFlowElements(
      egoId,
      people,
      relationships,
      onEdit,
    );

    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((node) => [node.id, node]));
      const anchor = nextElements.nodes.find((node) =>
        currentById.has(node.id),
      );
      const currentAnchor = anchor ? currentById.get(anchor.id) : undefined;
      const layoutOffset =
        anchor && currentAnchor
          ? {
              x: currentAnchor.position.x - anchor.position.x,
              y: currentAnchor.position.y - anchor.position.y,
            }
          : { x: 0, y: 0 };

      if (structureChanged) {
        return alignFamilyUnionNodes(
          nextElements.nodes.map((nextNode) => ({
            ...nextNode,
            position: {
              x: nextNode.position.x + layoutOffset.x,
              y: nextNode.position.y + layoutOffset.y,
            },
          })),
        );
      }

      const mergedNodes = nextElements.nodes.map((nextNode) => {
        const current = currentById.get(nextNode.id);
        if (nextNode.type === "familyUnion") return nextNode;
        if (!current) {
          return {
            ...nextNode,
            position: {
              x: nextNode.position.x + layoutOffset.x,
              y: nextNode.position.y + layoutOffset.y,
            },
          };
        }

        return {
          ...current,
          type: nextNode.type,
          data: nextNode.data,
        };
      });

      return alignFamilyUnionNodes(mergedNodes);
    });
    setEdges(nextElements.edges);

    if (people.length > previousPersonCount.current) {
      requestAnimationFrame(() => {
        void flowInstance.current?.fitView({ duration: 250, padding: 0.2 });
      });
    }
    previousPersonCount.current = people.length;
    previousStructureKey.current = structureKey;
  }, [
    egoId,
    onEdit,
    people,
    relationships,
    setEdges,
    setNodes,
    structureKey,
  ]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      setNodes((currentNodes) =>
        alignFamilyUnionNodes(applyNodeChanges(changes, currentNodes)),
      );
    },
    [setNodes],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onInit={(instance) => {
        flowInstance.current = instance;
      }}
      fitView
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}

export default function FamilyMap() {
  const [database] = useState(() => createInMemoryFamilyDatabase());
  const [family, setFamily] = useState(() => database.snapshot());
  const [egoId, setEgoId] = useState(family.people[0]?.id ?? "");
  const [characterDialog, setCharacterDialog] = useState<
    { mode: "add" } | { mode: "edit"; personId: string }
  >();

  const editCharacter = useCallback((personId: string) => {
    setCharacterDialog({ mode: "edit", personId });
  }, []);

  function saveCharacter(input: NewCharacterInput) {
    const person =
      characterDialog?.mode === "edit"
        ? database.updateCharacter(characterDialog.personId, input)
        : database.addCharacter(input);
    setFamily(database.snapshot());
    setEgoId((current) => current || person.id);
    setCharacterDialog(undefined);
  }

  const editingPerson =
    characterDialog?.mode === "edit"
      ? family.people.find(
          (person) => person.id === characterDialog.personId,
        )
      : undefined;

  return (
    <div className="flex h-full flex-col">
      <div
        className="
          flex
          flex-wrap
          items-center
          gap-3
          border-b
          bg-white
          px-4
          py-3
        "
      >
        <span className="text-sm font-medium">View family as</span>

        <select
          value={egoId}
          disabled={family.people.length === 0}
          onChange={(event) => setEgoId(event.target.value)}
          className="
            rounded-md
            border
            px-3
            py-2
            text-sm
          "
        >
          {family.people.map((person) => (
            <option key={person.id} value={person.id}>
              {fullName(person)}
            </option>
          ))}
        </select>

        <div
          aria-label="Relationship connection colors"
          className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600"
        >
          {EDGE_LEGEND.map(({ type, label }) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-0.5 w-6 rounded-full"
                style={{ backgroundColor: EDGE_COLORS[type] }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <FlowCanvas
          egoId={egoId}
          people={family.people}
          relationships={family.relationships}
          onEdit={editCharacter}
        />
      </div>

      <button
        type="button"
        aria-label="Add family member"
        title="Add family member"
        onClick={() => setCharacterDialog({ mode: "add" })}
        className="fixed right-6 bottom-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-3xl font-light text-white shadow-lg transition hover:scale-105 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-950"
      >
        <span aria-hidden="true">+</span>
      </button>

      {characterDialog && (characterDialog.mode === "add" || editingPerson) && (
        <CharacterDialog
          character={editingPerson}
          people={
            editingPerson
              ? family.people.filter((person) => person.id !== editingPerson.id)
              : family.people
          }
          initialConnections={
            editingPerson ? database.connectionsFor(editingPerson.id) : []
          }
          onSave={saveCharacter}
          onClose={() => setCharacterDialog(undefined)}
        />
      )}
    </div>
  );
}
