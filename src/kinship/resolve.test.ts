import { describe, expect, it } from "vitest";

import { samplePeople, sampleRelationships } from "../data/sampleFamily";
import type { Person, Relationship } from "../types/family";

import { findRelationshipPath, findRelationshipPaths } from "./graph";
import { resolveKinship } from "./resolve";

const people: Person[] = [
  { id: "ego-m", firstName: "Ego", surname: "M", sex: "male", dateOfBirth: "2000-01-01" },
  { id: "ego-f", firstName: "Ego", surname: "F", sex: "female", dateOfBirth: "2000-01-01" },
  { id: "father", firstName: "Father", surname: "M", sex: "male" },
  { id: "mother", firstName: "Mother", surname: "M", sex: "female" },
  { id: "p-uncle-old", firstName: "Old", surname: "Uncle", sex: "male" },
  { id: "p-uncle-young", firstName: "Young", surname: "Uncle", sex: "male" },
  { id: "p-aunt", firstName: "Paternal", surname: "Aunt", sex: "female" },
  { id: "m-aunt-old", firstName: "Old", surname: "Aunt", sex: "female" },
  { id: "m-aunt-young", firstName: "Young", surname: "Aunt", sex: "female" },
  { id: "m-uncle", firstName: "Maternal", surname: "Uncle", sex: "male" },
  { id: "p-cousin-m", firstName: "Parallel", surname: "Male", sex: "male", dateOfBirth: "1998-01-01" },
  { id: "p-cousin-f", firstName: "Parallel", surname: "Female", sex: "female", dateOfBirth: "2002-01-01" },
  { id: "cross-p-m", firstName: "Cross", surname: "Paternal", sex: "male" },
  { id: "cross-m-m", firstName: "Cross", surname: "Maternal", sex: "male" },
  { id: "cross-m-f", firstName: "Cross", surname: "Maternal", sex: "female" },
  { id: "grandfather", firstName: "Grand", surname: "Father", sex: "male" },
  { id: "grandmother", firstName: "Grand", surname: "Mother", sex: "female" },
  { id: "wife", firstName: "Wife", surname: "W", sex: "female" },
  { id: "wife-father", firstName: "Wife", surname: "Father", sex: "male" },
  { id: "wife-brother", firstName: "Wife", surname: "Brother", sex: "male" },
  { id: "husband", firstName: "Husband", surname: "H", sex: "male" },
  { id: "husband-mother", firstName: "Husband", surname: "Mother", sex: "female" },
  { id: "daughter", firstName: "Daughter", surname: "M", sex: "female" },
  { id: "son-in-law", firstName: "Son", surname: "Law", sex: "male" },
  { id: "son", firstName: "Son", surname: "M", sex: "male" },
  { id: "daughter-in-law", firstName: "Daughter", surname: "Law", sex: "female" },
  { id: "grandchild", firstName: "Grand", surname: "Child", sex: "female" },
  { id: "great-grandchild", firstName: "Great", surname: "Grandchild", sex: "male" },
  { id: "ancestor", firstName: "Ancestor", surname: "M", sex: "male" },
];

const relationships: Relationship[] = [
  { id: "father-ego-m", type: "PARENT_OF", personAId: "father", personBId: "ego-m" },
  { id: "mother-ego-m", type: "PARENT_OF", personAId: "mother", personBId: "ego-m" },
  { id: "father-ego-f", type: "PARENT_OF", personAId: "father", personBId: "ego-f" },
  { id: "mother-ego-f", type: "PARENT_OF", personAId: "mother", personBId: "ego-f" },
  { id: "p-old-father", type: "SIBLING_OF", personAId: "p-uncle-old", personBId: "father", seniority: "A_OLDER" },
  { id: "p-young-father", type: "SIBLING_OF", personAId: "p-uncle-young", personBId: "father", seniority: "B_OLDER" },
  { id: "p-aunt-father", type: "SIBLING_OF", personAId: "p-aunt", personBId: "father", seniority: "UNKNOWN" },
  { id: "m-old-mother", type: "SIBLING_OF", personAId: "m-aunt-old", personBId: "mother", seniority: "A_OLDER" },
  { id: "m-young-mother", type: "SIBLING_OF", personAId: "m-aunt-young", personBId: "mother", seniority: "B_OLDER" },
  { id: "m-uncle-mother", type: "SIBLING_OF", personAId: "m-uncle", personBId: "mother", seniority: "UNKNOWN" },
  { id: "p-old-cousin-m", type: "PARENT_OF", personAId: "p-uncle-old", personBId: "p-cousin-m" },
  { id: "p-old-cousin-f", type: "PARENT_OF", personAId: "p-uncle-old", personBId: "p-cousin-f" },
  { id: "p-aunt-cross", type: "PARENT_OF", personAId: "p-aunt", personBId: "cross-p-m" },
  { id: "m-uncle-cross-m", type: "PARENT_OF", personAId: "m-uncle", personBId: "cross-m-m" },
  { id: "m-uncle-cross-f", type: "PARENT_OF", personAId: "m-uncle", personBId: "cross-m-f" },
  { id: "grandfather-father", type: "PARENT_OF", personAId: "grandfather", personBId: "father" },
  { id: "grandmother-father", type: "PARENT_OF", personAId: "grandmother", personBId: "father" },
  { id: "wife-ego", type: "SPOUSE_OF", personAId: "ego-m", personBId: "wife" },
  { id: "wife-father-wife", type: "PARENT_OF", personAId: "wife-father", personBId: "wife" },
  { id: "wife-brother-wife", type: "SIBLING_OF", personAId: "wife-brother", personBId: "wife", seniority: "UNKNOWN" },
  { id: "husband-ego", type: "SPOUSE_OF", personAId: "ego-f", personBId: "husband" },
  { id: "husband-mother-husband", type: "PARENT_OF", personAId: "husband-mother", personBId: "husband" },
  { id: "ego-daughter", type: "PARENT_OF", personAId: "ego-m", personBId: "daughter" },
  { id: "daughter-husband", type: "SPOUSE_OF", personAId: "daughter", personBId: "son-in-law" },
  { id: "ego-son", type: "PARENT_OF", personAId: "ego-m", personBId: "son" },
  { id: "son-wife", type: "SPOUSE_OF", personAId: "son", personBId: "daughter-in-law" },
  { id: "daughter-grandchild", type: "PARENT_OF", personAId: "daughter", personBId: "grandchild" },
  { id: "grandchild-great", type: "PARENT_OF", personAId: "grandchild", personBId: "great-grandchild" },
  { id: "ancestor-grandfather", type: "PARENT_OF", personAId: "ancestor", personBId: "grandfather" },
];

