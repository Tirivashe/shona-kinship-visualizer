import type { Relationship } from "@/types/family";

type ParentRelationship = Extract<Relationship, { type: "PARENT_OF" }>;
type SpouseRelationship = Extract<Relationship, { type: "SPOUSE_OF" }>;

export interface FamilyUnion {
  id: string;
  personAId: string;
  personBId: string;
  spouseRelationshipId?: string;
  married: boolean;
  childIds: string[];
  parentRelationshipIds: string[];
}

interface BiologicalUnionGroup {
  id: string;
  parentIds: [string, string];
  childIds: string[];
  parentRelationshipIds: string[];
}

function personPairKey(personAId: string, personBId: string) {
  return [personAId, personBId].sort().join("\u0000");
}

function collectBiologicalUnionGroups(
  relationships: readonly Relationship[],
) {
  const relationshipsByUnion = new Map<string, ParentRelationship[]>();

  for (const relationship of relationships) {
    if (
      relationship.type !== "PARENT_OF" ||
      relationship.biological !== true ||
      !relationship.biologicalUnionId
    ) {
      continue;
    }
    const unionRelationships =
      relationshipsByUnion.get(relationship.biologicalUnionId) ?? [];
    unionRelationships.push(relationship);
    relationshipsByUnion.set(
      relationship.biologicalUnionId,
      unionRelationships,
    );
  }

  const groupsByParentPair = new Map<string, BiologicalUnionGroup>();
  for (const [unionId, unionRelationships] of relationshipsByUnion) {
    const parentIds = [
      ...new Set(
        unionRelationships.map((relationship) => relationship.personAId),
      ),
    ];
    if (parentIds.length !== 2) continue;

    const relationshipsByChild = new Map<string, ParentRelationship[]>();
    for (const relationship of unionRelationships) {
      const childRelationships =
        relationshipsByChild.get(relationship.personBId) ?? [];
      childRelationships.push(relationship);
      relationshipsByChild.set(relationship.personBId, childRelationships);
    }

    const completeChildren = [...relationshipsByChild.entries()].filter(
      ([, childRelationships]) => {
        const linkedParents = new Set(
          childRelationships.map((relationship) => relationship.personAId),
        );
        return parentIds.every((parentId) => linkedParents.has(parentId));
      },
    );
    if (completeChildren.length === 0) continue;

    groupsByParentPair.set(personPairKey(parentIds[0], parentIds[1]), {
      id: unionId,
      parentIds: [parentIds[0], parentIds[1]],
      childIds: completeChildren.map(([childId]) => childId),
      parentRelationshipIds: completeChildren.flatMap(
        ([, childRelationships]) =>
          childRelationships.map((relationship) => relationship.id),
      ),
    });
  }

  return groupsByParentPair;
}

/**
 * Biological co-parent unions and marriages are independent facts. A pair is
 * represented when it shares biological children, is explicitly married, or
 * both. The renderer can therefore consolidate biological child branches
 * without implying marriage and draw marriage without implying parenthood.
 */
export function deriveFamilyUnions(
  relationships: readonly Relationship[],
): FamilyUnion[] {
  const biologicalGroups = collectBiologicalUnionGroups(relationships);
  const spouseByParentPair = new Map<string, SpouseRelationship>();

  for (const relationship of relationships) {
    if (relationship.type !== "SPOUSE_OF") continue;
    spouseByParentPair.set(
      personPairKey(relationship.personAId, relationship.personBId),
      relationship,
    );
  }

  const unions: FamilyUnion[] = [];
  const representedPairs = new Set<string>();

  for (const [pairKey, biologicalGroup] of biologicalGroups) {
    const spouse = spouseByParentPair.get(pairKey);
    unions.push({
      id: biologicalGroup.id,
      personAId: biologicalGroup.parentIds[0],
      personBId: biologicalGroup.parentIds[1],
      spouseRelationshipId: spouse?.id,
      married: spouse?.married === true,
      childIds: biologicalGroup.childIds,
      parentRelationshipIds: biologicalGroup.parentRelationshipIds,
    });
    representedPairs.add(pairKey);
  }

  for (const [pairKey, spouse] of spouseByParentPair) {
    if (spouse.married !== true || representedPairs.has(pairKey)) continue;
    unions.push({
      id: `marriage-junction-${spouse.id}`,
      personAId: spouse.personAId,
      personBId: spouse.personBId,
      spouseRelationshipId: spouse.id,
      married: true,
      childIds: [],
      parentRelationshipIds: [],
    });
  }

  return unions;
}
