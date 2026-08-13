import type {
  KinshipResult,
  PathStep,
  Person as LegacyPerson,
  Relationship,
  RelationshipPath,
} from "@/types/family";

import {
  FamilyTreeGraph,
  type SupplementalParent,
  type SupplementalSibling,
} from "./family-tree-graph";
import { KinshipResolver } from "./kinship-resolver";
import type {
  KinshipResolution,
  KStep,
  Person,
  RelativeAge,
  Sex,
} from "./model";

const toSex = (sex: LegacyPerson["sex"]): Sex => (sex === "male" ? "M" : "F");

function toEnginePeople(
  people: readonly LegacyPerson[],
  relationships: readonly Relationship[],
): Person[] {
  const enginePeople = new Map<string, Person>(
    people.map((person) => [
      person.id,
      {
        id: person.id,
        sex: toSex(person.sex),
        spouseIds: [],
        birthOrder: person.dateOfBirth
          ? Date.parse(person.dateOfBirth)
          : undefined,
      },
    ]),
  );

  for (const relationship of relationships) {
    const personA = enginePeople.get(relationship.personAId);
    const personB = enginePeople.get(relationship.personBId);
    if (!personA || !personB) continue;

    if (relationship.type === "SPOUSE_OF") {
      if (!personA.spouseIds.includes(personB.id)) personA.spouseIds.push(personB.id);
      if (!personB.spouseIds.includes(personA.id)) personB.spouseIds.push(personA.id);
    }
  }

  return [...enginePeople.values()];
}

function supplementalParents(
  relationships: readonly Relationship[],
): SupplementalParent[] {
  return relationships
    .filter((relationship) => relationship.type === "PARENT_OF")
    .map((relationship) => ({
      parentId: relationship.personAId,
      childId: relationship.personBId,
    }));
}

function supplementalSiblings(
  relationships: readonly Relationship[],
): SupplementalSibling[] {
  return relationships
    .filter((relationship) => relationship.type === "SIBLING_OF")
    .map((relationship) => ({
      personAId: relationship.personAId,
      personBId: relationship.personBId,
      personBRelativeAge:
        relationship.seniority === "A_OLDER"
          ? ("younger" as const)
          : relationship.seniority === "B_OLDER"
            ? ("older" as const)
            : ("unknown" as const),
    }));
}

function targetRelativeAge(
  egoId: string,
  targetId: string,
  people: readonly LegacyPerson[],
  relationships: readonly Relationship[],
): RelativeAge {
  const seniority = relationships.find(
    (relationship) =>
      relationship.type === "SIBLING_OF" &&
      ((relationship.personAId === egoId &&
        relationship.personBId === targetId) ||
        (relationship.personAId === targetId &&
          relationship.personBId === egoId)),
  );

  if (seniority?.type === "SIBLING_OF") {
    if (seniority.seniority === "UNKNOWN") return "unknown";
    const targetIsA = seniority.personAId === targetId;
    const targetIsOlder =
      (targetIsA && seniority.seniority === "A_OLDER") ||
      (!targetIsA && seniority.seniority === "B_OLDER");
    return targetIsOlder ? "older" : "younger";
  }

  const ego = people.find((person) => person.id === egoId);
  const target = people.find((person) => person.id === targetId);
  if (!ego?.dateOfBirth || !target?.dateOfBirth) return "unknown";
  const egoBirth = Date.parse(ego.dateOfBirth);
  const targetBirth = Date.parse(target.dateOfBirth);
  if (Number.isNaN(egoBirth) || Number.isNaN(targetBirth)) return "unknown";
  if (targetBirth < egoBirth) return "older";
  if (targetBirth > egoBirth) return "younger";
  return "same";
}

const rawStepToLegacy: Record<KStep, PathStep> = {
  F: "father",
  M: "mother",
  S: "son",
  D: "daughter",
  H: "husband",
  W: "wife",
  B: "brother",
  Z: "sister",
};

function toLegacyPath(resolution: KinshipResolution): RelationshipPath | undefined {
  if (!resolution.traversal) return undefined;
  return {
    personIds: resolution.traversal.personIds,
    steps: resolution.traversal.rawPath.map((step) => rawStepToLegacy[step]),
  };
}

function toLegacyResult(resolution: KinshipResolution): KinshipResult {
  return {
    status:
      resolution.status === "ambiguous" ? "ambiguous" : resolution.status,
    title: resolution.title,
    description: resolution.description,
    path: toLegacyPath(resolution),
    ruleId: resolution.ruleId,
    possibilities: resolution.possibilities,
    canonicalSteps: resolution.reducedPath?.map((step) => rawStepToLegacy[step]),
    derivation: resolution.derivation,
  };
}

/**
 * UI-compatible façade. New code should instantiate FamilyTreeGraph and
 * KinshipResolver directly with graph-native Person records.
 */
export function resolveKinship(
  egoId: string,
  targetId: string,
  people: LegacyPerson[],
  relationships: Relationship[],
): KinshipResult {
  const graph = new FamilyTreeGraph(
    toEnginePeople(people, relationships),
    supplementalSiblings(relationships),
    supplementalParents(relationships),
  );
  const resolver = new KinshipResolver(graph);
  const ego = people.find((person) => person.id === egoId);
  const target = people.find((person) => person.id === targetId);

  return toLegacyResult(
    resolver.resolve({
      egoId,
      targetId,
      egoSex: ego ? toSex(ego.sex) : undefined,
      targetSex: target ? toSex(target.sex) : undefined,
      relativeAge: targetRelativeAge(egoId, targetId, people, relationships),
    }),
  );
}
