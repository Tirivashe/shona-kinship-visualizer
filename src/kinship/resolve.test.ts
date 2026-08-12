import { describe, expect, it } from "vitest";

import { samplePeople, sampleRelationships } from "../data/sampleFamily";
import type { Person, Relationship } from "../types/family";

import { findRelationshipPath, findRelationshipPaths } from "./graph";
import { resolveKinship } from "./resolve";

const people: Person[] = [
  {
    id: "ego-m",
    firstName: "Ego",
    surname: "M",
    sex: "male",
    dateOfBirth: "2000-01-01",
  },
  {
    id: "ego-f",
    firstName: "Ego",
    surname: "F",
    sex: "female",
    dateOfBirth: "2000-01-01",
  },
  { id: "father", firstName: "Father", surname: "M", sex: "male" },
  { id: "mother", firstName: "Mother", surname: "M", sex: "female" },
  { id: "p-uncle-old", firstName: "Old", surname: "Uncle", sex: "male" },
  { id: "p-uncle-young", firstName: "Young", surname: "Uncle", sex: "male" },
  { id: "p-uncle-old-wife", firstName: "Old Uncle", surname: "Wife", sex: "female" },
  { id: "p-uncle-young-wife", firstName: "Young Uncle", surname: "Wife", sex: "female" },
  { id: "p-aunt", firstName: "Paternal", surname: "Aunt", sex: "female" },
  { id: "m-aunt-old", firstName: "Old", surname: "Aunt", sex: "female" },
  { id: "m-aunt-young", firstName: "Young", surname: "Aunt", sex: "female" },
  { id: "m-aunt-old-husband", firstName: "Old Aunt", surname: "Husband", sex: "male" },
  { id: "m-aunt-young-husband", firstName: "Young Aunt", surname: "Husband", sex: "male" },
  { id: "m-uncle", firstName: "Maternal", surname: "Uncle", sex: "male" },
  {
    id: "p-cousin-m",
    firstName: "Parallel",
    surname: "Male",
    sex: "male",
    dateOfBirth: "1998-01-01",
  },
  {
    id: "p-cousin-f",
    firstName: "Parallel",
    surname: "Female",
    sex: "female",
    dateOfBirth: "2002-01-01",
  },
  { id: "p-uncle-wife", firstName: "Uncle's", surname: "Wife", sex: "female" },
  {
    id: "p-uncle-wife-brother",
    firstName: "Wife's",
    surname: "Brother",
    sex: "male",
  },
  { id: "deep-relative", firstName: "Deep", surname: "Relative", sex: "male" },
  { id: "cross-p-m", firstName: "Cross", surname: "Paternal", sex: "male" },
  { id: "cross-m-m", firstName: "Cross", surname: "Maternal", sex: "male" },
  { id: "cross-m-f", firstName: "Cross", surname: "Maternal", sex: "female" },
  { id: "grandfather", firstName: "Grand", surname: "Father", sex: "male" },
  { id: "grandmother", firstName: "Grand", surname: "Mother", sex: "female" },
  { id: "wife", firstName: "Wife", surname: "W", sex: "female" },
  { id: "wife-father", firstName: "Wife", surname: "Father", sex: "male" },
  { id: "wife-brother", firstName: "Wife", surname: "Brother", sex: "male" },
  { id: "husband", firstName: "Husband", surname: "H", sex: "male" },
  {
    id: "husband-mother",
    firstName: "Husband",
    surname: "Mother",
    sex: "female",
  },
  { id: "daughter", firstName: "Daughter", surname: "M", sex: "female" },
  { id: "son-in-law", firstName: "Son", surname: "Law", sex: "male" },
  { id: "son", firstName: "Son", surname: "M", sex: "male" },
  {
    id: "younger-brother",
    firstName: "Younger",
    surname: "Brother",
    sex: "male",
  },
  {
    id: "younger-brother-son",
    firstName: "Brother's",
    surname: "Son",
    sex: "male",
  },
  {
    id: "daughter-in-law",
    firstName: "Daughter",
    surname: "Law",
    sex: "female",
  },
  { id: "grandchild", firstName: "Grand", surname: "Child", sex: "female" },
  {
    id: "great-grandchild",
    firstName: "Great",
    surname: "Grandchild",
    sex: "male",
  },
  { id: "ancestor", firstName: "Ancestor", surname: "M", sex: "male" },
];

