"use client";

import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";

import dagre from "@dagrejs/dagre";
import { useEffect, useState } from "react";

import { samplePeople, sampleRelationships } from "@/data/sampleFamily";

import { resolveKinship } from "@/kinship/resolve";

import { PersonNode, type PersonNodeData } from "./PersonNode";

const nodeTypes = {
  person: PersonNode,
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 96;
const DEFAULT_EGO_ID = samplePeople[0]?.id ?? "";

const peopleById = new Map(samplePeople.map((person) => [person.id, person]));

function fullName(person: (typeof samplePeople)[number]) {
  return `${person.firstName} ${person.surname}`;
}

function buildFlowElements(egoId: string): {
  nodes: Node[];
  edges: Edge[];
} {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  graph.setGraph({
    rankdir: "TB",
    ranksep: 100,
    nodesep: 60,
  });

  const nodes: Node[] = samplePeople.map((person) => {
    const relation = resolveKinship(
      egoId,
      person.id,
      samplePeople,
      sampleRelationships,
    );

    const data: PersonNodeData = {
      name: fullName(person),
      relationship: relation.title,
      isEgo: person.id === egoId,
      photoUrl: person.photoUrl,
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

  const edges: Edge[] = sampleRelationships.map((relationship) => {
    graph.setEdge(relationship.personAId, relationship.personBId);

    return {
      id: relationship.id,
      source: relationship.personAId,
      target: relationship.personBId,
      type: "smoothstep",
    };
  });

  dagre.layout(graph);

  const layoutedNodes = nodes.map((node) => {
    const position = graph.node(node.id);

    return {
      ...node,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });

  return {
    nodes: layoutedNodes,
    edges,
  };
}

function FlowCanvas({ egoId }: { egoId: string }) {
  // Capture the initial layout once. Subsequent ego changes update node data
  // without replacing the nodes, so dragged positions and viewport state stay
  // intact.
  const [initialElements] = useState(() => buildFlowElements(egoId));

  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialElements.nodes,
  );

  const [edges, , onEdgesChange] = useEdgesState(initialElements.edges);

  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const person = peopleById.get(node.id);

        if (!person) return node;

        const relation = resolveKinship(
          egoId,
          person.id,
          samplePeople,
          sampleRelationships,
        );

        const data: PersonNodeData = {
          name: fullName(person),
          relationship: relation.title,
          isEgo: person.id === egoId,
          photoUrl: person.photoUrl,
        };

        return {
          ...node,
          data,
        };
      }),
    );
  }, [egoId, setNodes]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}

export default function FamilyMap() {
  const [egoId, setEgoId] = useState(DEFAULT_EGO_ID);

  return (
    <div className="flex h-full flex-col">
      <div
        className="
          flex
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
          onChange={(event) => setEgoId(event.target.value)}
          className="
            rounded-md
            border
            px-3
            py-2
            text-sm
          "
        >
          {samplePeople.map((person) => (
            <option key={person.id} value={person.id}>
              {fullName(person)}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1">
        <FlowCanvas egoId={egoId} />
      </div>
    </div>
  );
}
