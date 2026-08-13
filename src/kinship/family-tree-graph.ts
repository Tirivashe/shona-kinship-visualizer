import type {
  KPath,
  KStep,
  Person,
  RelativeAge,
  TraversalResult,
} from "./model";

interface GraphEdge {
  to: string;
  step: KStep;
}

export interface SupplementalSibling {
  personAId: string;
  personBId: string;
  /** The age of B relative to A. */
  personBRelativeAge?: RelativeAge;
}

export interface SupplementalParent {
  parentId: string;
  childId: string;
}

/**
 * Genealogical graph with a bounded BFS over parent, child, and spouse edges.
 * Supplemental sibling links exist only for adapting older project data; a
 * graph-native Person model derives B/Z through shared parents.
 */
export class FamilyTreeGraph {
  private readonly peopleById: Map<string, Person>;
  private readonly adjacency = new Map<string, GraphEdge[]>();
  private readonly siblingAge = new Map<string, RelativeAge>();
  private readonly parentsByChild = new Map<string, Set<string>>();

  constructor(
    people: readonly Person[],
    supplementalSiblings: readonly SupplementalSibling[] = [],
    supplementalParents: readonly SupplementalParent[] = [],
  ) {
    this.peopleById = new Map(people.map((person) => [person.id, person]));

    for (const person of people) {
      this.adjacency.set(person.id, []);
      this.parentsByChild.set(person.id, new Set());
    }
    for (const person of people) this.addSpouseEdges(person);

    const parentLinks: SupplementalParent[] = [
      ...people.flatMap((person) => [
        ...(person.fatherId
          ? [{ parentId: person.fatherId, childId: person.id }]
          : []),
        ...(person.motherId
          ? [{ parentId: person.motherId, childId: person.id }]
          : []),
      ]),
      ...supplementalParents,
    ];

    for (const relationship of parentLinks) {
      this.addParentChildEdges(relationship.parentId, relationship.childId);
    }

    // Shona parenthood is classificatory: a parent's spouse occupies the same
    // parent category for the child and participates in that child's lineage.
    for (const relationship of parentLinks) {
      const parent = this.peopleById.get(relationship.parentId);
      for (const spouseId of parent?.spouseIds ?? []) {
        this.addParentChildEdges(spouseId, relationship.childId);
      }
    }

    for (const sibling of supplementalSiblings) {
      this.addSiblingEdge(sibling.personAId, sibling.personBId);
      this.addSiblingEdge(sibling.personBId, sibling.personAId);
      const bRelativeToA = sibling.personBRelativeAge ?? "unknown";
      this.siblingAge.set(
        this.ageKey(sibling.personAId, sibling.personBId),
        bRelativeToA,
      );
      this.siblingAge.set(
        this.ageKey(sibling.personBId, sibling.personAId),
        this.invertAge(bRelativeToA),
      );
    }
  }

  getPerson(id: string): Person | undefined {
    return this.peopleById.get(id);
  }

  /**
   * Whether two people belong to the same classificatory patrilineage.
   * A woman remains a member of her father's line; her children acquire
   * their own father-line membership. Multiple functional fathers are all
   * honored because every parent edge is classificatory in this graph.
   */
  sharesPatrilineage(personAId: string, personBId: string): boolean {
    const a = this.patrilineageAnchors(personAId);
    if (a.size === 0) return false;
    return [...this.patrilineageAnchors(personBId)].some((id) => a.has(id));
  }

  /** Return the target's age relative to the reference person. */
  relativeAge(referenceId: string, targetId: string): RelativeAge {
    const explicit = this.siblingAge.get(this.ageKey(referenceId, targetId));
    if (explicit && explicit !== "unknown") return explicit;

    const reference = this.peopleById.get(referenceId);
    const target = this.peopleById.get(targetId);
    if (reference?.birthOrder === undefined || target?.birthOrder === undefined) {
      return "unknown";
    }
    if (target.birthOrder < reference.birthOrder) return "older";
    if (target.birthOrder > reference.birthOrder) return "younger";
    return "same";
  }

  findShortestPath(egoId: string, targetId: string): TraversalResult | null {
    return this.findShortestPaths(egoId, targetId, 1)[0] ?? null;
  }

