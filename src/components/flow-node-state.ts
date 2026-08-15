import type { Edge, Node, XYPosition } from "@xyflow/react";

interface MergeFlowNodeOptions {
  personWidth: number;
  personHeight: number;
  unionSize: number;
  gap?: number;
}

function nodeSize(
  node: Node,
  { personWidth, personHeight, unionSize }: MergeFlowNodeOptions,
) {
  return {
    width:
      node.measured?.width ??
      (node.type === "familyUnion" ? unionSize : personWidth),
    height:
      node.measured?.height ??
      (node.type === "familyUnion" ? unionSize : personHeight),
  };
}

function nodeCenter(node: Node, options: MergeFlowNodeOptions) {
  const { width, height } = nodeSize(node, options);
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

function buildAdjacency(edges: readonly Edge[]) {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    const source = adjacency.get(edge.source) ?? new Set<string>();
    source.add(edge.target);
    adjacency.set(edge.source, source);

    const target = adjacency.get(edge.target) ?? new Set<string>();
    target.add(edge.source);
    adjacency.set(edge.target, target);
  }

  return adjacency;
}

function nearestPersistedGraphNode(
  startId: string,
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  persistedIds: ReadonlySet<string>,
) {
  const queue = [startId];
  const visited = new Set(queue);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const neighbor of adjacency.get(queue[cursor]) ?? []) {
      if (visited.has(neighbor)) continue;
      if (persistedIds.has(neighbor)) return neighbor;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return undefined;
}

function nearestPersistedLayoutNode(
  node: Node,
  nextNodes: readonly Node[],
  persistedIds: ReadonlySet<string>,
  options: MergeFlowNodeOptions,
) {
  const center = nodeCenter(node, options);
  let nearestId: string | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of nextNodes) {
    if (!persistedIds.has(candidate.id)) continue;
    const candidateCenter = nodeCenter(candidate, options);
    const distance =
      (candidateCenter.x - center.x) ** 2 +
      (candidateCenter.y - center.y) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = candidate.id;
    }
  }

  return nearestId;
}

function translateFromAnchor(
  node: Node,
  nextAnchor: Node,
  currentAnchor: Node,
  options: MergeFlowNodeOptions,
): XYPosition {
  const nextNodeCenter = nodeCenter(node, options);
  const nextAnchorCenter = nodeCenter(nextAnchor, options);
  const currentAnchorCenter = nodeCenter(currentAnchor, options);
  const { width, height } = nodeSize(node, options);

  return {
    x:
      currentAnchorCenter.x +
      (nextNodeCenter.x - nextAnchorCenter.x) -
      width / 2,
    y:
      currentAnchorCenter.y +
      (nextNodeCenter.y - nextAnchorCenter.y) -
      height / 2,
  };
}

function overlapsPersonNode(
  position: XYPosition,
  occupied: readonly Node[],
  options: MergeFlowNodeOptions,
) {
  const gap = options.gap ?? 32;
  const width = options.personWidth;
  const height = options.personHeight;

  return occupied.some((node) => {
    const size = nodeSize(node, options);
    return (
      position.x < node.position.x + size.width + gap &&
      position.x + width + gap > node.position.x &&
      position.y < node.position.y + size.height + gap &&
      position.y + height + gap > node.position.y
    );
  });
}

function findUnoccupiedPosition(
  preferred: XYPosition,
  occupied: readonly Node[],
  options: MergeFlowNodeOptions,
) {
  if (!overlapsPersonNode(preferred, occupied, options)) return preferred;

  const gap = options.gap ?? 32;
  const horizontalStride = options.personWidth + gap;
  const verticalStride = options.personHeight + gap;
  const searchLimit = Math.max(12, occupied.length + 1);

  // Keep the node on its Dagre generation row when possible, moving outward
  // horizontally before trying adjacent rows.
  for (let vertical = 0; vertical <= searchLimit; vertical += 1) {
    const verticalOffsets =
      vertical === 0 ? [0] : [vertical, -vertical];
    for (const verticalOffset of verticalOffsets) {
      for (let horizontal = 0; horizontal <= searchLimit; horizontal += 1) {
        const horizontalOffsets =
          horizontal === 0 ? [0] : [horizontal, -horizontal];
        for (const horizontalOffset of horizontalOffsets) {
          const candidate = {
            x: preferred.x + horizontalOffset * horizontalStride,
            y: preferred.y + verticalOffset * verticalStride,
          };
          if (!overlapsPersonNode(candidate, occupied, options)) {
            return candidate;
          }
        }
      }
    }
  }

  return preferred;
}

/**
 * Reconcile a fresh data/layout snapshot with the live React Flow nodes.
 * Existing nodes retain their exact position and interaction state. Dagre's
 * fresh geometry is used only to position genuinely new person nodes relative
 * to the closest persisted part of the graph.
 */
export function mergeFlowNodesPreservingState(
  currentNodes: readonly Node[],
  nextNodes: readonly Node[],
  nextEdges: readonly Edge[],
  options: MergeFlowNodeOptions,
) {
  const nextIds = new Set(nextNodes.map((node) => node.id));
  const currentById = new Map(
    currentNodes
      .filter((node) => nextIds.has(node.id))
      .map((node) => [node.id, node]),
  );
  const nextById = new Map(nextNodes.map((node) => [node.id, node]));
  const persistedIds = new Set(currentById.keys());
  const adjacency = buildAdjacency(nextEdges);
  const occupiedPeople = currentNodes.filter(
    (node) => node.type === "person" && nextIds.has(node.id),
  );

  return nextNodes.map((nextNode) => {
    const current = currentById.get(nextNode.id);
    if (current) {
      return {
        ...current,
        ...nextNode,
        position: current.position,
        data: nextNode.data,
      };
    }

    if (nextNode.type !== "person") return nextNode;

    const anchorId =
      nearestPersistedGraphNode(nextNode.id, adjacency, persistedIds) ??
      nearestPersistedLayoutNode(
        nextNode,
        nextNodes,
        persistedIds,
        options,
      );
    const nextAnchor = anchorId ? nextById.get(anchorId) : undefined;
    const currentAnchor = anchorId ? currentById.get(anchorId) : undefined;
    const preferredPosition =
      nextAnchor && currentAnchor
        ? translateFromAnchor(nextNode, nextAnchor, currentAnchor, options)
        : nextNode.position;
    const position = findUnoccupiedPosition(
      preferredPosition,
      occupiedPeople,
      options,
    );
    const placedNode = { ...nextNode, position };
    occupiedPeople.push(placedNode);
    return placedNode;
  });
}