const relationships: Relationship[] = [
  {
    id: "father-ego-m",
    type: "PARENT_OF",
    personAId: "father",
    personBId: "ego-m",
  },
  {
    id: "mother-ego-m",
    type: "PARENT_OF",
    personAId: "mother",
    personBId: "ego-m",
  },
  {
    id: "father-ego-f",
    type: "PARENT_OF",
    personAId: "father",
    personBId: "ego-f",
  },
  {
    id: "mother-ego-f",
    type: "PARENT_OF",
    personAId: "mother",
    personBId: "ego-f",
  },
  {
    id: "p-old-father",
    type: "SIBLING_OF",
    personAId: "p-uncle-old",
    personBId: "father",
    seniority: "A_OLDER",
  },
  {
    id: "p-young-father",
    type: "SIBLING_OF",
    personAId: "p-uncle-young",
    personBId: "father",
    seniority: "B_OLDER",
  },
  {
    id: "p-aunt-father",
    type: "SIBLING_OF",
    personAId: "p-aunt",
    personBId: "father",
    seniority: "UNKNOWN",
  },
  {
    id: "p-old-uncle-marriage",
    type: "SPOUSE_OF",
    personAId: "p-uncle-old",
    personBId: "p-uncle-old-wife",
  },
  {
    id: "p-young-uncle-marriage",
    type: "SPOUSE_OF",
    personAId: "p-uncle-young",
    personBId: "p-uncle-young-wife",
  },
  {
    id: "m-old-mother",
    type: "SIBLING_OF",
    personAId: "m-aunt-old",
    personBId: "mother",
    seniority: "A_OLDER",
  },
  {
    id: "m-young-mother",
    type: "SIBLING_OF",
    personAId: "m-aunt-young",
    personBId: "mother",
    seniority: "B_OLDER",
  },
  {
    id: "m-uncle-mother",
    type: "SIBLING_OF",
    personAId: "m-uncle",
    personBId: "mother",
    seniority: "B_OLDER",
  },
  {
    id: "m-old-aunt-marriage",
    type: "SPOUSE_OF",
    personAId: "m-aunt-old",
    personBId: "m-aunt-old-husband",
  },
  {
    id: "m-young-aunt-marriage",
    type: "SPOUSE_OF",
    personAId: "m-aunt-young",
    personBId: "m-aunt-young-husband",
  },
  {
    id: "p-old-cousin-m",
    type: "PARENT_OF",
    personAId: "p-uncle-old",
    personBId: "p-cousin-m",
  },
  {
    id: "p-uncle-wife-cousin-m",
    type: "PARENT_OF",
    personAId: "p-uncle-wife",
    personBId: "p-cousin-m",
  },
  {
    id: "wife-brother-sibling",
    type: "SIBLING_OF",
    personAId: "p-uncle-wife",
    personBId: "p-uncle-wife-brother",
    seniority: "A_OLDER",
  },
  {
    id: "wife-brother-deep-relative",
    type: "PARENT_OF",
    personAId: "p-uncle-wife-brother",
    personBId: "deep-relative",
  },
  {
    id: "p-old-cousin-f",
    type: "PARENT_OF",
    personAId: "p-uncle-old",
    personBId: "p-cousin-f",
  },
  {
    id: "p-aunt-cross",
    type: "PARENT_OF",
    personAId: "p-aunt",
    personBId: "cross-p-m",
  },
  {
    id: "m-uncle-cross-m",
    type: "PARENT_OF",
    personAId: "m-uncle",
    personBId: "cross-m-m",
  },
  {
    id: "m-uncle-cross-f",
    type: "PARENT_OF",
    personAId: "m-uncle",
    personBId: "cross-m-f",
  },
  {
    id: "grandfather-father",
    type: "PARENT_OF",
    personAId: "grandfather",
    personBId: "father",
  },
  {
    id: "grandmother-father",
    type: "PARENT_OF",
    personAId: "grandmother",
    personBId: "father",
  },
  { id: "wife-ego", type: "SPOUSE_OF", personAId: "ego-m", personBId: "wife" },
  {
    id: "wife-father-wife",
    type: "PARENT_OF",
    personAId: "wife-father",
    personBId: "wife",
  },
  {
    id: "wife-brother-wife",
    type: "SIBLING_OF",
    personAId: "wife-brother",
    personBId: "wife",
    seniority: "UNKNOWN",
  },
  {
    id: "husband-ego",
    type: "SPOUSE_OF",
    personAId: "ego-f",
    personBId: "husband",
  },
  {
    id: "husband-mother-husband",
    type: "PARENT_OF",
    personAId: "husband-mother",
    personBId: "husband",
  },
  {
    id: "ego-daughter",
    type: "PARENT_OF",
    personAId: "ego-m",
    personBId: "daughter",
  },
  {
    id: "daughter-husband",
    type: "SPOUSE_OF",
    personAId: "daughter",
    personBId: "son-in-law",
  },
  { id: "ego-son", type: "PARENT_OF", personAId: "ego-m", personBId: "son" },
  {
    id: "ego-younger-brother",
    type: "SIBLING_OF",
    personAId: "ego-m",
    personBId: "younger-brother",
    seniority: "A_OLDER",
  },
  {
    id: "younger-brother-his-son",
    type: "PARENT_OF",
    personAId: "younger-brother",
    personBId: "younger-brother-son",
  },
  {
    id: "son-wife",
    type: "SPOUSE_OF",
    personAId: "son",
    personBId: "daughter-in-law",
  },
  {
    id: "daughter-grandchild",
    type: "PARENT_OF",
    personAId: "daughter",
    personBId: "grandchild",
  },
  {
    id: "grandchild-great",
    type: "PARENT_OF",
    personAId: "grandchild",
    personBId: "great-grandchild",
  },
  {
    id: "ancestor-grandfather",
    type: "PARENT_OF",
    personAId: "ancestor",
    personBId: "grandfather",
  },
];