  findShortestPaths(
    egoId: string,
    targetId: string,
    maxPaths = 64,
  ): TraversalResult[] {
    if (!this.peopleById.has(egoId) || !this.peopleById.has(targetId)) return [];
    if (egoId === targetId) {
      return [
        {
          personIds: [egoId],
          rawPath: [],
          canonicalPath: [],
          generationDistance: 0,
        },
      ];
    }

    const queue: Array<{
      personIds: string[];
      rawPath: KPath;
    }> = [{ personIds: [egoId], rawPath: [] }];
    const bestDepth = new Map<string, number>([[egoId, 0]]);
    const matches: TraversalResult[] = [];
    let shortestDepth: number | undefined;

    for (let cursor = 0; cursor < queue.length && matches.length < maxPaths; cursor += 1) {
      const current = queue[cursor];
      if (shortestDepth !== undefined && current.rawPath.length >= shortestDepth) continue;

      const currentId = current.personIds.at(-1);
      if (!currentId) continue;

      for (const edge of this.adjacency.get(currentId) ?? []) {
        if (current.personIds.includes(edge.to)) continue;

        const rawPath = [...current.rawPath, edge.step];
        const depth = rawPath.length;
        const knownDepth = bestDepth.get(edge.to);
        if (knownDepth !== undefined && depth > knownDepth) continue;

        const personIds = [...current.personIds, edge.to];
        if (edge.to === targetId) {
          shortestDepth ??= depth;
          if (depth === shortestDepth) {
            matches.push({
              personIds,
              rawPath,
              canonicalPath: FamilyTreeGraph.canonicalize(rawPath),
              generationDistance: FamilyTreeGraph.generationDistance(rawPath),
            });
          }
          continue;
        }

        if (shortestDepth !== undefined && depth >= shortestDepth) continue;
        if (knownDepth === undefined) bestDepth.set(edge.to, depth);
        queue.push({ personIds, rawPath });
      }
    }

    const unique = new Map(
      matches.map((match) => [
        `${match.personIds.join(">")}|${match.canonicalPath.join(".")}`,
        match,
      ]),
    );
    return [...unique.values()];
  }

  /** Collapse a parent's other child into anthropological B/Z notation. */
  static canonicalize(rawPath: readonly KStep[]): KPath {
    const canonical: KPath = [];

    for (let index = 0; index < rawPath.length; index += 1) {
      const current = rawPath[index];
      const next = rawPath[index + 1];

      if ((current === "F" || current === "M") && (next === "S" || next === "D")) {
        canonical.push(next === "S" ? "B" : "Z");
        index += 1;
      } else {
        canonical.push(current);
      }
    }

    return canonical;
  }

  static generationDistance(path: readonly KStep[]): number {
    return path.reduce((distance, step) => {
      if (step === "F" || step === "M") return distance + 1;
      if (step === "S" || step === "D") return distance - 1;
      return distance;
    }, 0);
  }

  private addSpouseEdges(person: Person) {
    for (const spouseId of person.spouseIds) {
      const spouse = this.peopleById.get(spouseId);
      if (!spouse) continue;
      this.addEdge(
        person.id,
        spouse.id,
        spouse.sex === "M" ? "H" : "W",
      );
    }
  }

  private addParentChildEdges(
    parentId: string,
    childId: string,
  ) {
    const parent = this.peopleById.get(parentId);
    const child = this.peopleById.get(childId);
    if (!parent || !child) return;

    this.parentsByChild.get(childId)?.add(parentId);

    this.addEdge(
      child.id,
      parent.id,
      parent.sex === "M" ? "F" : "M",
    );
    this.addEdge(
      parent.id,
      child.id,
      child.sex === "M" ? "S" : "D",
    );
  }

  private addSiblingEdge(fromId: string, toId: string) {
    const target = this.peopleById.get(toId);
    if (target) this.addEdge(fromId, toId, target.sex === "M" ? "B" : "Z");
  }

  private addEdge(
    from: string,
    to: string,
    step: KStep,
  ) {
    const edges = this.adjacency.get(from);
    if (!edges || edges.some((edge) => edge.to === to && edge.step === step)) return;
    edges.push({ to, step });
  }

  private ageKey(referenceId: string, targetId: string) {
    return `${referenceId}>${targetId}`;
  }

  private invertAge(age: RelativeAge): RelativeAge {
    if (age === "older") return "younger";
    if (age === "younger") return "older";
    return age;
  }

  private patrilineageAnchors(personId: string): Set<string> {
    const anchors = new Set<string>();
    const queue = [personId];
    const visited = new Set<string>();

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const currentId = queue[cursor];
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const current = this.peopleById.get(currentId);
      if (current?.sex === "M") anchors.add(currentId);

      for (const parentId of this.parentsByChild.get(currentId) ?? []) {
        if (this.peopleById.get(parentId)?.sex === "M") queue.push(parentId);
      }
    }

    return anchors;
  }
}
