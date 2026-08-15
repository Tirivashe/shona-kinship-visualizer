import { describe, expect, it } from "vitest";

import type { Relationship } from "@/types/family";

import { deriveFamilyUnions } from "./family-unions";

const BIOLOGICAL_UNION_ID = "biological-union:father:mother";

describe("deriveFamilyUnions", () => {
  it("consolidates shared biological children without requiring marriage", () => {
    const relationships: Relationship[] = [
      {
        id: "mother-child-a",
        type: "PARENT_OF",
        personAId: "mother",
        personBId: "child-a",
        biological: true,
        biologicalUnionId: BIOLOGICAL_UNION_ID,
      },
      {
        id: "father-child-a",
        type: "PARENT_OF",
        personAId: "father",
        personBId: "child-a",
        biological: true,
        biologicalUnionId: BIOLOGICAL_UNION_ID,
      },
      {
        id: "mother-child-b",
        type: "PARENT_OF",
        personAId: "mother",
        personBId: "child-b",
        biological: true,
        biologicalUnionId: BIOLOGICAL_UNION_ID,
      },
      {
        id: "father-child-b",
        type: "PARENT_OF",
        personAId: "father",
        personBId: "child-b",
        biological: true,
        biologicalUnionId: BIOLOGICAL_UNION_ID,
      },
    ];

    expect(deriveFamilyUnions(relationships)).toEqual([
      {
        id: BIOLOGICAL_UNION_ID,
        personAId: "mother",
        personBId: "father",
        spouseRelationshipId: undefined,
        married: false,
        childIds: ["child-a", "child-b"],
        parentRelationshipIds: [
          "mother-child-a",
          "father-child-a",
          "mother-child-b",
          "father-child-b",
        ],
      },
    ]);
  });

  it("combines marriage and biological parenthood for the same pair", () => {
    const relationships: Relationship[] = [
      {
        id: "marriage",
        type: "SPOUSE_OF",
        personAId: "mother",
        personBId: "father",
        married: true,
      },
      {
        id: "mother-child",
        type: "PARENT_OF",
        personAId: "mother",
        personBId: "child",
        biological: true,
        biologicalUnionId: BIOLOGICAL_UNION_ID,
      },
      {
        id: "father-child",
        type: "PARENT_OF",
        personAId: "father",
        personBId: "child",
        biological: true,
        biologicalUnionId: BIOLOGICAL_UNION_ID,
      },
    ];

    expect(deriveFamilyUnions(relationships)[0]).toMatchObject({
      id: BIOLOGICAL_UNION_ID,
      spouseRelationshipId: "marriage",
      married: true,
      childIds: ["child"],
    });
  });

  it("represents married spouses even when they have no biological children", () => {
    const relationships: Relationship[] = [
      {
        id: "marriage",
        type: "SPOUSE_OF",
        personAId: "person-a",
        personBId: "person-b",
        married: true,
      },
    ];

    expect(deriveFamilyUnions(relationships)).toEqual([
      {
        id: "marriage-junction-marriage",
        personAId: "person-a",
        personBId: "person-b",
        spouseRelationshipId: "marriage",
        married: true,
        childIds: [],
        parentRelationshipIds: [],
      },
    ]);
  });

  it("does not draw an unmarried spouse pair or unqualified parent links", () => {
    const relationships: Relationship[] = [
      {
        id: "partners",
        type: "SPOUSE_OF",
        personAId: "person-a",
        personBId: "person-b",
        married: false,
      },
      {
        id: "non-biological-parent",
        type: "PARENT_OF",
        personAId: "person-a",
        personBId: "child",
        biological: false,
      },
    ];

    expect(deriveFamilyUnions(relationships)).toEqual([]);
  });
});
