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
import { formatKinshipTitle } from "./kinship-title";
import type {
  KinshipResolution,
  KStep,
  Person,
  Sex,
} from "./model";

const toSex = (sex: LegacyPerson["sex"]): Sex => (sex === "male" ? "M" : "F");

function parseBirthTimestamp(dateOfBirth: string | undefined) {
  if (!dateOfBirth) return undefined;
  const timestamp = Date.parse(dateOfBirth);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function toEnginePeople(
  people: readonly LegacyPerson[],
  relationships: readonly Relationship[],
): Person[] {
  const enginePeople: Person[] = people.map((person) => ({
    id: person.id,
    sex: toSex(person.sex),
    spouseIds: [],
    birthTimestamp: parseBirthTimestamp(person.dateOfBirth),
  }));
  // Keep duplicate source records in the array so validation can report them;
  // the map is only an index for wiring relationship references.
  const peopleById = new Map(
    enginePeople.map((person) => [person.id, person]),
  );

  for (const relationship of relationships) {
    const personA = peopleById.get(relationship.personAId);
    const personB = peopleById.get(relationship.personBId);

    if (relationship.type === "SPOUSE_OF") {
      // Preserve a one-sided dangling reference so graph validation can report
      // it instead of silently dropping malformed application data.
      if (personA && !personA.spouseIds.includes(relationship.personBId)) {
        personA.spouseIds.push(relationship.personBId);
      }
      if (personB && !personB.spouseIds.includes(relationship.personAId)) {
        personB.spouseIds.push(relationship.personAId);
      }
    }
  }

  return enginePeople;
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
    title: formatKinshipTitle(resolution.title, resolution.aliases),
    description: resolution.description,
    aliases: resolution.aliases,
    socialTerm: resolution.socialTerm,
    socialDescription: resolution.socialDescription,
    path: toLegacyPath(resolution),
    ruleId: resolution.ruleId,
    specificity: resolution.specificity,
    kinClass: resolution.kinClass,
    coreClassifications: resolution.coreClassifications,
    provenance: resolution.provenance,
    validationIssues: resolution.validationIssues,
    possibilities: resolution.possibilities,
    canonicalSteps: resolution.reducedPath?.map((step) => rawStepToLegacy[step]),
    derivation: resolution.derivation,
  };
}

export interface KinshipSession {
  resolve(egoId: string, targetId: string): KinshipResult;
  validation: ReturnType<FamilyTreeGraph["getValidationReport"]>;
}

/**
 * Build one immutable graph and memoizing resolver for a family snapshot.
 * `SPOUSE_OF` means a culturally recognized union for kinship purposes;
 * `married` remains renderer metadata and does not gate affinal traversal.
 */
export function createKinshipSession(
  people: readonly LegacyPerson[],
  relationships: readonly Relationship[],
): KinshipSession {
  const graph = new FamilyTreeGraph(
    toEnginePeople(people, relationships),
    supplementalSiblings(relationships),
    supplementalParents(relationships),
  );
  const resolver = new KinshipResolver(graph);
  const peopleById = new Map(people.map((person) => [person.id, person]));

  return {
    validation: graph.getValidationReport(),
    resolve(egoId, targetId) {
      const ego = peopleById.get(egoId);
      const target = peopleById.get(targetId);
      return toLegacyResult(
        resolver.resolve({
          egoId,
          targetId,
          egoSex: ego ? toSex(ego.sex) : undefined,
          targetSex: target ? toSex(target.sex) : undefined,
        }),
      );
    },
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
  return createKinshipSession(people, relationships).resolve(egoId, targetId);
}
