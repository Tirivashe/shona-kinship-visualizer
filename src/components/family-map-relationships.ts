import type { Relationship } from "@/types/family";

/** Relationships which should produce a visible edge in the family map. */
export function isVisibleFamilyRelationship(relationship: Relationship) {
  if (relationship.type === "SIBLING_OF") return false;
  if (relationship.type === "PARENT_OF") return true;
  return relationship.married === true;
}

/** Functional parent-child edges are visible but visually distinguished. */
export function isDottedParentChildRelationship(
  relationship: Relationship,
) {
  return (
    relationship.type === "PARENT_OF" && relationship.biological !== true
  );
}

/**
 * Sibling records still guide automatic placement even though their edges are
 * hidden. This keeps sibling groups near each other without cluttering the UI.
 */
export function affectsFamilyLayout(relationship: Relationship) {
  return (
    relationship.type === "SIBLING_OF" ||
    isVisibleFamilyRelationship(relationship)
  );
}
