import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { mergeFlowNodesPreservingState } from "./flow-node-state";

const OPTIONS = {
  personWidth: 220,
  personHeight: 112,
  unionSize: 12,
  gap: 32,
};

function personNode(
  id: string,
  x: number,
  y: number,
  data: Record<string, unknown> = {},
): Node {
  return {
    id,
    type: "person",
    position: { x, y },
    data,
  };
}

describe("mergeFlowNodesPreservingState", () => {
  it("keeps every existing node position and interaction state when a person is added", () => {
    const current = [
      {
        ...personNode("existing", 700, 400, { relationship: "Baba" }),
        selected: true,
      },
    ];
    const next = [
      personNode("existing", 0, 0, { relationship: "Sekuru" }),
      personNode("new-person", 300, 0),
    ];
    const edges: Edge[] = [
      { id: "connection", source: "existing", target: "new-person" },
    ];

    const merged = mergeFlowNodesPreservingState(
      current,
      next,
      edges,
      OPTIONS,
    );

    expect(merged[0]).toMatchObject({
      id: "existing",
      position: { x: 700, y: 400 },
      selected: true,
      data: { relationship: "Sekuru" },
    });
    expect(merged[1]).toMatchObject({
      id: "new-person",
      position: { x: 1000, y: 400 },
    });
  });

  it("places a new person without moving or overlapping manually positioned nodes", () => {
    const current = [
      personNode("anchor", 0, 0),
      personNode("blocker", 252, 0),
    ];
    const next = [
      personNode("anchor", 0, 0),
      personNode("blocker", 900, 0),
      personNode("new-person", 252, 0),
    ];
    const edges: Edge[] = [
      { id: "connection", source: "anchor", target: "new-person" },
    ];

    const merged = mergeFlowNodesPreservingState(
      current,
      next,
      edges,
      OPTIONS,
    );

    expect(merged.find((node) => node.id === "anchor")?.position).toEqual({
      x: 0,
      y: 0,
    });
    expect(merged.find((node) => node.id === "blocker")?.position).toEqual({
      x: 252,
      y: 0,
    });
    expect(merged.find((node) => node.id === "new-person")?.position).toEqual({
      x: 504,
      y: 0,
    });
  });
});
