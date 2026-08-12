import type {
  PathStep,
  Person,
  Relationship,
  RelationshipPath,
} from "@/types/family";

interface GraphEdge {
  to: string;
  step: PathStep;
}

type FamilyGraph = Map<string, GraphEdge[]>;

function siblingStep(
  sex: Person["sex"],
  seniority: "older" | "younger" | "unknown",
): PathStep {
  if (sex === "male") {
    if (seniority === "older") return "older_brother";
    if (seniority === "younger") return "younger_brother";
    return "brother";
  }

  if (seniority === "older") return "older_sister";
  if (seniority === "younger") return "younger_sister";

  return "sister";
}

export function buildFamilyGraph(
  people: Person[],
  relationships: Relationship[],
): FamilyGraph {
  const graph: FamilyGraph = new Map();

  const peopleById = new Map(people.map((person) => [person.id, person]));

  for (const person of people) {
    graph.set(person.id, []);
  }

  const addEdge = (from: string, to: string, step: PathStep) => {
    graph.get(from)?.push({ to, step });
  };

  for (const relationship of relationships) {
    const personA = peopleById.get(relationship.personAId);

    const personB = peopleById.get(relationship.personBId);

    if (!personA || !personB) continue;

    if (relationship.type === "PARENT_OF") {
      // Parent -> child
      addEdge(
        personA.id,
        personB.id,
        personB.sex === "male" ? "son" : "daughter",
      );

      // Child -> parent
      addEdge(
        personB.id,
        personA.id,
        personA.sex === "male" ? "father" : "mother",
      );
    }

    if (relationship.type === "SPOUSE_OF") {
      addEdge(
        personA.id,
        personB.id,
        personB.sex === "male" ? "husband" : "wife",
      );

      addEdge(
        personB.id,
        personA.id,
        personA.sex === "male" ? "husband" : "wife",
      );
    }

    if (relationship.type === "SIBLING_OF") {
      let aToBSeniority: "older" | "younger" | "unknown" = "unknown";

      let bToASeniority: "older" | "younger" | "unknown" = "unknown";

      if (relationship.seniority === "A_OLDER") {
        aToBSeniority = "younger";
        bToASeniority = "older";
      }

      if (relationship.seniority === "B_OLDER") {
        aToBSeniority = "older";
        bToASeniority = "younger";
      }

      addEdge(personA.id, personB.id, siblingStep(personB.sex, aToBSeniority));

      addEdge(personB.id, personA.id, siblingStep(personA.sex, bToASeniority));
    }
  }

  return graph;
}

export function findRelationshipPath(
  egoId: string,
  targetId: string,
  people: Person[],
  relationships: Relationship[],
): RelationshipPath | null {
  return (
    findRelationshipPaths(egoId, targetId, people, relationships)[0] ?? null
  );
}

/**
 * Return every equally-short relationship path.
 *
 * A family can connect two people through more than one branch. Keeping all
 * shortest paths lets the cultural resolver prefer a specific Shona rule
 * instead of depending on relationship insertion order.
 */
export function findRelationshipPaths(
  egoId: string,
  targetId: string,
  people: Person[],
  relationships: Relationship[],
  maxPaths = 64,
): RelationshipPath[] {
  if (egoId === targetId) {
    return [
      {
        personIds: [egoId],
        steps: [],
      },
    ];
  }

  const graph = buildFamilyGraph(people, relationships);

  const queue: RelationshipPath[] = [
    {
      personIds: [egoId],
      steps: [],
    },
  ];

  const bestDepthByPerson = new Map<string, number>([[egoId, 0]]);
  const matches: RelationshipPath[] = [];
  let shortestDepth: number | null = null;

  while (queue.length > 0 && matches.length < maxPaths) {
    const current = queue.shift();

    if (!current) break;

    if (shortestDepth !== null && current.steps.length >= shortestDepth) {
      continue;
    }

    const currentPersonId = current.personIds[current.personIds.length - 1];

    const neighbours = graph.get(currentPersonId) ?? [];

    for (const neighbour of neighbours) {
      if (current.personIds.includes(neighbour.to)) continue;

      const newPath: RelationshipPath = {
        personIds: [...current.personIds, neighbour.to],
        steps: [...current.steps, neighbour.step],
      };

      const newDepth = newPath.steps.length;
      const knownDepth = bestDepthByPerson.get(neighbour.to);

      if (knownDepth !== undefined && newDepth > knownDepth) continue;

      if (neighbour.to === targetId) {
        if (shortestDepth === null) shortestDepth = newDepth;

        if (newDepth === shortestDepth) matches.push(newPath);

        continue;
      }

      if (shortestDepth !== null && newDepth >= shortestDepth) continue;

      if (knownDepth === undefined) {
        bestDepthByPerson.set(neighbour.to, newDepth);
      }

      queue.push(newPath);
    }
  }

  const uniquePaths = new Map(
    matches.map((path) => [
      `${path.personIds.join(">")}|${path.steps.join(">")}`,
      path,
    ]),
  );

  return [...uniquePaths.values()];
}
