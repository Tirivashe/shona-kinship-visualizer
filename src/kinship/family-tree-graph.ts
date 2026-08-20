import type {
  GraphValidationIssue,
  GraphValidationReport,
  KPath,
  KStep,
  Person,
  RelativeAge,
  SiblingSenioritySegment,
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

function firstDirectedCycle(
  ids: readonly string[],
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): string[] | undefined {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (id: string): string[] | undefined => {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      return [...stack.slice(start), id];
    }
    if (visited.has(id)) return undefined;

    visiting.add(id);
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return undefined;
  };

  for (const id of ids) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return undefined;
}

/** Validate source records before they are normalized into graph edges. */
export function validateFamilyGraphInput(
  people: readonly Person[],
  supplementalSiblings: readonly SupplementalSibling[] = [],
  supplementalParents: readonly SupplementalParent[] = [],
): GraphValidationReport {
  const issues: GraphValidationIssue[] = [];
  const counts = new Map<string, number>();
  for (const person of people) {
    counts.set(person.id, (counts.get(person.id) ?? 0) + 1);
  }
  for (const [id, count] of counts) {
    if (count > 1) {
      issues.push({
        code: "DUPLICATE_PERSON_ID",
        severity: "error",
        message: `Person ID ${id} occurs ${count} times.`,
        personIds: [id],
      });
    }
  }

  const peopleById = new Map(people.map((person) => [person.id, person]));
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

  for (const person of people) {
    for (const [field, parentId, expectedSex] of [
      ["fatherId", person.fatherId, "M"],
      ["motherId", person.motherId, "F"],
    ] as const) {
      if (!parentId) continue;
      const parent = peopleById.get(parentId);
      if (!parent) {
        issues.push({
          code: "DANGLING_PARENT",
          severity: "error",
          message: `${person.id}.${field} references missing person ${parentId}.`,
          personIds: [person.id, parentId],
        });
      } else if (parent.sex !== expectedSex) {
        issues.push({
          code: "PARENT_SEX_MISMATCH",
          severity: "error",
          message: `${person.id}.${field} references a person whose sex is ${parent.sex}.`,
          personIds: [person.id, parentId],
        });
      }
    }

    for (const spouseId of person.spouseIds) {
      if (spouseId === person.id) {
        issues.push({
          code: "SELF_SPOUSE",
          severity: "error",
          message: `${person.id} cannot be their own spouse.`,
          personIds: [person.id],
        });
      } else if (!peopleById.has(spouseId)) {
        issues.push({
          code: "DANGLING_SPOUSE",
          severity: "error",
          message: `${person.id} references missing spouse ${spouseId}.`,
          personIds: [person.id, spouseId],
        });
      }
    }
  }

  for (const link of supplementalParents) {
    if (link.parentId === link.childId) {
      issues.push({
        code: "SELF_PARENT",
        severity: "error",
        message: `${link.parentId} cannot be their own parent.`,
        personIds: [link.parentId],
      });
    }
    for (const id of [link.parentId, link.childId]) {
      if (!peopleById.has(id)) {
        issues.push({
          code: "DANGLING_PARENT",
          severity: "error",
          message: `Parent link ${link.parentId} -> ${link.childId} references missing person ${id}.`,
          personIds: [link.parentId, link.childId],
        });
      }
    }
  }

  const seniorityEdges = new Map<string, Set<string>>();
  for (const sibling of supplementalSiblings) {
    if (sibling.personAId === sibling.personBId) {
      issues.push({
        code: "SELF_SIBLING",
        severity: "error",
        message: `${sibling.personAId} cannot be their own sibling.`,
        personIds: [sibling.personAId],
      });
      continue;
    }
    const missing = [sibling.personAId, sibling.personBId].filter(
      (id) => !peopleById.has(id),
    );
    if (missing.length > 0) {
      issues.push({
        code: "DANGLING_SIBLING",
        severity: "error",
        message: `Sibling link ${sibling.personAId} <-> ${sibling.personBId} references missing people.`,
        personIds: [sibling.personAId, sibling.personBId],
      });
      continue;
    }

    const relativeAge = sibling.personBRelativeAge ?? "unknown";
    if (relativeAge === "unknown" || relativeAge === "same") continue;
    const olderId =
      relativeAge === "older" ? sibling.personBId : sibling.personAId;
    const youngerId =
      relativeAge === "older" ? sibling.personAId : sibling.personBId;
    const younger = seniorityEdges.get(olderId) ?? new Set<string>();
    younger.add(youngerId);
    seniorityEdges.set(olderId, younger);
  }

  const seniorityCycle = firstDirectedCycle(
    [...peopleById.keys()],
    seniorityEdges,
  );
  if (seniorityCycle) {
    issues.push({
      code: "CONTRADICTORY_SENIORITY",
      severity: "error",
      message: `Sibling seniority contains a cycle: ${seniorityCycle.join(" > ")}.`,
      personIds: seniorityCycle,
    });
  }

  const parentEdges = new Map<string, Set<string>>();
  for (const { parentId, childId } of parentLinks) {
    if (parentId === childId) {
      issues.push({
        code: "SELF_PARENT",
        severity: "error",
        message: `${parentId} cannot be their own parent.`,
        personIds: [parentId],
      });
      continue;
    }
    if (!peopleById.has(parentId) || !peopleById.has(childId)) continue;
    const parents = parentEdges.get(childId) ?? new Set<string>();
    parents.add(parentId);
    parentEdges.set(childId, parents);

    for (const spouseId of peopleById.get(parentId)?.spouseIds ?? []) {
      if (spouseId === childId) {
        issues.push({
          code: "SELF_PARENT",
          severity: "error",
          message: `Spouse-derived parenthood would make ${childId} their own parent.`,
          personIds: [childId, parentId],
        });
      } else if (peopleById.has(spouseId)) {
        parents.add(spouseId);
      }
    }
  }

  const parentCycle = firstDirectedCycle([...peopleById.keys()], parentEdges);
  if (parentCycle) {
    issues.push({
      code: "PARENT_CYCLE",
      severity: "error",
      message: `Parent relationships contain a cycle: ${parentCycle.join(" -> ")}.`,
      personIds: parentCycle,
    });
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}

/**
 * Genealogical graph with a bounded BFS over parent, child, and spouse edges.
 * Supplemental sibling links exist only for adapting older project data; a
 * graph-native Person model derives B/Z through shared parents.
 */
export class FamilyTreeGraph {
  private readonly peopleById: Map<string, Person>;
  private readonly adjacency = new Map<string, GraphEdge[]>();
  private readonly olderThan = new Map<string, Set<string>>();
  private readonly parentsByChild = new Map<string, Set<string>>();
  private readonly validationReport: GraphValidationReport;

  constructor(
    people: readonly Person[],
    supplementalSiblings: readonly SupplementalSibling[] = [],
    supplementalParents: readonly SupplementalParent[] = [],
  ) {
    this.validationReport = validateFamilyGraphInput(
      people,
      supplementalSiblings,
      supplementalParents,
    );
    this.peopleById = new Map(people.map((person) => [person.id, person]));

    for (const person of people) {
      this.adjacency.set(person.id, []);
      this.olderThan.set(person.id, new Set());
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

    const siblingNeighbors = new Map<string, Set<string>>();
    for (const sibling of supplementalSiblings) {
      if (
        sibling.personAId === sibling.personBId ||
        !this.peopleById.has(sibling.personAId) ||
        !this.peopleById.has(sibling.personBId)
      ) {
        continue;
      }

      this.addSiblingNeighbor(
        siblingNeighbors,
        sibling.personAId,
        sibling.personBId,
      );
      this.addSiblingNeighbor(
        siblingNeighbors,
        sibling.personBId,
        sibling.personAId,
      );

      const bRelativeToA = sibling.personBRelativeAge ?? "unknown";
      if (bRelativeToA === "older") {
        this.olderThan.get(sibling.personBId)?.add(sibling.personAId);
      } else if (bRelativeToA === "younger") {
        this.olderThan.get(sibling.personAId)?.add(sibling.personBId);
      }
    }

    const siblingComponents = this.addSiblingComponentEdges(siblingNeighbors);
    this.propagateParentsAcrossSiblingComponents(siblingComponents);

    // BFS must not depend on the order in which source records were supplied.
    for (const edges of this.adjacency.values()) {
      edges.sort((left, right) =>
        left.step === right.step
          ? left.to.localeCompare(right.to)
          : left.step.localeCompare(right.step),
      );
    }
  }

  getPerson(id: string): Person | undefined {
    return this.peopleById.get(id);
  }

  getValidationReport(): GraphValidationReport {
    return {
      valid: this.validationReport.valid,
      issues: this.validationReport.issues.map((issue) => ({
        ...issue,
        personIds: [...issue.personIds],
      })),
    };
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
    const targetIsOlder = this.hasOlderPath(targetId, referenceId);
    const referenceIsOlder = this.hasOlderPath(referenceId, targetId);
    if (targetIsOlder && !referenceIsOlder) return "older";
    if (referenceIsOlder && !targetIsOlder) return "younger";
    if (targetIsOlder && referenceIsOlder) return "unknown";

    const reference = this.peopleById.get(referenceId);
    const target = this.peopleById.get(targetId);
    if (reference?.birthOrder !== undefined && target?.birthOrder !== undefined) {
      if (target.birthOrder < reference.birthOrder) return "older";
      if (target.birthOrder > reference.birthOrder) return "younger";
      return "same";
    }

    if (
      reference?.birthTimestamp !== undefined &&
      target?.birthTimestamp !== undefined
    ) {
      if (target.birthTimestamp < reference.birthTimestamp) return "older";
      if (target.birthTimestamp > reference.birthTimestamp) return "younger";
      return "same";
    }

    return "unknown";
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
          siblingSeniorities: [],
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
              siblingSeniorities: this.describeSiblingSeniorities(
                personIds,
                rawPath,
              ),
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

  /**
   * Preserve every sibling comparison represented by a raw traversal. This is
   * deliberately calculated before canonicalization so a long path can rank
   * the correct local sibling pair instead of reusing the first comparison.
   */
  describeSiblingSeniorities(
    personIds: readonly string[],
    rawPath: readonly KStep[],
  ): SiblingSenioritySegment[] {
    const segments: SiblingSenioritySegment[] = [];

    for (let index = 0; index < rawPath.length; index += 1) {
      const step = rawPath[index];
      if (step === "B" || step === "Z") {
        const referenceId = personIds[index];
        const relativeId = personIds[index + 1];
        if (referenceId && relativeId) {
          segments.push({
            rawStartIndex: index,
            rawEndIndex: index,
            referenceId,
            relativeId,
            relativeAge: this.relativeAge(referenceId, relativeId),
            source: "explicit-sibling-edge",
          });
        }
        continue;
      }

      const next = rawPath[index + 1];
      if (
        (step === "F" || step === "M") &&
        (next === "S" || next === "D")
      ) {
        const referenceId = personIds[index];
        const relativeId = personIds[index + 2];
        if (referenceId && relativeId) {
          segments.push({
            rawStartIndex: index,
            rawEndIndex: index + 1,
            referenceId,
            relativeId,
            relativeAge: this.relativeAge(referenceId, relativeId),
            source: "shared-parent-collapse",
          });
        }
        index += 1;
      }
    }

    return segments;
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
      this.addEdge(person.id, spouse.id, spouse.sex === "M" ? "H" : "W");
      // Marriage is intrinsically reciprocal. A single declaration must be
      // sufficient for BFS in either direction, including graph-native data
      // which has not passed through the application's relationship adapter.
      this.addEdge(spouse.id, person.id, person.sex === "M" ? "H" : "W");
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

  private addSiblingNeighbor(
    neighbors: Map<string, Set<string>>,
    fromId: string,
    toId: string,
  ) {
    const current = neighbors.get(fromId) ?? new Set<string>();
    current.add(toId);
    neighbors.set(fromId, current);
  }

  /**
   * Explicit siblinghood forms an equivalence group. Closing each connected
   * component into a clique keeps a sibling-of-sibling a direct sibling while
   * seniority remains a separate partial order.
   */
  private addSiblingComponentEdges(neighbors: Map<string, Set<string>>) {
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const personId of neighbors.keys()) {
      if (visited.has(personId)) continue;

      const component: string[] = [];
      const queue = [personId];
      visited.add(personId);

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const currentId = queue[cursor];
        component.push(currentId);
        for (const siblingId of neighbors.get(currentId) ?? []) {
          if (visited.has(siblingId)) continue;
          visited.add(siblingId);
          queue.push(siblingId);
        }
      }

      for (const fromId of component) {
        for (const toId of component) {
          if (fromId !== toId) this.addSiblingEdge(fromId, toId);
        }
      }

      components.push(component);
    }

    return components;
  }

  /**
   * Shona parenthood is classificatory and reciprocal across a sibling set:
   * every known parent of one sibling is a parent of the whole sibling group.
   * Spouses of explicit parents are already present in parentsByChild, so the
   * same propagation includes social mothers and fathers without storing
   * additional source relationships.
   */
  private propagateParentsAcrossSiblingComponents(
    components: readonly (readonly string[])[],
  ) {
    for (const component of components) {
      const parentIds = new Set<string>();
      for (const siblingId of component) {
        for (const parentId of this.parentsByChild.get(siblingId) ?? []) {
          parentIds.add(parentId);
        }
      }

      for (const siblingId of component) {
        for (const parentId of parentIds) {
          this.addParentChildEdges(parentId, siblingId);
        }
      }
    }
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

  private hasOlderPath(olderId: string, youngerId: string) {
    if (olderId === youngerId) return false;
    const queue = [...(this.olderThan.get(olderId) ?? [])];
    const visited = new Set<string>();

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const currentId = queue[cursor];
      if (currentId === youngerId) return true;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      queue.push(...(this.olderThan.get(currentId) ?? []));
    }

    return false;
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
