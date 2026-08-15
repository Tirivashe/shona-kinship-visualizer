import { describe, expect, it } from "vitest";

import type { Relationship } from "@/types/family";

import {
  affectsFamilyLayout,
  isDottedParentChildRelationship,
  isVisibleFamilyRelationship,
} from "./family-map-relationships";

describe("family-map relationship visibility", () => {
  it("hides sibling edges while retaining sibling layout grouping", () => {
    const sibling: Relationship = {
      id: "siblings",
      type: "SIBLING_OF",
      personAId: "a",
      personBId: "b",
      seniority: "UNKNOWN",
    };

    expect(isVisibleFamilyRelationship(sibling)).toBe(false);
    expect(affectsFamilyLayout(sibling)).toBe(true);
  });

  it("shows biological and functional parenthood with distinct line styles", () => {
    const biologicalParent: Relationship = {
      id: "parent",
      type: "PARENT_OF",
      personAId: "parent",
      personBId: "child",
      biological: true,
    };
    const socialParent: Relationship = {
      ...biologicalParent,
      id: "social-parent",
      biological: false,
    };
    const marriage: Relationship = {
      id: "marriage",
      type: "SPOUSE_OF",
      personAId: "a",
      personBId: "b",
      married: true,
    };

    expect(isVisibleFamilyRelationship(biologicalParent)).toBe(true);
    expect(isDottedParentChildRelationship(biologicalParent)).toBe(false);
    expect(isVisibleFamilyRelationship(socialParent)).toBe(true);
    expect(isDottedParentChildRelationship(socialParent)).toBe(true);
    expect(isVisibleFamilyRelationship(marriage)).toBe(true);
  });
});