function title(egoId: string, targetId: string) {
  return resolveKinship(egoId, targetId, people, relationships).title;
}

describe("kinship graph", () => {
  it("finds a paternal-uncle path in the current sample family", () => {
    expect(
      findRelationshipPath("tiri", "tawanda", samplePeople, sampleRelationships)
        ?.steps,
    ).toEqual(["father", "younger_brother"]);
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

  it("resolves mother's younger brother as Sekuru", () => {
    const result = resolveKinship("ego-m", "m-uncle", people, relationships);

    expect(result.path?.steps).toEqual(["mother", "younger_brother"]);
    expect(result.canonicalSteps).toEqual(["mother", "younger_brother"]);
    expect(result.status).toBe("known");
    expect(result.title).toBe("Sekuru");
    expect(result.ruleId).toBe("MATERNAL_UNCLE");
  });

  it("uses ego and target sex for sibling terminology", () => {
    expect(title("ego-m", "ego-f")).toBe("Hanzvadzi");
    expect(title("ego-m", "p-cousin-m")).toBe("Mukoma");
    expect(title("ego-m", "p-cousin-f")).toBe("Hanzvadzi");
    expect(title("ego-f", "p-cousin-f")).toBe("Munin'ina");
  });

  it("deduces a younger brother's son as a social child", () => {
    const result = resolveKinship(
      "ego-m",
      "younger-brother-son",
      people,
      relationships,
    );

    expect(result.path?.steps).toEqual(["younger_brother", "son"]);
    expect(result.status).toBe("known");
    expect(result.title).toBe("Mwana");
    expect(result.ruleId).toBe("CHILD");
    expect(result.canonicalSteps).toEqual(["son"]);
    expect(result.derivation).toEqual([
      "A same-sex sibling's child belongs to ego's social child category.",
    ]);
  });

  it("infers a deep kinship through reusable social-equivalence rules", () => {
    const result = resolveKinship(
      "ego-m",
      "deep-relative",
      people,
      relationships,
    );

    expect(result.path?.steps).toEqual([
      "father",
      "older_brother",
      "son",
      "mother",
      "younger_brother",
      "son",
    ]);
    expect(result.canonicalSteps).toEqual(["mother", "younger_brother", "son"]);
    expect(result.title).toBe("Sekuru");
    expect(result.ruleId).toBe("MATERNAL_UNCLE_SON_MALE_EGO");
    expect(result.derivation).toEqual([
      "A father's older brother is Bamkuru, an older social father.",
      "A social parent's child is a sibling-equivalent.",
      "A sibling-equivalent's mother is a social mother.",
    ]);
  });

  it.each([
    [
      "p-uncle-old-wife",
      ["father", "older_brother", "wife"],
      ["mother", "older_sister"],
      "Maiguru",
      [
        "A father's older brother is Bamkuru, an older social father.",
        "Bamkuru's wife is Maiguru.",
      ],
    ],
    [
      "p-uncle-young-wife",
      ["father", "younger_brother", "wife"],
      ["mother", "younger_sister"],
      "Mainini",
      [
        "A father's younger brother is Bamnini, a younger social father.",
        "Bamnini's wife is Mainini.",
      ],
    ],
    [
      "m-aunt-old-husband",
      ["mother", "older_sister", "husband"],
      ["father", "older_brother"],
      "Bamkuru",
      [
        "A mother's older sister is Maiguru, an older social mother.",
        "Maiguru's husband is Bamkuru.",
      ],
    ],
    [
      "m-aunt-young-husband",
      ["mother", "younger_sister", "husband"],
      ["father", "younger_brother"],
      "Bamnini",
      [
        "A mother's younger sister is Mainini, a younger social mother.",
        "Mainini's husband is Bamnini.",
      ],
    ],
  ])(
    "preserves social-parent seniority through marriage for %s",
    (targetId, rawSteps, canonicalSteps, expectedTitle, derivation) => {
      const result = resolveKinship(
        "ego-m",
        targetId as string,
        people,
        relationships,
      );

      expect(result.path?.steps).toEqual(rawSteps);
      expect(result.canonicalSteps).toEqual(canonicalSteps);
      expect(result.title).toBe(expectedTitle);
      expect(result.derivation).toEqual(derivation);
    },
  );

  it("applies paternal-aunt cross-cousin exceptions by ego sex", () => {
    expect(title("ego-m", "cross-p-m")).toBe("Muzukuru");
    expect(title("ego-f", "cross-p-m")).toBe("Mwana");
  });

  it("applies maternal-uncle cross-cousin exceptions for a male ego", () => {
    expect(title("ego-m", "cross-m-m")).toBe("Sekuru");
    expect(title("ego-m", "cross-m-f")).toBe("Mainini");
  });

  it("keeps the guide's missing female-ego cross-cousin case unmapped", () => {
    expect(
      resolveKinship("ego-f", "cross-m-m", people, relationships).status,
    ).toBe("unmapped");
  });

  it("resolves affinal terms and exposes the guide's overlap", () => {
    expect(title("ego-m", "wife")).toBe("Mukadzi");
    expect(title("ego-f", "husband")).toBe("Murume");
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

  it("resolves spouse terms from either side of a symmetric spouse edge", () => {
    expect(title("wife", "ego-m")).toBe("Murume");
    expect(title("husband", "ego-f")).toBe("Mukadzi");
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

  it("resolves a male ego's father's older brother's wife as a social mother", () => {
    const people: Person[] = [
      {
        id: "ego",
        firstName: "Tapiwa",
        surname: "Moyo",
        sex: "male",
      },
      {
        id: "father",
        firstName: "Tawanda",
        surname: "Moyo",
        sex: "male",
      },
      {
        id: "older-uncle",
        firstName: "Farai",
        surname: "Moyo",
        sex: "male",
      },
      {
        id: "older-uncle-wife",
        firstName: "Rudo",
        surname: "Moyo",
        sex: "female",
      },
    ];

    const relationships: Relationship[] = [
      {
        id: "father-ego",
        type: "PARENT_OF",
        personAId: "father",
        personBId: "ego",
      },
      {
        id: "older-uncle-father",
        type: "SIBLING_OF",
        personAId: "older-uncle",
        personBId: "father",
        seniority: "A_OLDER",
      },
      {
        id: "older-uncle-wife-marriage",
        type: "SPOUSE_OF",
        personAId: "older-uncle",
        personBId: "older-uncle-wife",
      },
    ];

    const result = resolveKinship(
      "ego",
      "older-uncle-wife",
      people,
      relationships,
    );

    expect(result.path?.steps).toEqual(["father", "older_brother", "wife"]);

    expect(result.canonicalSteps).toEqual(["mother", "older_sister"]);
    expect(result.status).toBe("known");
    expect(result.title).toBe("Maiguru");

    expect(result.derivation).toEqual([
      "A father's older brother is Bamkuru, an older social father.",
      "Bamkuru's wife is Maiguru.",
    ]);
  });
});