function title(egoId: string, targetId: string) {
  return resolveKinship(egoId, targetId, people, relationships).title;
}

describe("kinship graph", () => {
  it("finds the sample path from Tapiwa to Farai", () => {
    expect(
      findRelationshipPath(
        "tapiwa",
        "farai",
        samplePeople,
        sampleRelationships,
      )?.steps,
    ).toEqual(["father", "older_brother"]);
  });

  it("returns all equally short paths", () => {
    const diamondPeople: Person[] = [
      { id: "a", firstName: "A", surname: "", sex: "male" },
      { id: "b", firstName: "B", surname: "", sex: "male" },
      { id: "c", firstName: "C", surname: "", sex: "female" },
      { id: "d", firstName: "D", surname: "", sex: "male" },
    ];
    const diamondRelationships: Relationship[] = [
      { id: "ab", type: "PARENT_OF", personAId: "a", personBId: "b" },
      { id: "ac", type: "PARENT_OF", personAId: "a", personBId: "c" },
      { id: "bd", type: "PARENT_OF", personAId: "b", personBId: "d" },
      { id: "cd", type: "PARENT_OF", personAId: "c", personBId: "d" },
    ];

    expect(
      findRelationshipPaths("d", "a", diamondPeople, diamondRelationships),
    ).toHaveLength(2);
  });
});

describe("guide-derived Shona rules", () => {
  it.each([
    ["father", "Baba"],
    ["mother", "Mai"],
    ["p-uncle-old", "Bamkuru"],
    ["p-uncle-young", "Bamnini"],
    ["p-aunt", "Tete"],
    ["m-aunt-old", "Maiguru"],
    ["m-aunt-young", "Mainini"],
    ["m-uncle", "Sekuru"],
    ["grandfather", "Sekuru"],
    ["grandmother", "Ambuya"],
  ])("resolves direct and parent-sibling rule for %s", (targetId, expected) => {
    expect(title("ego-m", targetId)).toBe(expected);
  });

  it("uses ego and target sex for sibling terminology", () => {
    expect(title("ego-m", "ego-f")).toBe("Hanzvadzi");
    expect(title("ego-m", "p-cousin-m")).toBe("Mukoma");
    expect(title("ego-m", "p-cousin-f")).toBe("Hanzvadzi");
    expect(title("ego-f", "p-cousin-f")).toBe("Munin'ina");
  });

  it("applies paternal-aunt cross-cousin exceptions by ego sex", () => {
    expect(title("ego-m", "cross-p-m")).toBe("Muzukuru");
    expect(title("ego-f", "cross-p-m")).toBe("Mwana");
  });

  it("applies maternal-uncle cross-cousin exceptions for a male ego", () => {
    expect(title("ego-m", "cross-m-m")).toBe("Sekuru");
    expect(title("ego-m", "cross-m-f")).toBe("Mainini");
  });

  it("keeps the guide's missing female-ego cross-cousin case unmapped", () => {
    expect(resolveKinship("ego-f", "cross-m-m", people, relationships).status).toBe(
      "unmapped",
    );
  });

  it("resolves affinal terms and exposes the guide's overlap", () => {
    expect(title("ego-m", "wife-father")).toBe("Tezvara");
    expect(title("ego-f", "husband-mother")).toBe("Vamwene");
    expect(title("ego-m", "daughter-in-law")).toBe("Muroora");
    expect(title("ego-m", "son-in-law")).toBe("Mukuwasha");

    const wifeBrother = resolveKinship(
      "ego-m",
      "wife-brother",
      people,
      relationships,
    );
    expect(wifeBrother.status).toBe("contextual");
    expect(wifeBrother.possibilities).toEqual(["Tsano", "Tezvara"]);
  });

  it("resolves descendants and distant male ancestors", () => {
    expect(title("ego-m", "daughter")).toBe("Mwana");
    expect(title("ego-m", "grandchild")).toBe("Muzukuru");
    expect(title("ego-m", "great-grandchild")).toBe("Chizukuruchibvi");
    expect(title("ego-m", "ancestor")).toBe("Tateguru");
  });

  it("preserves aliases and rule provenance", () => {
    const mother = resolveKinship("ego-m", "mother", people, relationships);
    expect(mother.ruleId).toBe("MOTHER");
    expect(mother.aliases).toContain("Amai");
  });
});
