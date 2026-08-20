import { describe, expect, it } from "vitest";

import type { Person as LegacyPerson, Relationship } from "@/types/family";

import { FamilyTreeGraph } from "./family-tree-graph";
import { KinshipResolver } from "./kinship-resolver";
import type { KinQuery, Person } from "./model";
import { PathReducer } from "./path-reducer";
import { resolveKinship } from "./resolve";

function person(
  id: string,
  sex: "M" | "F",
  family: Partial<Person> = {},
): Person {
  return { id, sex, spouseIds: [], ...family };
}

function resolverFor(people: Person[]) {
  return new KinshipResolver(new FamilyTreeGraph(people));
}

function resolve(people: Person[], query: KinQuery) {
  return resolverFor(people).resolve(query);
}

function maternalUncleDaughterFamily() {
  return [
    person("maternal-grandfather", "M"),
    person("mother", "F", { fatherId: "maternal-grandfather" }),
    person("maternal-uncle", "M", {
      fatherId: "maternal-grandfather",
    }),
    person("ego", "M", { motherId: "mother" }),
    person("maternal-uncles-daughter", "F", {
      fatherId: "maternal-uncle",
    }),
    person("ego-son", "M", { fatherId: "ego" }),
    person("ego-daughter", "F", { fatherId: "ego" }),
  ];
}

describe("FamilyTreeGraph BFS and K-Path canonicalization", () => {
  const people = [
    person("gf", "M"),
    person("father", "M", { fatherId: "gf" }),
    person("aunt", "F", { fatherId: "gf" }),
    person("ego", "M", { fatherId: "father" }),
    person("cousin", "M", { motherId: "aunt" }),
  ];

  it("finds the shortest raw genealogical path with BFS", () => {
    const result = new FamilyTreeGraph(people).findShortestPath(
      "ego",
      "cousin",
    );

    expect(result?.rawPath).toEqual(["F", "F", "D", "S"]);
    expect(result?.personIds).toEqual([
      "ego",
      "father",
      "gf",
      "aunt",
      "cousin",
    ]);
    expect(result?.generationDistance).toBe(0);
  });

  it("collapses parent-child traversal into anthropological siblings", () => {
    expect(FamilyTreeGraph.canonicalize(["F", "S"])).toEqual(["B"]);
    expect(FamilyTreeGraph.canonicalize(["M", "D"])).toEqual(["Z"]);
    expect(
      new FamilyTreeGraph(people).findShortestPath("ego", "cousin")
        ?.canonicalPath,
    ).toEqual(["F", "Z", "S"]);
  });

  it("retains every equally short BFS path", () => {
    const people = [
      person("father", "M"),
      person("mother", "F"),
      person("ego", "M", { fatherId: "father", motherId: "mother" }),
      person("target", "F", { fatherId: "father", motherId: "mother" }),
    ];

    const paths = new FamilyTreeGraph(people).findShortestPaths(
      "ego",
      "target",
    );
    expect(paths).toHaveLength(2);
    expect(paths.map((path) => path.rawPath)).toEqual(
      expect.arrayContaining([
        ["F", "D"],
        ["M", "D"],
      ]),
    );
  });

  it("makes a one-sided spouse declaration traversable in both directions", () => {
    const graph = new FamilyTreeGraph([
      person("wife", "F", { spouseIds: ["husband"] }),
      person("husband", "M"),
    ]);

    expect(graph.findShortestPath("wife", "husband")?.rawPath).toEqual([
      "H",
    ]);
    expect(graph.findShortestPath("husband", "wife")?.rawPath).toEqual([
      "W",
    ]);
  });
});

describe("three-axis Shona algebra", () => {
  it("distinguishes same-sex siblings by relative age", () => {
    const people = [
      person("father", "M"),
      person("ego", "M", { fatherId: "father" }),
      person("brother", "M", { fatherId: "father" }),
    ];

    expect(
      resolve(people, {
        egoId: "ego",
        targetId: "brother",
        relativeAge: "older",
      }).title,
    ).toBe("Mukoma");
    expect(
      resolve(people, {
        egoId: "ego",
        targetId: "brother",
        relativeAge: "younger",
      }).title,
    ).toBe("Munin'ina");
  });

  it("classifies cross-sex siblings as Hanzvadzi without age", () => {
    const people = [
      person("mother", "F"),
      person("ego", "M", { motherId: "mother" }),
      person("sister", "F", { motherId: "mother" }),
    ];

    expect(resolve(people, { egoId: "ego", targetId: "sister" }).title).toBe(
      "Hanzvadzi",
    );
  });

  it("closes explicit sibling groups and keeps Hanzvadzi independent of seniority", () => {
    const people: LegacyPerson[] = [
      { id: "tiri", firstName: "Tiri", surname: "M", sex: "male" },
      { id: "tina", firstName: "Tina", surname: "M", sex: "female" },
      { id: "taku", firstName: "Taku", surname: "M", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "tiri-tina",
        type: "SIBLING_OF",
        personAId: "tiri",
        personBId: "tina",
        seniority: "B_OLDER",
      },
      {
        id: "tiri-taku",
        type: "SIBLING_OF",
        personAId: "tiri",
        personBId: "taku",
        seniority: "B_OLDER",
      },
    ];

    const result = resolveKinship("tina", "taku", people, relationships);

    expect(result.title).toBe("Hanzvadzi");
    expect(result.path?.personIds).toEqual(["tina", "taku"]);
  });

  it("infers same-sex sibling seniority through an older-than chain", () => {
    const people: LegacyPerson[] = [
      { id: "oldest", firstName: "Oldest", surname: "M", sex: "male" },
      { id: "middle", firstName: "Middle", surname: "M", sex: "male" },
      { id: "youngest", firstName: "Youngest", surname: "M", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "oldest-middle",
        type: "SIBLING_OF",
        personAId: "oldest",
        personBId: "middle",
        seniority: "A_OLDER",
      },
      {
        id: "middle-youngest",
        type: "SIBLING_OF",
        personAId: "middle",
        personBId: "youngest",
        seniority: "A_OLDER",
      },
    ];

    expect(
      resolveKinship("youngest", "oldest", people, relationships).title,
    ).toBe("Mukoma");
    expect(
      resolveKinship("oldest", "youngest", people, relationships).title,
    ).toBe("Munin'ina");
  });

  it("does not invent an order between siblings on incomparable seniority branches", () => {
    const people: LegacyPerson[] = [
      { id: "tiri", firstName: "Tiri", surname: "M", sex: "male" },
      { id: "tina", firstName: "Tina", surname: "M", sex: "male" },
      { id: "taku", firstName: "Taku", surname: "M", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "tiri-tina",
        type: "SIBLING_OF",
        personAId: "tiri",
        personBId: "tina",
        seniority: "B_OLDER",
      },
      {
        id: "tiri-taku",
        type: "SIBLING_OF",
        personAId: "tiri",
        personBId: "taku",
        seniority: "B_OLDER",
      },
    ];

    const result = resolveKinship("tina", "taku", people, relationships);

    expect(result.status).toBe("ambiguous");
    expect(result.title).toBe("Mukoma / Munin'ina");
  });

  it("propagates reciprocal classificatory parenthood across a complete sibling group", () => {
    const people: LegacyPerson[] = [
      { id: "ebbah", firstName: "Ebbah", surname: "M", sex: "female" },
      { id: "johnson", firstName: "Johnson", surname: "M", sex: "male" },
      { id: "tiri", firstName: "Tiri", surname: "M", sex: "male" },
      { id: "tina", firstName: "Tina", surname: "M", sex: "female" },
      { id: "taku", firstName: "Taku", surname: "M", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "ebbah-taku",
        type: "PARENT_OF",
        personAId: "ebbah",
        personBId: "taku",
      },
      {
        id: "ebbah-johnson",
        type: "SPOUSE_OF",
        personAId: "ebbah",
        personBId: "johnson",
      },
      {
        id: "tiri-tina",
        type: "SIBLING_OF",
        personAId: "tiri",
        personBId: "tina",
        seniority: "B_OLDER",
      },
      {
        id: "tiri-taku",
        type: "SIBLING_OF",
        personAId: "tiri",
        personBId: "taku",
        seniority: "B_OLDER",
      },
    ];

    const tiriToEbbah = resolveKinship("tiri", "ebbah", people, relationships);
    const tinaToEbbah = resolveKinship("tina", "ebbah", people, relationships);
    const ebbahToTiri = resolveKinship("ebbah", "tiri", people, relationships);
    const ebbahToTina = resolveKinship("ebbah", "tina", people, relationships);

    expect(tiriToEbbah).toMatchObject({
      title: "Mai",
      path: { steps: ["mother"] },
    });
    expect(tinaToEbbah).toMatchObject({
      title: "Mai",
      path: { steps: ["mother"] },
    });
    expect(ebbahToTiri).toMatchObject({
      title: "Mwana",
      path: { steps: ["son"] },
    });
    expect(ebbahToTina).toMatchObject({
      title: "Mwana",
      path: { steps: ["daughter"] },
    });

    expect(resolveKinship("tiri", "johnson", people, relationships).title).toBe(
      "Baba",
    );
    expect(resolveKinship("johnson", "tina", people, relationships).title).toBe(
      "Mwana",
    );
  });

  it.each([
    ["F", "sister", "sisters-son", "S"],
    ["M", "brother", "brothers-daughter", "D"],
  ] as const)(
    "reduces a %s ego's same-sex sibling's child to Mwana",
    (egoSex, siblingId, childId, childStep) => {
      const parentId = "parent";
      const parentSex = egoSex === "M" ? "M" : "F";
      const people = [
        person(parentId, parentSex),
        person("ego", egoSex, {
          ...(parentSex === "M"
            ? { fatherId: parentId }
            : { motherId: parentId }),
        }),
        person(siblingId, egoSex, {
          ...(parentSex === "M"
            ? { fatherId: parentId }
            : { motherId: parentId }),
        }),
        person(childId, childStep === "S" ? "M" : "F", {
          ...(egoSex === "M"
            ? { fatherId: siblingId }
            : { motherId: siblingId }),
        }),
      ];

      const result = resolve(people, { egoId: "ego", targetId: childId });
      expect(result.traversal?.canonicalPath).toEqual([
        egoSex === "M" ? "B" : "Z",
        childStep,
      ]);
      expect(result.reducedPath).toEqual([childStep]);
      expect(result.title).toBe("Mwana");
    },
  );

  it.each([
    ["M", "F", "sister", "sisters-son"],
    ["F", "M", "brother", "brothers-son"],
  ] as const)(
    "keeps a %s ego's opposite-sex sibling's child as Muzukuru",
    (egoSex, siblingSex, siblingId, childId) => {
      const people = [
        person("parent", "M"),
        person("ego", egoSex, { fatherId: "parent" }),
        person(siblingId, siblingSex, { fatherId: "parent" }),
        person(childId, "M", {
          ...(siblingSex === "M"
            ? { fatherId: siblingId }
            : { motherId: siblingId }),
        }),
      ];

      expect(resolve(people, { egoId: "ego", targetId: childId }).title).toBe(
        "Muzukuru",
      );
    },
  );

  it("reduces parallel paternal cousins to sibling-equivalents", () => {
    const people = [
      person("gf", "M"),
      person("father", "M", { fatherId: "gf" }),
      person("uncle", "M", { fatherId: "gf" }),
      person("ego", "M", { fatherId: "father" }),
      person("cousin", "M", { fatherId: "uncle" }),
    ];
    const result = resolve(people, {
      egoId: "ego",
      targetId: "cousin",
      relativeAge: "older",
    });

    expect(result.traversal?.canonicalPath).toEqual(["F", "B", "S"]);
    expect(result.reducedPath).toEqual(["B"]);
    expect(result.title).toBe("Mukoma");
  });

  it("applies Sekuru haaperi to M.B, M.B.S, and M.B.S.S", () => {
    const people = [
      person("mgf", "M"),
      person("mother", "F", { fatherId: "mgf" }),
      person("uncle", "M", { fatherId: "mgf" }),
      person("ego", "M", { motherId: "mother" }),
      person("uncle-son", "M", { fatherId: "uncle" }),
      person("uncle-grandson", "M", { fatherId: "uncle-son" }),
    ];

    for (const targetId of ["uncle", "uncle-son", "uncle-grandson"]) {
      expect(resolve(people, { egoId: "ego", targetId }).title).toBe("Sekuru");
    }
    expect(
      resolve(people, { egoId: "ego", targetId: "uncle-grandson" }).traversal
        ?.canonicalPath,
    ).toEqual(["M", "B", "S", "S"]);
  });

  it("resolves M.B.D specifically as Mainini", () => {
    const people = [
      person("mgf", "M"),
      person("mother", "F", { fatherId: "mgf" }),
      person("uncle", "M", { fatherId: "mgf" }),
      person("ego", "M", { motherId: "mother" }),
      person("uncle-daughter", "F", { fatherId: "uncle" }),
    ];

    const result = resolve(people, {
      egoId: "ego",
      targetId: "uncle-daughter",
    });
    expect(result.traversal?.canonicalPath).toEqual(["M", "B", "D"]);
    expect(result.title).toBe("Mainini");
  });

  it.each([
    ["ego-son", "S"],
    ["ego-daughter", "D"],
  ] as const)(
    "resolves a male ego's maternal uncle's daughter to his child %s as Muzukuru",
    (targetId, childStep) => {
      const result = resolve(maternalUncleDaughterFamily(), {
        egoId: "maternal-uncles-daughter",
        targetId,
      });

      expect(result.traversal?.canonicalPath).toEqual([
        "F",
        "Z",
        "S",
        childStep,
      ]);
      expect(result.title).toBe("Muzukuru");
    },
  );

  it.each(["ego-son", "ego-daughter"] as const)(
    "resolves a male ego's child %s to his maternal uncle's daughter as Mbuya",
    (egoId) => {
      const result = resolve(maternalUncleDaughterFamily(), {
        egoId,
        targetId: "maternal-uncles-daughter",
      });

      expect(result.traversal?.canonicalPath).toEqual(["F", "M", "B", "D"]);
      expect(result.title).toBe("Mbuya");
      expect(result.aliases).toBeUndefined();
    },
  );

  it.each([
    ["grandmothers-brother", "M", "B", "Sekuru"],
    ["grandmothers-sister", "F", "Z", "Mbuya"],
  ] as const)(
    "classifies a grandmother's sibling %s in ego's grandparent generation",
    (targetId, targetSex, siblingStep, expectedTitle) => {
      const people = [
        person("great-grandfather", "M"),
        person("grandmother", "F", { fatherId: "great-grandfather" }),
        person(targetId, targetSex, { fatherId: "great-grandfather" }),
        person("mother", "F", { motherId: "grandmother" }),
        person("ego", "M", { motherId: "mother" }),
      ];

      const result = resolve(people, { egoId: "ego", targetId });

      expect(result.traversal?.canonicalPath).toEqual(["M", "M", siblingStep]);
      expect(result.traversal?.generationDistance).toBe(2);
      expect(result.status).toBe("known");
      expect(result.title).toBe(expectedTitle);
      expect(result.ruleId).toBe(
        targetSex === "M"
          ? "GRANDPARENT_GENERATION_MALE_COLLATERAL"
          : "GRANDPARENT_GENERATION_FEMALE_COLLATERAL",
      );
    },
  );

  it.each([
    ["grandmothers-male-cousin", "M", "B", "Sekuru"],
    ["grandmothers-female-cousin", "F", "Z", "Mbuya"],
  ] as const)(
    "classifies a grandmother's cousin %s in ego's grandparent generation",
    (targetId, targetSex, reducedSiblingStep, expectedTitle) => {
      const people = [
        person("great-great-grandfather", "M"),
        person("grandmother-father", "M", {
          fatherId: "great-great-grandfather",
        }),
        person("cousin-father", "M", {
          fatherId: "great-great-grandfather",
        }),
        person("grandmother", "F", { fatherId: "grandmother-father" }),
        person(targetId, targetSex, { fatherId: "cousin-father" }),
        person("mother", "F", { motherId: "grandmother" }),
        person("ego", "M", { motherId: "mother" }),
      ];

      const result = resolve(people, { egoId: "ego", targetId });

      expect(result.traversal?.canonicalPath).toEqual([
        "M",
        "M",
        "F",
        "B",
        targetSex === "M" ? "S" : "D",
      ]);
      expect(result.reducedPath).toEqual(["M", "M", reducedSiblingStep]);
      expect(result.traversal?.generationDistance).toBe(2);
      expect(result.status).toBe("known");
      expect(result.title).toBe(expectedTitle);
    },
  );

  it.each(["S", "D"] as const)(
    "skews a male ego's F.Z.%s relation to Muzukuru",
    (childSex) => {
      const people = [
        person("pgf", "M"),
        person("father", "M", { fatherId: "pgf" }),
        person("aunt", "F", { fatherId: "pgf" }),
        person("ego", "M", { fatherId: "father" }),
        person("cousin", childSex === "S" ? "M" : "F", {
          motherId: "aunt",
        }),
      ];

      expect(resolve(people, { egoId: "ego", targetId: "cousin" }).title).toBe(
        "Muzukuru",
      );
    },
  );

  it.each([
    ["aunts-son", "M", "S"],
    ["aunts-daughter", "F", "D"],
  ] as const)(
    "promotes a female ego's father's sister's child %s to Muzukuru",
    (targetId, targetSex, childStep) => {
      const people = [
        person("paternal-grandfather", "M"),
        person("father", "M", { fatherId: "paternal-grandfather" }),
        person("paternal-aunt", "F", {
          fatherId: "paternal-grandfather",
        }),
        person("ego", "F", { fatherId: "father" }),
        person(targetId, targetSex, { motherId: "paternal-aunt" }),
      ];

      const result = resolve(people, { egoId: "ego", targetId });

      expect(result.traversal?.rawPath).toEqual(["F", "F", "D", childStep]);
      expect(result.traversal?.canonicalPath).toEqual(["F", "Z", childStep]);
      expect(result.status).toBe("known");
      expect(result.title).toBe("Muzukuru");
      expect(result.kinClass).toBe("MUZUKURU");
      expect(result.ruleId).toBe("PATERNAL_AUNT_CHILD_TO_MUZUKURU");
    },
  );

  it("resolves inward and outward clan alignment", () => {
    const people = [
      person("ego", "M"),
      person("son", "M", { fatherId: "ego", spouseIds: ["muroora"] }),
      person("muroora", "F", { spouseIds: ["son"] }),
      person("daughter", "F", { fatherId: "ego", spouseIds: ["mukuwasha"] }),
      person("mukuwasha", "M", { spouseIds: ["daughter"] }),
    ];

    const muroora = resolve(people, { egoId: "ego", targetId: "muroora" });
    const mukuwasha = resolve(people, {
      egoId: "ego",
      targetId: "mukuwasha",
    });

    expect(muroora.title).toBe("Mwana");
    expect(muroora.aliases).toContain("Muroora");
    expect(muroora.socialTerm).toBe("Vanyarikani");
    expect(mukuwasha.title).toBe("Mwana");
    expect(mukuwasha.aliases).toContain("Mukwasha");
    expect(mukuwasha.socialTerm).toBe("Vanyarikani");
  });

  it("retains co-parent and wider child-in-law family projections", () => {
    const people = [
      person("ego", "M"),
      person("daughter", "F", { fatherId: "ego", spouseIds: ["son-in-law"] }),
      person("son-in-law-father", "M"),
      person("son-in-law", "M", {
        fatherId: "son-in-law-father",
        spouseIds: ["daughter"],
      }),
      person("son-in-law-sister", "F", { fatherId: "son-in-law-father" }),
      person("son", "M", { fatherId: "ego", spouseIds: ["daughter-in-law"] }),
      person("daughter-in-law-mother", "F"),
      person("daughter-in-law", "F", {
        motherId: "daughter-in-law-mother",
        spouseIds: ["son"],
      }),
    ];

    const sonInLawFather = resolve(people, {
      egoId: "ego",
      targetId: "son-in-law-father",
    });
    expect(sonInLawFather.title).toBe("Mukurungai");
    expect(sonInLawFather.socialTerm).toBe("Vanyarikani");
    expect(
      resolve(people, { egoId: "ego", targetId: "son-in-law-sister" }).title,
    ).toBe("Hama yeVakuwasha");
    const daughterInLawMother = resolve(people, {
      egoId: "ego",
      targetId: "daughter-in-law-mother",
    });
    expect(daughterInLawMother.title).toBe("Mukurungai");
    expect(daughterInLawMother.socialTerm).toBe("Vanyarikani");
  });

  it("resolves a son-in-law's siblings, piblings, cousins, children, and parents", () => {
    const people = [
      person("ego", "M"),
      person("daughter", "F", {
        fatherId: "ego",
        spouseIds: ["son-in-law"],
      }),
      person("son-in-law-paternal-grandfather", "M"),
      person("son-in-law-father", "M", {
        fatherId: "son-in-law-paternal-grandfather",
      }),
      person("son-in-law-maternal-grandfather", "M"),
      person("son-in-law-mother", "F", {
        fatherId: "son-in-law-maternal-grandfather",
      }),
      person("son-in-law", "M", {
        fatherId: "son-in-law-father",
        motherId: "son-in-law-mother",
        spouseIds: ["daughter"],
      }),
      person("son-in-law-brother", "M", {
        fatherId: "son-in-law-father",
      }),
      person("son-in-law-sister", "F", {
        fatherId: "son-in-law-father",
      }),
      person("son-in-law-paternal-uncle", "M", {
        fatherId: "son-in-law-paternal-grandfather",
      }),
      person("son-in-law-paternal-aunt", "F", {
        fatherId: "son-in-law-paternal-grandfather",
      }),
      person("son-in-law-maternal-uncle", "M", {
        fatherId: "son-in-law-maternal-grandfather",
      }),
      person("son-in-law-male-cousin", "M", {
        fatherId: "son-in-law-paternal-uncle",
      }),
      person("son-in-law-female-cousin", "F", {
        fatherId: "son-in-law-paternal-uncle",
      }),
      person("son-in-law-child", "M", { fatherId: "son-in-law" }),
    ];

    const titleFor = (targetId: string) =>
      resolve(people, { egoId: "ego", targetId }).title;

    expect(titleFor("son-in-law-father")).toBe("Mukurungai");
    expect(titleFor("son-in-law-mother")).toBe("Mukurungai");
    expect(titleFor("son-in-law-brother")).toBe("Mukuwasha");
    expect(titleFor("son-in-law-sister")).toBe("Hama yeVakuwasha");
    expect(titleFor("son-in-law-paternal-uncle")).toBe("Mukurungai");
    expect(titleFor("son-in-law-paternal-aunt")).toBe("Hama yeVakuwasha");
    expect(titleFor("son-in-law-maternal-uncle")).toBe("Hama yeVakuwasha");
    expect(titleFor("son-in-law-male-cousin")).toBe("Mukuwasha");
    expect(titleFor("son-in-law-female-cousin")).toBe("Hama yeVakuwasha");
    expect(titleFor("son-in-law-child")).toBe("Muzukuru");

    expect(
      resolve(people, {
        egoId: "ego",
        targetId: "son-in-law-brother",
      }).socialTerm,
    ).toBe("Vanyarikani");
  });

  it("resolves a daughter-in-law's siblings, piblings, cousins, children, and parents", () => {
    const people = [
      person("ego", "F"),
      person("son", "M", {
        motherId: "ego",
        spouseIds: ["daughter-in-law"],
      }),
      person("daughter-in-law-paternal-grandfather", "M"),
      person("daughter-in-law-father", "M", {
        fatherId: "daughter-in-law-paternal-grandfather",
      }),
      person("daughter-in-law-maternal-grandfather", "M"),
      person("daughter-in-law-mother", "F", {
        fatherId: "daughter-in-law-maternal-grandfather",
      }),
      person("daughter-in-law", "F", {
        fatherId: "daughter-in-law-father",
        motherId: "daughter-in-law-mother",
        spouseIds: ["son"],
      }),
      person("daughter-in-law-brother", "M", {
        fatherId: "daughter-in-law-father",
      }),
      person("daughter-in-law-sister", "F", {
        fatherId: "daughter-in-law-father",
      }),
      person("daughter-in-law-paternal-uncle", "M", {
        fatherId: "daughter-in-law-paternal-grandfather",
      }),
      person("daughter-in-law-paternal-aunt", "F", {
        fatherId: "daughter-in-law-paternal-grandfather",
      }),
      person("daughter-in-law-maternal-uncle", "M", {
        fatherId: "daughter-in-law-maternal-grandfather",
      }),
      person("daughter-in-law-male-cousin", "M", {
        fatherId: "daughter-in-law-paternal-uncle",
      }),
      person("daughter-in-law-female-cousin", "F", {
        fatherId: "daughter-in-law-paternal-uncle",
      }),
      person("daughter-in-law-child", "F", {
        motherId: "daughter-in-law",
      }),
    ];

    const titleFor = (targetId: string) =>
      resolve(people, { egoId: "ego", targetId }).title;

    expect(titleFor("daughter-in-law-father")).toBe("Mukurungai");
    expect(titleFor("daughter-in-law-mother")).toBe("Mukurungai");
    expect(titleFor("daughter-in-law-brother")).toBe("Tezvara");
    expect(titleFor("daughter-in-law-sister")).toBe("Muroora");
    expect(titleFor("daughter-in-law-paternal-uncle")).toBe("Mukurungai");
    expect(titleFor("daughter-in-law-paternal-aunt")).toBe("Muroora");
    expect(titleFor("daughter-in-law-maternal-uncle")).toBe("Hama dzeMuroora");
    expect(titleFor("daughter-in-law-male-cousin")).toBe("Tezvara");
    expect(titleFor("daughter-in-law-female-cousin")).toBe("Muroora");
    expect(titleFor("daughter-in-law-child")).toBe("Muzukuru");

    expect(
      resolve(people, {
        egoId: "ego",
        targetId: "daughter-in-law-sister",
      }).socialTerm,
    ).toBe("Vanyarikani");
  });

  it("preserves classificatory-parent seniority through marriage", () => {
    const people = [
      person("pgf", "M"),
      person("father", "M", { fatherId: "pgf", birthOrder: 2 }),
      person("uncle", "M", {
        fatherId: "pgf",
        spouseIds: ["uncle-wife"],
        birthOrder: 1,
      }),
      person("uncle-wife", "F", { spouseIds: ["uncle"] }),
      person("ego", "M", { fatherId: "father" }),
    ];

    expect(
      resolve(people, {
        egoId: "ego",
        targetId: "uncle-wife",
      }).title,
    ).toBe("Maiguru");
  });

  it("retains calculated generation categories", () => {
    const people = [
      person("ancestor-mother", "F"),
      person("ancestor", "M", { motherId: "ancestor-mother" }),
      person("grandfather", "M", { fatherId: "ancestor" }),
      person("father", "M", { fatherId: "grandfather" }),
      person("ego", "M", { fatherId: "father" }),
      person("child", "F", { fatherId: "ego" }),
      person("grandchild", "M", { motherId: "child" }),
      person("great-grandchild", "F", { fatherId: "grandchild" }),
      person("great-great-grandchild", "M", {
        motherId: "great-grandchild",
      }),
    ];

    expect(
      resolve(people, { egoId: "ego", targetId: "grandfather" }).title,
    ).toBe("Sekuru");
    expect(
      resolve(people, { egoId: "ego", targetId: "ancestor" }),
    ).toMatchObject({
      title: "Sekuru",
      ruleId: "RECURSIVE_MALE_GRANDPARENT_ANCESTOR",
    });
    expect(
      resolve(people, { egoId: "ego", targetId: "ancestor-mother" }),
    ).toMatchObject({
      title: "Mbuya",
      ruleId: "RECURSIVE_FEMALE_GRANDPARENT_ANCESTOR",
    });
    expect(
      resolve(people, { egoId: "ego", targetId: "grandchild" }).title,
    ).toBe("Muzukuru");
    expect(
      resolve(people, { egoId: "ego", targetId: "great-grandchild" }),
    ).toMatchObject({
      title: "Muzukuru",
      ruleId: "MUZUKURU_DESCENDANT",
    });
    expect(
      resolve(people, { egoId: "ego", targetId: "great-great-grandchild" }),
    ).toMatchObject({
      title: "Muzukuru",
      ruleId: "MUZUKURU_DESCENDANT",
    });

    expect(
      resolve(people, { egoId: "ancestor", targetId: "ego" }),
    ).toMatchObject({
      title: "Muzukuru",
      ruleId: "MUZUKURU_DESCENDANT",
    });
    expect(
      resolve(people, { egoId: "ancestor-mother", targetId: "ego" }),
    ).toMatchObject({
      title: "Muzukuru",
      ruleId: "MUZUKURU_DESCENDANT",
    });
  });

  it("recursively classifies ancestors above a collateral grandparent", () => {
    const people = [
      person("great-great-grandmother", "F"),
      person("great-grandfather", "M", {
        motherId: "great-great-grandmother",
      }),
      person("grandmother", "F", { fatherId: "great-grandfather" }),
      person("grandmothers-brother", "M", {
        fatherId: "great-grandfather",
      }),
      person("mother", "F", { motherId: "grandmother" }),
      person("ego", "F", { motherId: "mother" }),
    ];

    expect(
      resolve(people, { egoId: "ego", targetId: "grandmothers-brother" }),
    ).toMatchObject({ title: "Sekuru" });
    expect(
      resolve(people, { egoId: "ego", targetId: "great-great-grandmother" }),
    ).toMatchObject({
      title: "Mbuya",
      ruleId: "RECURSIVE_FEMALE_GRANDPARENT_ANCESTOR",
    });
  });

  it("propagates Muzukuru through a paternal-aunt child's descendants", () => {
    const people = [
      person("paternal-grandfather", "M"),
      person("father", "M", { fatherId: "paternal-grandfather" }),
      person("paternal-aunt", "F", { fatherId: "paternal-grandfather" }),
      person("ego", "M", { fatherId: "father" }),
      person("aunts-child", "M", { motherId: "paternal-aunt" }),
      person("aunts-grandchild", "F", { fatherId: "aunts-child" }),
      person("aunts-great-grandchild", "M", {
        motherId: "aunts-grandchild",
      }),
    ];

    expect(
      resolve(people, { egoId: "ego", targetId: "aunts-child" }).title,
    ).toBe("Muzukuru");
    for (const targetId of ["aunts-grandchild", "aunts-great-grandchild"]) {
      expect(resolve(people, { egoId: "ego", targetId })).toMatchObject({
        title: "Muzukuru",
        ruleId: "MUZUKURU_DESCENDANT",
      });
    }
  });

  it("propagates Muzukuru through an opposite-sex sibling's descendants", () => {
    const people = [
      person("parent", "M"),
      person("ego", "M", { fatherId: "parent" }),
      person("sister", "F", { fatherId: "parent" }),
      person("sisters-child", "M", { motherId: "sister" }),
      person("sisters-grandchild", "F", { fatherId: "sisters-child" }),
    ];

    expect(
      resolve(people, { egoId: "ego", targetId: "sisters-child" }).title,
    ).toBe("Muzukuru");
    expect(
      resolve(people, { egoId: "ego", targetId: "sisters-grandchild" }),
    ).toMatchObject({
      title: "Muzukuru",
      ruleId: "MUZUKURU_DESCENDANT",
    });
  });

  it("resolves the direct wife-giver axis for a male ego", () => {
    const people = [
      person("wf", "M"),
      person("wm", "F"),
      person("wife", "F", {
        fatherId: "wf",
        motherId: "wm",
        spouseIds: ["ego"],
      }),
      person("wb", "M", { fatherId: "wf" }),
      person("wz", "F", { fatherId: "wf" }),
      person("ego", "M", { spouseIds: ["wife"] }),
    ];

    const fatherInLaw = resolve(people, { egoId: "ego", targetId: "wf" });
    const motherInLaw = resolve(people, { egoId: "ego", targetId: "wm" });
    const brotherInLaw = resolve(people, { egoId: "ego", targetId: "wb" });
    const sisterInLaw = resolve(people, { egoId: "ego", targetId: "wz" });
    const wife = resolve(people, { egoId: "ego", targetId: "wife" });

    expect(wife.title).toBe("Mukadzi");
    expect(wife.socialTerm).toBe("Vakaroorana");
    expect(fatherInLaw.title).toBe("Tezvara");
    expect(fatherInLaw.socialTerm).toBe("Vanyarikani");
    expect(motherInLaw.title).toBe("Ambuya");
    expect(motherInLaw.kinClass).toBe("MOTHER_IN_LAW");
    expect(motherInLaw.aliases).toBeUndefined();
    expect(motherInLaw.socialTerm).toBe("Vanyarikani");
    expect(brotherInLaw.title).toBe("Tezvara");
    expect(brotherInLaw.aliases).toContain("Tsano");
    expect(brotherInLaw.socialTerm).toBe("Vanyarikani");
    expect(sisterInLaw.title).toBe("Muramu");
    expect(sisterInLaw.socialTerm).toBe("Vasekedzani");
  });

  it("distinguishes the homonymous Ambuya grandmother and mother-in-law classes", () => {
    const people = [
      person("grandmother", "F", { spouseIds: ["grandfather"] }),
      person("grandfather", "M", { spouseIds: ["grandmother"] }),
      person("mother", "F", { motherId: "grandmother" }),
      person("wife-mother", "F", { spouseIds: ["wife-father"] }),
      person("wife-father", "M", { spouseIds: ["wife-mother"] }),
      person("wife", "F", {
        motherId: "wife-mother",
        spouseIds: ["ego"],
      }),
      person("ego", "M", { motherId: "mother", spouseIds: ["wife"] }),
    ];

    const grandmother = resolve(people, {
      egoId: "ego",
      targetId: "grandmother",
    });
    const motherInLaw = resolve(people, {
      egoId: "ego",
      targetId: "wife-mother",
    });
    const grandmothersHusband = resolve(people, {
      egoId: "ego",
      targetId: "grandfather",
    });
    const motherInLawsHusband = resolve(people, {
      egoId: "ego",
      targetId: "wife-father",
    });

    expect(grandmother.title).toBe("Mbuya");
    expect(grandmother.kinClass).toBe("GRANDMOTHER");
    expect(motherInLaw.title).toBe("Ambuya");
    expect(motherInLaw.kinClass).toBe("MOTHER_IN_LAW");
    expect(grandmothersHusband.title).toBe("Sekuru");
    expect(motherInLawsHusband.title).toBe("Tezvara");
  });

  it.each([
    [
      "female ego's husband to her brother's wife",
      "female-egos-husband",
      "brothers-wife",
      ["W", "B", "W"],
      "Ambuya",
      "WIFES_BROTHERS_WIFE",
    ],
    [
      "female ego's brother's wife to her husband",
      "brothers-wife",
      "female-egos-husband",
      ["H", "Z", "H"],
      "Mukuwasha",
      "WIFE_RECEIVER_MALE_PEER",
    ],
  ] as const)(
    "resolves %s across the reciprocal affinal alliance",
    (
      _caseName,
      egoId,
      targetId,
      canonicalPath,
      expectedTitle,
      expectedKinClass,
    ) => {
      const people = [
        person("siblings-father", "M"),
        person("female-ego", "F", {
          fatherId: "siblings-father",
          spouseIds: ["female-egos-husband"],
        }),
        person("female-egos-husband", "M", {
          spouseIds: ["female-ego"],
        }),
        person("brother", "M", {
          fatherId: "siblings-father",
          spouseIds: ["brothers-wife"],
        }),
        person("brothers-wife", "F", { spouseIds: ["brother"] }),
      ];

      const result = resolve(people, { egoId, targetId });

      expect(result.traversal?.canonicalPath).toEqual(canonicalPath);
      expect(result.title).toBe(expectedTitle);
      expect(result.kinClass).toBe(expectedKinClass);
      expect(result.socialTerm).toBe("Vanyarikani");
    },
  );

  it("resolves a male ego's brother to the ego's wife's brother's wife as Ambuya", () => {
    const people = [
      person("ego-family-father", "M"),
      person("male-ego", "M", {
        fatherId: "ego-family-father",
        spouseIds: ["wife"],
      }),
      person("egos-brother", "M", { fatherId: "ego-family-father" }),
      person("wife-family-father", "M"),
      person("wife", "F", {
        fatherId: "wife-family-father",
        spouseIds: ["male-ego"],
      }),
      person("wifes-brother", "M", {
        fatherId: "wife-family-father",
        spouseIds: ["wifes-brothers-wife"],
      }),
      person("wifes-brothers-wife", "F", {
        spouseIds: ["wifes-brother"],
      }),
    ];

    const result = resolve(people, {
      egoId: "egos-brother",
      targetId: "wifes-brothers-wife",
    });

    expect(result.traversal?.canonicalPath).toEqual(["B", "W", "B", "W"]);
    expect(result.title).toBe("Ambuya");
    expect(result.kinClass).toBe("WIFES_BROTHERS_WIFE");
    expect(result.socialTerm).toBe("Vanyarikani");
    expect(result.ruleId).toBe("AFFINAL_WIFES_BROTHERS_WIFE");
  });

  it("resolves the ego's wife's brother's wife reciprocally to the male ego's brother as Mukuwasha", () => {
    const people = [
      person("ego-family-father", "M"),
      person("male-ego", "M", {
        fatherId: "ego-family-father",
        spouseIds: ["wife"],
      }),
      person("egos-brother", "M", { fatherId: "ego-family-father" }),
      person("wife-family-father", "M"),
      person("wife", "F", {
        fatherId: "wife-family-father",
        spouseIds: ["male-ego"],
      }),
      person("wifes-brother", "M", {
        fatherId: "wife-family-father",
        spouseIds: ["wifes-brothers-wife"],
      }),
      person("wifes-brothers-wife", "F", {
        spouseIds: ["wifes-brother"],
      }),
    ];

    const result = resolve(people, {
      egoId: "wifes-brothers-wife",
      targetId: "egos-brother",
    });

    expect(result.traversal?.canonicalPath).toEqual(["H", "Z", "H", "B"]);
    expect(result.title).toBe("Mukuwasha");
    expect(result.kinClass).toBe("WIFE_RECEIVER_MALE_PEER");
    expect(result.socialTerm).toBe("Vanyarikani");
    expect(result.ruleId).toBe("RECIPROCAL_AMBUYA_TO_MUKUWASHA");
  });

  it("resolves a female ego's mother's sister's husband's mother as Mbuya", () => {
    const people = [
      person("maternal-grandfather", "M"),
      person("mother", "F", {
        fatherId: "maternal-grandfather",
        birthOrder: 2,
      }),
      person("mothers-sister", "F", {
        fatherId: "maternal-grandfather",
        spouseIds: ["aunts-husband"],
        birthOrder: 1,
      }),
      person("aunts-husband", "M", {
        motherId: "aunts-husbands-mother",
        spouseIds: ["mothers-sister"],
      }),
      person("aunts-husbands-mother", "F"),
      person("female-ego", "F", { motherId: "mother" }),
    ];

    const result = resolve(people, {
      egoId: "female-ego",
      targetId: "aunts-husbands-mother",
    });

    expect(result.traversal?.canonicalPath).toEqual(["M", "Z", "H", "M"]);
    expect(result.title).toBe("Mbuya");
    expect(result.kinClass).toBe("GRANDMOTHER");
    expect(result.derivation).toEqual(
      expect.arrayContaining([
        expect.stringContaining("SEMANTIC_CLASS_CONTINUATION"),
      ]),
    );

    const reciprocal = resolve(people, {
      egoId: "aunts-husbands-mother",
      targetId: "female-ego",
    });
    expect(reciprocal.title).toBe("Muzukuru");
    expect(reciprocal.kinClass).toBe("MUZUKURU");
    expect(reciprocal.ruleId).toBe("AFFINAL_CHILD_IN_LAW_CHILD");
  });

  it.each([
    [
      "wife's sister to the male ego's mother",
      "wifes-sister",
      "ego-mother",
      ["Z", "H", "M"],
      "Vamwene",
      "MOTHER_IN_LAW",
    ],
    [
      "male ego's mother to his wife's sister",
      "ego-mother",
      "wifes-sister",
      ["S", "W", "Z"],
      "Muroora",
      undefined,
    ],
  ] as const)(
    "resolves %s through classificatory affinal inheritance",
    (
      _caseName,
      egoId,
      targetId,
      canonicalPath,
      expectedTitle,
      expectedKinClass,
    ) => {
      const people = [
        person("ego-mother", "F"),
        person("male-ego", "M", {
          motherId: "ego-mother",
          spouseIds: ["wife"],
        }),
        person("wife-father", "M"),
        person("wife", "F", {
          fatherId: "wife-father",
          spouseIds: ["male-ego"],
        }),
        person("wifes-sister", "F", { fatherId: "wife-father" }),
      ];

      const result = resolve(people, { egoId, targetId });

      expect(result.traversal?.canonicalPath).toEqual(canonicalPath);
      expect(result.title).toBe(expectedTitle);
      expect(result.kinClass).toBe(expectedKinClass);
      expect(result.socialTerm).toBe("Vanyarikani");
    },
  );

  it("composes an affinal parent class through a longer same-sex sibling-equivalent path", () => {
    const people = [
      person("grandfather", "M"),
      person("father", "M", { fatherId: "grandfather" }),
      person("fathers-brother", "M", { fatherId: "grandfather" }),
      person("female-ego", "F", { fatherId: "father" }),
      person("female-parallel-cousin", "F", {
        fatherId: "fathers-brother",
        spouseIds: ["cousins-husband"],
      }),
      person("cousins-husband", "M", {
        motherId: "husbands-mother",
        spouseIds: ["female-parallel-cousin"],
      }),
      person("husbands-mother", "F"),
    ];

    const result = resolve(people, {
      egoId: "female-ego",
      targetId: "husbands-mother",
    });

    expect(result.title).toBe("Vamwene");
    expect(result.kinClass).toBe("MOTHER_IN_LAW");
    expect(result.ruleId).toBe(
      "COMPOSED_SAME_SEX_SIBLING_AFFINAL_INHERITANCE",
    );
    expect(result.socialTerm).toBe("Vanyarikani");
  });

  it("reuses the Mwana class when an internal marriage continues to a spouse's parent", () => {
    const people = [
      person("siblings-father", "M"),
      person("male-ego", "M", { fatherId: "siblings-father" }),
      person("brother", "M", { fatherId: "siblings-father" }),
      person("brothers-son", "M", {
        fatherId: "brother",
        spouseIds: ["sons-wife"],
      }),
      person("sons-wife", "F", {
        motherId: "wifes-mother",
        spouseIds: ["brothers-son"],
      }),
      person("wifes-mother", "F"),
    ];

    const result = resolve(people, {
      egoId: "male-ego",
      targetId: "wifes-mother",
    });

    expect(result.title).toBe("Mukurungai");
    expect(result.ruleId).toBe("AFFINAL_CO_PARENT_IN_LAW");
    expect(result.derivation).toContain(
      "COMPOSED_MWANA_ALLIANCE: an already-resolved Mwana prefix was compacted to its fundamental child class before applying the remaining affinal suffix.",
    );
    expect(result.socialTerm).toBe("Vanyarikani");
  });

  it("classifies every graph-connected pair without falling through to unrelated or unmapped", () => {
    const people = [
      person("ego", "M", { spouseIds: ["wife"] }),
      person("wife-father", "M"),
      person("wife", "F", {
        fatherId: "wife-father",
        spouseIds: ["ego"],
      }),
      person("wifes-sister", "F", {
        fatherId: "wife-father",
        spouseIds: ["sisters-husband"],
      }),
      person("husbands-father", "M"),
      person("sisters-husband", "M", {
        fatherId: "husbands-father",
        spouseIds: ["wifes-sister"],
      }),
      person("husbands-sister", "F", { fatherId: "husbands-father" }),
    ];
    const resolver = resolverFor(people);
    const acceptableStatuses = new Set(["known", "ambiguous", "broad"]);

    for (const ego of people) {
      for (const target of people) {
        const result = resolver.resolve({
          egoId: ego.id,
          targetId: target.id,
        });

        expect(
          acceptableStatuses.has(result.status),
          `${ego.id} -> ${target.id} unexpectedly resolved as ${result.status}`,
        ).toBe(true);
      }
    }

    const formerlyUnmapped = resolver.resolve({
      egoId: "ego",
      targetId: "husbands-sister",
    });
    expect(formerlyUnmapped.status).toBe("broad");
    expect(formerlyUnmapped.title).toBe("Hama");
    expect(formerlyUnmapped.ruleId).toBe("COMPOSED_REACHABLE_RELATIVE");
  });

  it("reserves unrelated for people with no graph path", () => {
    const result = resolve(
      [person("ego", "M"), person("stranger", "F")],
      { egoId: "ego", targetId: "stranger" },
    );

    expect(result.status).toBe("unrelated");
    expect(result.title).toBe("Mutorwa / Relationship Unmapped");
  });

  it("resolves a male ego's wife's brother as Tsano / Tezvara", () => {
    const people = [
      person("wifes-father", "M"),
      person("wife", "F", {
        fatherId: "wifes-father",
        spouseIds: ["ego"],
      }),
      person("wifes-brother", "M", { fatherId: "wifes-father" }),
      person("ego", "M", { spouseIds: ["wife"] }),
    ];

    const result = resolve(people, {
      egoId: "ego",
      targetId: "wifes-brother",
    });

    expect(result.traversal?.canonicalPath).toEqual(["W", "B"]);
    expect(result.title).toBe("Tezvara");
    expect(result.aliases).toContain("Tsano");
    expect(result.ruleId).toBe("AFFINAL_WIFE_GIVING_MALE_LINEAGE");
  });

  it("expects a male ego's wife's brother's son to resolve as Sekuru", () => {
    const people = [
      person("wifes-father", "M"),
      person("wife", "F", {
        fatherId: "wifes-father",
        spouseIds: ["ego"],
      }),
      person("wifes-brother", "M", { fatherId: "wifes-father" }),
      person("wifes-brothers-son", "M", { fatherId: "wifes-brother" }),
      person("ego", "M", { spouseIds: ["wife"] }),
    ];

    const result = resolve(people, {
      egoId: "ego",
      targetId: "wifes-brothers-son",
    });

    expect(result.traversal?.canonicalPath).toEqual(["W", "B", "S"]);
    expect(result.title).toBe("Sekuru");
    expect(result.ruleId).toBe("AFFINAL_WIFES_BROTHERS_SON");
    expect(result.socialTerm).toBe("Vasekedzani");
  });

  it("expects a male ego's wife's brother's daughter to resolve as Mainini", () => {
    const people = [
      person("wifes-father", "M"),
      person("wife", "F", {
        fatherId: "wifes-father",
        spouseIds: ["ego"],
      }),
      person("wifes-brother", "M", { fatherId: "wifes-father" }),
      person("wifes-brothers-daughter", "F", {
        fatherId: "wifes-brother",
      }),
      person("ego", "M", { spouseIds: ["wife"] }),
    ];

    const result = resolve(people, {
      egoId: "ego",
      targetId: "wifes-brothers-daughter",
    });

    expect(result.traversal?.canonicalPath).toEqual(["W", "B", "D"]);
    expect(result.title).toBe("Mainini");
    expect(result.aliases).toContain("Muramu");
    expect(result.ruleId).toBe("AFFINAL_WIFES_BROTHERS_DAUGHTER");
    expect(result.socialTerm).toBe("Vasekedzani");
  });

  it("resolves the direct wife-receiver axis for a female ego", () => {
    const people = [
      person("hf", "M"),
      person("hm", "F"),
      person("husband", "M", {
        fatherId: "hf",
        motherId: "hm",
        spouseIds: ["ego"],
        birthOrder: 2,
      }),
      person("hb-old", "M", { fatherId: "hf", birthOrder: 1 }),
      person("hb-young", "M", { fatherId: "hf", birthOrder: 3 }),
      person("hz", "F", { fatherId: "hf" }),
      person("ego", "F", { spouseIds: ["husband"] }),
    ];

    const fatherInLaw = resolve(people, { egoId: "ego", targetId: "hf" });
    const motherInLaw = resolve(people, { egoId: "ego", targetId: "hm" });
    const sisterInLaw = resolve(people, { egoId: "ego", targetId: "hz" });
    const olderBrotherInLaw = resolve(people, {
      egoId: "ego",
      targetId: "hb-old",
    });
    const youngerBrotherInLaw = resolve(people, {
      egoId: "ego",
      targetId: "hb-young",
    });
    const husband = resolve(people, { egoId: "ego", targetId: "husband" });

    expect(husband.title).toBe("Murume");
    expect(husband.socialTerm).toBe("Vakaroorana");
    expect(fatherInLaw.title).toBe("Tezvara");
    expect(fatherInLaw.socialTerm).toBe("Vanyarikani");
    expect(motherInLaw.title).toBe("Vamwene");
    expect(motherInLaw.kinClass).toBe("MOTHER_IN_LAW");
    expect(motherInLaw.socialTerm).toBe("Vanyarikani");
    expect(sisterInLaw.title).toBe("Tete");
    expect(sisterInLaw.socialTerm).toBe("Vanyarikani");
    expect(olderBrotherInLaw.title).toBe("Bamkuru");
    expect(olderBrotherInLaw.aliases).toEqual(["Bamkuru", "Muramu"]);
    expect(olderBrotherInLaw.socialTerm).toBe("Vasekedzani");
    expect(youngerBrotherInLaw.title).toBe("Bamnini");
    expect(youngerBrotherInLaw.aliases).toEqual(["Bamnini", "Muramu"]);
    expect(youngerBrotherInLaw.socialTerm).toBe("Vasekedzani");
  });

  it("resolves a female ego's husband's younger brother's wife as Mainini", () => {
    const people = [
      person("husbands-father", "M"),
      person("husband", "M", {
        fatherId: "husbands-father",
        spouseIds: ["ego"],
        birthOrder: 1,
      }),
      person("husbands-younger-brother", "M", {
        fatherId: "husbands-father",
        spouseIds: ["younger-brothers-wife"],
        birthOrder: 2,
      }),
      person("younger-brothers-wife", "F", {
        spouseIds: ["husbands-younger-brother"],
      }),
      person("ego", "F", { spouseIds: ["husband"] }),
    ];

    const result = resolve(people, {
      egoId: "ego",
      targetId: "younger-brothers-wife",
    });

    expect(result.traversal?.rawPath).toEqual(["H", "F", "S", "W"]);
    expect(result.traversal?.canonicalPath).toEqual(["H", "B", "W"]);
    expect(result.title).toBe("Mainini");

    const reciprocal = resolve(people, {
      egoId: "younger-brothers-wife",
      targetId: "ego",
    });
    expect(reciprocal.title).toBe("Maiguru");
  });

  it.each([
    {
      relationship: "husband's younger brother",
      targetId: "husbands-younger-brother",
      canonicalPath: ["H", "B"],
      expectedTitle: "Bamnini",
      expectedAlias: "Muramu",
    },
    {
      relationship: "husband's older brother",
      targetId: "husbands-older-brother",
      canonicalPath: ["H", "B"],
      expectedTitle: "Bamkuru",
      expectedAlias: "Muramu",
    },
    {
      relationship: "husband's younger brother's son",
      targetId: "younger-brothers-son",
      canonicalPath: ["H", "B", "S"],
      expectedTitle: "Mwana",
    },
    {
      relationship: "husband's younger brother's daughter",
      targetId: "younger-brothers-daughter",
      canonicalPath: ["H", "B", "D"],
      expectedTitle: "Mwana",
    },
    {
      relationship: "husband's older brother's son",
      targetId: "older-brothers-son",
      canonicalPath: ["H", "B", "S"],
      expectedTitle: "Mwana",
    },
    {
      relationship: "husband's older brother's daughter",
      targetId: "older-brothers-daughter",
      canonicalPath: ["H", "B", "D"],
      expectedTitle: "Mwana",
    },
    {
      relationship: "husband's sister",
      targetId: "husbands-sister",
      canonicalPath: ["H", "Z"],
      expectedTitle: "Tete",
    },
    {
      relationship: "husband's sister's son",
      targetId: "sisters-son",
      canonicalPath: ["H", "Z", "S"],
      expectedTitle: "Muzukuru",
    },
    {
      relationship: "husband's sister's daughter",
      targetId: "sisters-daughter",
      canonicalPath: ["H", "Z", "D"],
      expectedTitle: "Muzukuru",
    },
  ] as const)(
    "resolves a female ego's $relationship as $expectedTitle",
    ({ targetId, canonicalPath, expectedTitle, expectedAlias }) => {
      const people = [
        person("husbands-father", "M"),
        person("husbands-older-brother", "M", {
          fatherId: "husbands-father",
          birthOrder: 1,
        }),
        person("husband", "M", {
          fatherId: "husbands-father",
          spouseIds: ["ego"],
          birthOrder: 2,
        }),
        person("husbands-younger-brother", "M", {
          fatherId: "husbands-father",
          birthOrder: 3,
        }),
        person("husbands-sister", "F", {
          fatherId: "husbands-father",
        }),
        person("younger-brothers-son", "M", {
          fatherId: "husbands-younger-brother",
        }),
        person("younger-brothers-daughter", "F", {
          fatherId: "husbands-younger-brother",
        }),
        person("older-brothers-son", "M", {
          fatherId: "husbands-older-brother",
        }),
        person("older-brothers-daughter", "F", {
          fatherId: "husbands-older-brother",
        }),
        person("sisters-son", "M", {
          motherId: "husbands-sister",
        }),
        person("sisters-daughter", "F", {
          motherId: "husbands-sister",
        }),
        person("ego", "F", { spouseIds: ["husband"] }),
      ];

      const result = resolve(people, { egoId: "ego", targetId });

      expect(result.traversal?.canonicalPath).toEqual(canonicalPath);
      expect(result.title).toBe(expectedTitle);
      if (expectedAlias) expect(result.aliases).toContain(expectedAlias);
    },
  );

  it.each([
    {
      relationship: "wife's younger sister",
      targetId: "wifes-younger-sister",
      canonicalPath: ["W", "Z"],
      expectedTitle: "Mainini",
    },
    {
      relationship: "wife's older sister",
      targetId: "wifes-older-sister",
      canonicalPath: ["W", "Z"],
      expectedTitle: "Maiguru",
    },
    {
      relationship: "wife's younger sister's son",
      targetId: "younger-sisters-son",
      canonicalPath: ["W", "Z", "S"],
      expectedTitle: "Mwana",
    },
    {
      relationship: "wife's younger sister's daughter",
      targetId: "younger-sisters-daughter",
      canonicalPath: ["W", "Z", "D"],
      expectedTitle: "Mwana",
    },
    {
      relationship: "wife's older sister's son",
      targetId: "older-sisters-son",
      canonicalPath: ["W", "Z", "S"],
      expectedTitle: "Mwana",
    },
    {
      relationship: "wife's older sister's daughter",
      targetId: "older-sisters-daughter",
      canonicalPath: ["W", "Z", "D"],
      expectedTitle: "Mwana",
    },
    {
      relationship: "wife's brother",
      targetId: "wifes-brother",
      canonicalPath: ["W", "B"],
      expectedTitle: "Tezvara",
      expectedAlias: "Tsano",
    },
    {
      relationship: "wife's brother's son",
      targetId: "brothers-son",
      canonicalPath: ["W", "B", "S"],
      expectedTitle: "Sekuru",
    },
    {
      relationship: "wife's brother's daughter",
      targetId: "brothers-daughter",
      canonicalPath: ["W", "B", "D"],
      expectedTitle: "Mainini",
    },
  ] as const)(
    "resolves a male ego's $relationship as $expectedTitle",
    ({ targetId, canonicalPath, expectedTitle, expectedAlias }) => {
      const people = [
        person("wifes-father", "M"),
        person("wifes-older-sister", "F", {
          fatherId: "wifes-father",
          birthOrder: 1,
        }),
        person("wife", "F", {
          fatherId: "wifes-father",
          spouseIds: ["ego"],
          birthOrder: 2,
        }),
        person("wifes-younger-sister", "F", {
          fatherId: "wifes-father",
          birthOrder: 3,
        }),
        person("wifes-brother", "M", {
          fatherId: "wifes-father",
        }),
        person("younger-sisters-son", "M", {
          motherId: "wifes-younger-sister",
        }),
        person("younger-sisters-daughter", "F", {
          motherId: "wifes-younger-sister",
        }),
        person("older-sisters-son", "M", {
          motherId: "wifes-older-sister",
        }),
        person("older-sisters-daughter", "F", {
          motherId: "wifes-older-sister",
        }),
        person("brothers-son", "M", {
          fatherId: "wifes-brother",
        }),
        person("brothers-daughter", "F", {
          fatherId: "wifes-brother",
        }),
        person("ego", "M", { spouseIds: ["wife"] }),
      ];

      const result = resolve(people, { egoId: "ego", targetId });

      expect(result.traversal?.canonicalPath).toEqual(canonicalPath);
      expect(result.title).toBe(expectedTitle);
      if (expectedAlias) expect(result.aliases).toContain(expectedAlias);
    },
  );

  it("gives a wife's sisters' husbands reciprocal seniority titles", () => {
    const people = [
      person("wifes-father", "M"),
      person("older-sister", "F", {
        fatherId: "wifes-father",
        spouseIds: ["older-sisters-husband"],
        birthOrder: 1,
      }),
      person("wife", "F", {
        fatherId: "wifes-father",
        spouseIds: ["ego"],
        birthOrder: 2,
      }),
      person("younger-sister", "F", {
        fatherId: "wifes-father",
        spouseIds: ["younger-sisters-husband"],
        birthOrder: 3,
      }),
      person("older-sisters-husband", "M", {
        spouseIds: ["older-sister"],
      }),
      person("younger-sisters-husband", "M", {
        spouseIds: ["younger-sister"],
      }),
      person("ego", "M", { spouseIds: ["wife"] }),
    ];

    const older = resolve(people, {
      egoId: "ego",
      targetId: "older-sisters-husband",
    });
    const younger = resolve(people, {
      egoId: "ego",
      targetId: "younger-sisters-husband",
    });

    expect(older.traversal?.canonicalPath).toEqual(["W", "Z", "H"]);
    expect(older.title).toBe("Bamkuru");
    expect(younger.traversal?.canonicalPath).toEqual(["W", "Z", "H"]);
    expect(younger.title).toBe("Bamnini");
  });

  it("preserves Mwana rank and adds Muroora or Mukwasha across marriage", () => {
    const people = [
      person("father", "M"),
      person("ego", "M", { fatherId: "father" }),
      person("brother", "M", { fatherId: "father" }),
      person("brothers-son", "M", {
        fatherId: "brother",
        spouseIds: ["sons-wife"],
      }),
      person("sons-wife", "F", { spouseIds: ["brothers-son"] }),
      person("brothers-daughter", "F", {
        fatherId: "brother",
        spouseIds: ["daughters-husband"],
      }),
      person("daughters-husband", "M", {
        spouseIds: ["brothers-daughter"],
      }),
    ];

    const femaleSpouse = resolve(people, {
      egoId: "ego",
      targetId: "sons-wife",
    });
    const maleSpouse = resolve(people, {
      egoId: "ego",
      targetId: "daughters-husband",
    });

    expect(femaleSpouse.title).toBe("Mwana");
    expect(femaleSpouse.aliases).toContain("Muroora");
    expect(maleSpouse.title).toBe("Mwana");
    expect(maleSpouse.aliases).toContain("Mukwasha");
  });

  it("projects same-sex sibling spouses from Mukoma and Munin'ina", () => {
    const people = [
      person("brothers-father", "M"),
      person("older-brother", "M", {
        fatherId: "brothers-father",
        spouseIds: ["older-brothers-wife"],
        birthOrder: 1,
      }),
      person("male-ego", "M", {
        fatherId: "brothers-father",
        birthOrder: 2,
      }),
      person("younger-brother", "M", {
        fatherId: "brothers-father",
        spouseIds: ["younger-brothers-wife"],
        birthOrder: 3,
      }),
      person("older-brothers-wife", "F", {
        spouseIds: ["older-brother"],
      }),
      person("younger-brothers-wife", "F", {
        spouseIds: ["younger-brother"],
      }),
      person("sisters-mother", "F"),
      person("older-sister", "F", {
        motherId: "sisters-mother",
        spouseIds: ["older-sisters-husband"],
        birthOrder: 1,
      }),
      person("female-ego", "F", {
        motherId: "sisters-mother",
        birthOrder: 2,
      }),
      person("younger-sister", "F", {
        motherId: "sisters-mother",
        spouseIds: ["younger-sisters-husband"],
        birthOrder: 3,
      }),
      person("older-sisters-husband", "M", {
        spouseIds: ["older-sister"],
      }),
      person("younger-sisters-husband", "M", {
        spouseIds: ["younger-sister"],
      }),
    ];

    expect(
      resolve(people, { egoId: "male-ego", targetId: "older-brothers-wife" })
        .title,
    ).toBe("Maiguru");
    expect(
      resolve(people, { egoId: "male-ego", targetId: "younger-brothers-wife" })
        .title,
    ).toBe("Mainini");
    expect(
      resolve(people, {
        egoId: "female-ego",
        targetId: "older-sisters-husband",
      }).title,
    ).toBe("Bamkuru");
    expect(
      resolve(people, {
        egoId: "female-ego",
        targetId: "younger-sisters-husband",
      }).title,
    ).toBe("Bamnini");
  });

  it("resolves a male ego's younger brother's wife as Mainini", () => {
    const people = [
      person("father", "M"),
      person("ego", "M", { fatherId: "father", birthOrder: 1 }),
      person("younger-brother", "M", {
        fatherId: "father",
        spouseIds: ["younger-brothers-wife"],
        birthOrder: 2,
      }),
      person("younger-brothers-wife", "F", {
        spouseIds: ["younger-brother"],
      }),
    ];

    const result = resolve(people, {
      egoId: "ego",
      targetId: "younger-brothers-wife",
    });

    expect(result.traversal?.canonicalPath).toEqual(["B", "W"]);
    expect(result.title).toBe("Mainini");
    expect(result.ruleId).toBe("AFFINAL_MUNININA_WIFE");
  });

  it("preserves Muzukuru across the Muzukuru's marriage", () => {
    const people = [
      person("father", "M"),
      person("ego", "M", { fatherId: "father" }),
      person("sister", "F", { fatherId: "father" }),
      person("sisters-son", "M", {
        motherId: "sister",
        spouseIds: ["sisters-sons-wife"],
      }),
      person("sisters-sons-wife", "F", {
        spouseIds: ["sisters-son"],
      }),
      person("sisters-daughter", "F", {
        motherId: "sister",
        spouseIds: ["sisters-daughters-husband"],
      }),
      person("sisters-daughters-husband", "M", {
        spouseIds: ["sisters-daughter"],
      }),
    ];

    const wife = resolve(people, {
      egoId: "ego",
      targetId: "sisters-sons-wife",
    });
    const husband = resolve(people, {
      egoId: "ego",
      targetId: "sisters-daughters-husband",
    });

    expect(wife.title).toBe("Muzukuru");
    expect(wife.ruleId).toBe("AFFINAL_MUZUKURU_SPOUSE");
    expect(husband.title).toBe("Muzukuru");
    expect(husband.ruleId).toBe("AFFINAL_MUZUKURU_SPOUSE");
  });

  it("projects Sekuru, Mbuya, and Tete spouses reciprocally", () => {
    const people = [
      person("maternal-grandfather", "M"),
      person("mother", "F", { fatherId: "maternal-grandfather" }),
      person("maternal-uncle", "M", {
        fatherId: "maternal-grandfather",
        spouseIds: ["uncles-wife"],
      }),
      person("uncles-wife", "F", { spouseIds: ["maternal-uncle"] }),
      person("paternal-grandfather", "M"),
      person("father", "M", { fatherId: "paternal-grandfather" }),
      person("tete", "F", {
        fatherId: "paternal-grandfather",
        spouseIds: ["tetes-husband"],
      }),
      person("tetes-husband", "M", { spouseIds: ["tete"] }),
      person("ego", "M", { fatherId: "father", motherId: "mother" }),
    ];

    const mbuya = resolve(people, { egoId: "ego", targetId: "uncles-wife" });
    const bamkuru = resolve(people, {
      egoId: "ego",
      targetId: "tetes-husband",
    });

    expect(mbuya.title).toBe("Mbuya");
    expect(mbuya.aliases).toBeUndefined();
    expect(bamkuru.title).toBe("Bamkuru");
  });

  describe("terminal spouses inherit the source relative's classificatory rank", () => {
    const people = [
      person("brothers-father", "M"),
      person("older-brother", "M", {
        fatherId: "brothers-father",
        spouseIds: ["older-brothers-wife"],
        birthOrder: 1,
      }),
      person("male-sibling-ego", "M", {
        fatherId: "brothers-father",
        birthOrder: 2,
      }),
      person("younger-brother", "M", {
        fatherId: "brothers-father",
        spouseIds: ["younger-brothers-wife"],
        birthOrder: 3,
      }),
      person("older-brothers-wife", "F", {
        spouseIds: ["older-brother"],
      }),
      person("younger-brothers-wife", "F", {
        spouseIds: ["younger-brother"],
      }),
      person("male-egos-sister", "F", {
        fatherId: "brothers-father",
        spouseIds: ["sisters-husband"],
      }),
      person("sisters-husband", "M", {
        spouseIds: ["male-egos-sister"],
      }),

      person("sisters-mother", "F"),
      person("older-sister", "F", {
        motherId: "sisters-mother",
        spouseIds: ["older-sisters-husband"],
        birthOrder: 1,
      }),
      person("female-sibling-ego", "F", {
        motherId: "sisters-mother",
        birthOrder: 2,
      }),
      person("younger-sister", "F", {
        motherId: "sisters-mother",
        spouseIds: ["younger-sisters-husband"],
        birthOrder: 3,
      }),
      person("older-sisters-husband", "M", {
        spouseIds: ["older-sister"],
      }),
      person("younger-sisters-husband", "M", {
        spouseIds: ["younger-sister"],
      }),
      person("female-egos-brother", "M", {
        motherId: "sisters-mother",
        spouseIds: ["brothers-wife"],
      }),
      person("brothers-wife", "F", {
        spouseIds: ["female-egos-brother"],
      }),

      person("child-ego", "M"),
      person("son", "M", {
        fatherId: "child-ego",
        spouseIds: ["sons-wife"],
      }),
      person("sons-wife", "F", { spouseIds: ["son"] }),
      person("daughter", "F", {
        fatherId: "child-ego",
        spouseIds: ["daughters-husband"],
      }),
      person("daughters-husband", "M", { spouseIds: ["daughter"] }),
      person("grandson", "M", {
        fatherId: "son",
        spouseIds: ["grandsons-wife"],
      }),
      person("grandsons-wife", "F", { spouseIds: ["grandson"] }),
      person("granddaughter", "F", {
        fatherId: "son",
        spouseIds: ["granddaughters-husband"],
      }),
      person("granddaughters-husband", "M", {
        spouseIds: ["granddaughter"],
      }),

      person("grandparent-ego", "M", { motherId: "grandparent-mother" }),
      person("grandparent-mother", "F", {
        fatherId: "sekuru-source",
        motherId: "ambuya-source",
      }),
      person("sekuru-source", "M", { spouseIds: ["sekuru-wife"] }),
      person("sekuru-wife", "F", { spouseIds: ["sekuru-source"] }),
      person("ambuya-source", "F", { spouseIds: ["ambuya-husband"] }),
      person("ambuya-husband", "M", { spouseIds: ["ambuya-source"] }),
    ];

    const cases = [
      [
        "Mukoma to female spouse",
        "male-sibling-ego",
        "older-brother",
        "older-brothers-wife",
        "Mukoma",
        ["Maiguru"],
      ],
      [
        "Mukoma to male spouse",
        "female-sibling-ego",
        "older-sister",
        "older-sisters-husband",
        "Mukoma",
        ["Bamkuru"],
      ],
      [
        "Munin'ina to female spouse",
        "male-sibling-ego",
        "younger-brother",
        "younger-brothers-wife",
        "Munin'ina",
        ["Mainini"],
      ],
      [
        "Munin'ina to male spouse",
        "female-sibling-ego",
        "younger-sister",
        "younger-sisters-husband",
        "Munin'ina",
        ["Bamnini"],
      ],
      [
        "Sekuru to female spouse",
        "grandparent-ego",
        "sekuru-source",
        "sekuru-wife",
        "Sekuru",
        ["Mbuya"],
      ],
      [
        "Mbuya to male spouse",
        "grandparent-ego",
        "ambuya-source",
        "ambuya-husband",
        "Mbuya",
        ["Sekuru"],
      ],
      [
        "Muzukuru to female spouse",
        "child-ego",
        "grandson",
        "grandsons-wife",
        "Muzukuru",
        ["Muzukuru"],
      ],
      [
        "Muzukuru to male spouse",
        "child-ego",
        "granddaughter",
        "granddaughters-husband",
        "Muzukuru",
        ["Muzukuru"],
      ],
      [
        "Mwana to female spouse",
        "child-ego",
        "son",
        "sons-wife",
        "Mwana",
        ["Mwana", "Muroora"],
      ],
      [
        "Mwana to male spouse",
        "child-ego",
        "daughter",
        "daughters-husband",
        "Mwana",
        ["Mwana", "Mukwasha"],
      ],
      [
        "Hanzvadzi to female spouse",
        "female-sibling-ego",
        "female-egos-brother",
        "brothers-wife",
        "Hanzvadzi",
        ["Maiguru", "Muroora"],
      ],
      [
        "Hanzvadzi to male spouse",
        "male-sibling-ego",
        "male-egos-sister",
        "sisters-husband",
        "Hanzvadzi",
        ["Tsano", "Mukwasha"],
      ],
    ] as const;

    it.each(cases)(
      "%s",
      (
        _caseName,
        egoId,
        sourceId,
        spouseId,
        expectedSourceTitle,
        expectedSpouseTerms,
      ) => {
        const source = resolve(people, { egoId, targetId: sourceId });
        const spouse = resolve(people, { egoId, targetId: spouseId });
        const actualSpouseTerms = [spouse.title, ...(spouse.aliases ?? [])]
          .flatMap((title) => title.split("/"))
          .map((title) => title.trim());

        expect(source.title).toBe(expectedSourceTitle);
        expect(actualSpouseTerms).toEqual(
          expect.arrayContaining([...expectedSpouseTerms]),
        );
      },
    );
  });

  it.each([
    [
      "ego-wife",
      "maternal-uncles-wife",
      ["H", "M", "B", "W"],
      "Mbuya",
      undefined,
    ],
    [
      "maternal-uncles-wife",
      "ego-wife",
      ["H", "Z", "S", "W"],
      "Muzukuru",
      undefined,
    ],
  ] as const)(
    "resolves the relationship from %s to %s",
    (egoId, targetId, canonicalPath, expectedTitle, expectedAlias) => {
      const people = [
        person("maternal-grandfather", "M"),
        person("mother", "F", {
          fatherId: "maternal-grandfather",
          birthOrder: 1,
        }),
        person("maternal-uncle", "M", {
          fatherId: "maternal-grandfather",
          spouseIds: ["maternal-uncles-wife"],
          birthOrder: 2,
        }),
        person("maternal-uncles-wife", "F", {
          spouseIds: ["maternal-uncle"],
        }),
        person("male-ego", "M", {
          motherId: "mother",
          spouseIds: ["ego-wife"],
        }),
        person("ego-wife", "F", { spouseIds: ["male-ego"] }),
      ];

      const result = resolve(people, { egoId, targetId });

      expect(result.traversal?.canonicalPath).toEqual(canonicalPath);
      expect(result.title).toBe(expectedTitle);
      if (expectedAlias) expect(result.aliases).toContain(expectedAlias);
    },
  );

  it("projects a female ego's younger brother's wife to Muroora or Maiguru", () => {
    const people = [
      person("father", "M"),
      person("male-ego", "M", { fatherId: "father" }),
      person("sister", "F", {
        fatherId: "father",
        spouseIds: ["sisters-husband"],
      }),
      person("sisters-husband", "M", { spouseIds: ["sister"] }),
      person("female-ego", "F", {
        fatherId: "father",
        birthOrder: 1,
      }),
      person("brother", "M", {
        fatherId: "father",
        spouseIds: ["brothers-wife"],
        birthOrder: 2,
      }),
      person("brothers-wife", "F", { spouseIds: ["brother"] }),
    ];

    expect(
      resolve(people, { egoId: "male-ego", targetId: "sisters-husband" }).title,
    ).toBe("Tsano");
    const brothersWife = resolve(people, {
      egoId: "female-ego",
      targetId: "brothers-wife",
    });
    expect(brothersWife.traversal?.canonicalPath).toEqual(["B", "W"]);
    expect(brothersWife.title).toBe("Muroora");
    expect(brothersWife.aliases).toContain("Maiguru");
    expect(brothersWife.ruleId).toBe("AFFINAL_FEMALE_EGO_BROTHERS_WIFE");

    const reciprocal = resolve(people, {
      egoId: "brothers-wife",
      targetId: "female-ego",
    });
    expect(reciprocal.title).toBe("Tete");
  });

  it("projects the wife-giving terms recursively over a patrilineage", () => {
    const people = [
      person("wife-grandfather", "M"),
      person("wife-father", "M", { fatherId: "wife-grandfather" }),
      person("wife-uncle", "M", { fatherId: "wife-grandfather" }),
      person("wife-aunt", "F", { fatherId: "wife-grandfather" }),
      person("wife", "F", {
        fatherId: "wife-father",
        spouseIds: ["ego"],
      }),
      person("wife-cousin", "M", { fatherId: "wife-uncle" }),
      person("ego", "M", { spouseIds: ["wife"] }),
    ];

    const uncle = resolve(people, { egoId: "ego", targetId: "wife-uncle" });
    const aunt = resolve(people, { egoId: "ego", targetId: "wife-aunt" });
    const cousin = resolve(people, { egoId: "ego", targetId: "wife-cousin" });

    expect(uncle.title).toBe("Tezvara");
    expect(uncle.socialTerm).toBe("Vanyarikani");
    expect(aunt.title).toBe("Muramu");
    expect(aunt.socialTerm).toBe("Vasekedzani");
    expect(cousin.title).toBe("Tezvara");
    expect(cousin.socialTerm).toBe("Vanyarikani");
  });

  it("promotes a spouse's parallel parents before affinal projection", () => {
    const people = [
      person("wife-maternal-grandfather", "M"),
      person("wife-mother", "F", { fatherId: "wife-maternal-grandfather" }),
      person("wife-mothers-sister", "F", {
        fatherId: "wife-maternal-grandfather",
      }),
      person("wife", "F", {
        motherId: "wife-mother",
        spouseIds: ["male-ego"],
      }),
      person("male-ego", "M", { spouseIds: ["wife"] }),
      person("husband-maternal-grandfather", "M"),
      person("husband-mother", "F", {
        fatherId: "husband-maternal-grandfather",
      }),
      person("husband-mothers-sister", "F", {
        fatherId: "husband-maternal-grandfather",
      }),
      person("husband", "M", {
        motherId: "husband-mother",
        spouseIds: ["female-ego"],
      }),
      person("female-ego", "F", { spouseIds: ["husband"] }),
    ];

    const wifeMotherClass = resolve(people, {
      egoId: "male-ego",
      targetId: "wife-mothers-sister",
    });
    const husbandMotherClass = resolve(people, {
      egoId: "female-ego",
      targetId: "husband-mothers-sister",
    });

    expect(wifeMotherClass.title).toBe("Ambuya");
    expect(wifeMotherClass.socialTerm).toBe("Vanyarikani");
    expect(husbandMotherClass.title).toBe("Vamwene");
    expect(husbandMotherClass.socialTerm).toBe("Vanyarikani");
  });

  it("projects husband-line generations without full-path lookup entries", () => {
    const people = [
      person("husband-grandfather", "M"),
      person("husband-grandmother", "F"),
      person("husband-father", "M", {
        fatherId: "husband-grandfather",
        motherId: "husband-grandmother",
      }),
      person("husband-uncle", "M", { fatherId: "husband-grandfather" }),
      person("husband-aunt", "F", { fatherId: "husband-grandfather" }),
      person("husband", "M", {
        fatherId: "husband-father",
        spouseIds: ["ego"],
      }),
      person("ego", "F", { spouseIds: ["husband"] }),
    ];

    const grandfather = resolve(people, {
      egoId: "ego",
      targetId: "husband-grandfather",
    });
    const grandmother = resolve(people, {
      egoId: "ego",
      targetId: "husband-grandmother",
    });
    const uncle = resolve(people, {
      egoId: "ego",
      targetId: "husband-uncle",
    });
    const aunt = resolve(people, {
      egoId: "ego",
      targetId: "husband-aunt",
    });

    expect(grandfather.title).toBe("Sekuru");
    expect(grandfather.socialTerm).toBe("Vasekedzani");
    expect(grandmother.title).toBe("Mbuya");
    expect(grandmother.socialTerm).toBe("Vasekedzani");
    expect(uncle.title).toBe("Tezvara");
    expect(uncle.socialTerm).toBe("Vanyarikani");
    expect(aunt.title).toBe("Vamwene");
    expect(aunt.socialTerm).toBe("Vanyarikani");
  });

  it("applies the maternal generational transformation recursively", () => {
    // Use an explicit K-path reduction test because a graph-native person cannot
    // give two mothers to the same sibling; the law itself is algebraic.
    const result = new PathReducer().reduce(["B", "M", "B", "S"], {
      egoId: "ego",
      targetId: "uncle-son",
      egoSex: "M",
      targetSex: "M",
      relativeAge: "unknown",
      siblingSeniorities: [],
      generationDistance: 0,
    });
    expect(result.reducedPath).toEqual(["M", "B", "S"]);
  });

  it("materializes a spouse as the child's classificatory parent", () => {
    const people = [
      person("ego", "M", { spouseIds: ["wife"] }),
      person("wife", "F", { spouseIds: ["ego"] }),
      person("wife-daughter", "F", { motherId: "wife" }),
    ];
    const result = resolve(people, { egoId: "ego", targetId: "wife-daughter" });

    expect(result.status).toBe("known");
    expect(result.traversal?.rawPath).toEqual(["D"]);
    expect(result.title).toBe("Mwana");
    expect(result.ruleId).toBe("BASIC_D");
  });
});

describe("legacy application adapter", () => {
  it("treats parentage as full classificatory lineage", () => {
    const people: LegacyPerson[] = [
      {
        id: "ego",
        firstName: "Ego",
        surname: "M",
        sex: "male",
        dateOfBirth: "2000-01-01",
      },
      { id: "father", firstName: "Father", surname: "M", sex: "male" },
      { id: "uncle", firstName: "Uncle", surname: "M", sex: "male" },
      {
        id: "cousin",
        firstName: "Cousin",
        surname: "M",
        sex: "male",
        dateOfBirth: "1998-01-01",
      },
    ];
    const relationships: Relationship[] = [
      {
        id: "parent",
        type: "PARENT_OF",
        personAId: "father",
        personBId: "ego",
      },
      {
        id: "father-uncle",
        type: "SIBLING_OF",
        personAId: "uncle",
        personBId: "father",
        seniority: "A_OLDER",
      },
      {
        id: "uncle-cousin",
        type: "PARENT_OF",
        personAId: "uncle",
        personBId: "cousin",
      },
    ];

    const pibling = resolveKinship("ego", "uncle", people, relationships);
    const cousin = resolveKinship("ego", "cousin", people, relationships);

    expect(pibling.path?.steps).toEqual(["father", "brother"]);
    expect(pibling.title).toBe("Bamkuru");
    expect(cousin.path?.steps).toEqual(["father", "brother", "son"]);
    expect(cousin.title).toBe("Mukoma");
  });

  it("includes a spouse-derived parent's piblings and cousins in the child's lineage", () => {
    const people: LegacyPerson[] = [
      {
        id: "ego",
        firstName: "Ego",
        surname: "M",
        sex: "male",
        dateOfBirth: "2000-01-01",
      },
      { id: "mother", firstName: "Mother", surname: "M", sex: "female" },
      { id: "father", firstName: "Father", surname: "M", sex: "male" },
      { id: "pibling", firstName: "Pibling", surname: "M", sex: "male" },
      {
        id: "cousin",
        firstName: "Cousin",
        surname: "M",
        sex: "male",
        dateOfBirth: "1998-01-01",
      },
    ];
    const relationships: Relationship[] = [
      {
        id: "mother-ego",
        type: "PARENT_OF",
        personAId: "mother",
        personBId: "ego",
      },
      {
        id: "marriage",
        type: "SPOUSE_OF",
        personAId: "mother",
        personBId: "father",
      },
      {
        id: "siblings",
        type: "SIBLING_OF",
        personAId: "father",
        personBId: "pibling",
        seniority: "A_OLDER",
      },
      {
        id: "pibling-child",
        type: "PARENT_OF",
        personAId: "pibling",
        personBId: "cousin",
      },
    ];

    const pibling = resolveKinship("ego", "pibling", people, relationships);
    const cousin = resolveKinship("ego", "cousin", people, relationships);

    expect(pibling.path?.steps).toEqual(["father", "brother"]);
    expect(pibling.status).toBe("known");
    expect(pibling.title).toBe("Bamnini");
    expect(cousin.path?.steps).toEqual(["father", "brother", "son"]);
    expect(cousin.status).toBe("known");
    expect(cousin.title).toBe("Mukoma");
  });

  it("materializes a mother's husband as a full classificatory father", () => {
    const people: LegacyPerson[] = [
      { id: "ebba", firstName: "Ebba", surname: "M", sex: "female" },
      { id: "johnson", firstName: "Johnson", surname: "M", sex: "male" },
      { id: "tiri", firstName: "Tiri", surname: "M", sex: "male" },
      { id: "tina", firstName: "Tina", surname: "M", sex: "female" },
      { id: "johnson-father", firstName: "Father", surname: "M", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "ebba-tiri",
        type: "PARENT_OF",
        personAId: "ebba",
        personBId: "tiri",
      },
      {
        id: "ebba-tina",
        type: "PARENT_OF",
        personAId: "ebba",
        personBId: "tina",
      },
      {
        id: "ebba-johnson",
        type: "SPOUSE_OF",
        personAId: "ebba",
        personBId: "johnson",
      },
      {
        id: "johnson-father",
        type: "PARENT_OF",
        personAId: "johnson-father",
        personBId: "johnson",
      },
    ];

    const father = resolveKinship("tiri", "johnson", people, relationships);
    const child = resolveKinship("johnson", "tiri", people, relationships);
    const johnsonsFather = resolveKinship(
      "tiri",
      "johnson-father",
      people,
      relationships,
    );

    expect(father.path?.steps).toEqual(["father"]);
    expect(father.title).toBe("Baba");
    expect(father.ruleId).toBe("BASIC_F");
    expect(resolveKinship("tina", "johnson", people, relationships).title).toBe(
      "Baba",
    );

    expect(child.path?.steps).toEqual(["son"]);
    expect(child.title).toBe("Mwana");
    expect(child.ruleId).toBe("BASIC_S");

    expect(johnsonsFather.path?.steps).toEqual(["father", "father"]);
    expect(johnsonsFather.status).toBe("known");
    expect(johnsonsFather.title).toBe("Sekuru");
  });

  it("materializes a father's wife as a full classificatory mother", () => {
    const people: LegacyPerson[] = [
      { id: "father", firstName: "Father", surname: "M", sex: "male" },
      { id: "wife", firstName: "Wife", surname: "M", sex: "female" },
      { id: "child", firstName: "Child", surname: "M", sex: "female" },
    ];
    const relationships: Relationship[] = [
      {
        id: "father-child",
        type: "PARENT_OF",
        personAId: "father",
        personBId: "child",
      },
      {
        id: "marriage",
        type: "SPOUSE_OF",
        personAId: "father",
        personBId: "wife",
      },
    ];

    const result = resolveKinship("child", "wife", people, relationships);
    expect(result.path?.steps).toEqual(["mother"]);
    expect(result.title).toBe("Mai");
    expect(result.ruleId).toBe("BASIC_M");
  });

  it("coalesces explicit and spouse-derived parent edges", () => {
    const people: LegacyPerson[] = [
      { id: "ebba", firstName: "Ebba", surname: "M", sex: "female" },
      { id: "johnson", firstName: "Johnson", surname: "M", sex: "male" },
      { id: "tiri", firstName: "Tiri", surname: "M", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "ebba-tiri",
        type: "PARENT_OF",
        personAId: "ebba",
        personBId: "tiri",
      },
      {
        id: "johnson-tiri",
        type: "PARENT_OF",
        personAId: "johnson",
        personBId: "tiri",
      },
      {
        id: "marriage",
        type: "SPOUSE_OF",
        personAId: "ebba",
        personBId: "johnson",
      },
    ];

    const result = resolveKinship("tiri", "johnson", people, relationships);
    expect(result.path?.steps).toEqual(["father"]);
    expect(result.title).toBe("Baba");
    expect(result.ruleId).toBe("BASIC_F");
  });

  it("treats a functional parent and their ancestry as classificatory kin", () => {
    const people: LegacyPerson[] = [
      { id: "child", firstName: "Child", surname: "M", sex: "female" },
      { id: "father", firstName: "Father", surname: "M", sex: "male" },
      { id: "grandfather", firstName: "Grand", surname: "M", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "parent",
        type: "PARENT_OF",
        personAId: "father",
        personBId: "child",
      },
      {
        id: "father-parent",
        type: "PARENT_OF",
        personAId: "grandfather",
        personBId: "father",
      },
    ];

    const father = resolveKinship("child", "father", people, relationships);
    const grandfather = resolveKinship(
      "child",
      "grandfather",
      people,
      relationships,
    );

    expect(father.title).toBe("Baba");
    expect(father.ruleId).toBe("BASIC_F");
    expect(grandfather.path?.steps).toEqual(["father", "father"]);
    expect(grandfather.status).toBe("known");
    expect(grandfather.title).toBe("Sekuru");
  });

  it("resolves a wife's explicitly linked brother's children through the wife-giving axis", () => {
    const people: LegacyPerson[] = [
      { id: "ego", firstName: "Ego", surname: "M", sex: "male" },
      { id: "wife", firstName: "Wife", surname: "M", sex: "female" },
      { id: "brother", firstName: "Brother", surname: "M", sex: "male" },
      { id: "son", firstName: "Son", surname: "M", sex: "male" },
      { id: "daughter", firstName: "Daughter", surname: "M", sex: "female" },
    ];
    const relationships: Relationship[] = [
      {
        id: "marriage",
        type: "SPOUSE_OF",
        personAId: "ego",
        personBId: "wife",
      },
      {
        id: "siblings",
        type: "SIBLING_OF",
        personAId: "wife",
        personBId: "brother",
        seniority: "UNKNOWN",
      },
      {
        id: "brother-son",
        type: "PARENT_OF",
        personAId: "brother",
        personBId: "son",
      },
      {
        id: "brother-daughter",
        type: "PARENT_OF",
        personAId: "brother",
        personBId: "daughter",
      },
    ];

    const son = resolveKinship("ego", "son", people, relationships);
    const daughter = resolveKinship("ego", "daughter", people, relationships);

    expect(son.path?.steps).toEqual(["wife", "brother", "son"]);
    expect(son.title).toBe("Sekuru");
    expect(daughter.path?.steps).toEqual(["wife", "brother", "daughter"]);
    expect(daughter.title).toBe("Mainini / Muramu");
    expect(daughter.aliases).toContain("Muramu");
  });

  it("preserves explicit seniority for a husband's brothers", () => {
    const people: LegacyPerson[] = [
      { id: "ego", firstName: "Ego", surname: "M", sex: "female" },
      { id: "husband", firstName: "Husband", surname: "M", sex: "male" },
      { id: "older", firstName: "Older", surname: "M", sex: "male" },
      { id: "younger", firstName: "Younger", surname: "M", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "marriage",
        type: "SPOUSE_OF",
        personAId: "ego",
        personBId: "husband",
      },
      {
        id: "older-sibling",
        type: "SIBLING_OF",
        personAId: "husband",
        personBId: "older",
        seniority: "B_OLDER",
      },
      {
        id: "younger-sibling",
        type: "SIBLING_OF",
        personAId: "husband",
        personBId: "younger",
        seniority: "A_OLDER",
      },
    ];

    expect(resolveKinship("ego", "older", people, relationships).title).toBe(
      "Bamkuru / Muramu",
    );
    expect(resolveKinship("ego", "younger", people, relationships).title).toBe(
      "Bamnini / Muramu",
    );
  });

  it("preserves explicit seniority for a wife's sisters and their husbands", () => {
    const people: LegacyPerson[] = [
      { id: "ego", firstName: "Ego", surname: "M", sex: "male" },
      { id: "wife", firstName: "Wife", surname: "M", sex: "female" },
      { id: "older", firstName: "Older", surname: "M", sex: "female" },
      { id: "younger", firstName: "Younger", surname: "M", sex: "female" },
      { id: "older-husband", firstName: "Older H", surname: "M", sex: "male" },
      {
        id: "younger-husband",
        firstName: "Younger H",
        surname: "M",
        sex: "male",
      },
    ];
    const relationships: Relationship[] = [
      {
        id: "marriage",
        type: "SPOUSE_OF",
        personAId: "ego",
        personBId: "wife",
      },
      {
        id: "older-sibling",
        type: "SIBLING_OF",
        personAId: "wife",
        personBId: "older",
        seniority: "B_OLDER",
      },
      {
        id: "younger-sibling",
        type: "SIBLING_OF",
        personAId: "wife",
        personBId: "younger",
        seniority: "A_OLDER",
      },
      {
        id: "older-marriage",
        type: "SPOUSE_OF",
        personAId: "older",
        personBId: "older-husband",
      },
      {
        id: "younger-marriage",
        type: "SPOUSE_OF",
        personAId: "younger",
        personBId: "younger-husband",
      },
    ];

    const older = resolveKinship("ego", "older", people, relationships);
    const younger = resolveKinship("ego", "younger", people, relationships);

    expect(older.title).toBe("Maiguru / Muramu");
    expect(older.aliases).toContain("Muramu");
    expect(younger.title).toBe("Mainini / Muramu");
    expect(younger.aliases).toContain("Muramu");
    expect(
      resolveKinship("ego", "older-husband", people, relationships).title,
    ).toBe("Bamkuru");
    expect(
      resolveKinship("ego", "younger-husband", people, relationships).title,
    ).toBe("Bamnini");
  });

  it("resolves an explicitly linked husband's sister as Tete", () => {
    const people: LegacyPerson[] = [
      { id: "ego", firstName: "Ego", surname: "M", sex: "female" },
      { id: "husband", firstName: "Husband", surname: "M", sex: "male" },
      { id: "sister", firstName: "Sister", surname: "M", sex: "female" },
    ];
    const relationships: Relationship[] = [
      {
        id: "marriage",
        type: "SPOUSE_OF",
        personAId: "ego",
        personBId: "husband",
      },
      {
        id: "siblings",
        type: "SIBLING_OF",
        personAId: "husband",
        personBId: "sister",
        seniority: "UNKNOWN",
      },
    ];

    expect(resolveKinship("ego", "sister", people, relationships).title).toBe(
      "Tete",
    );
  });

  it("projects resolved kin classes across marriage for explicit UI sibling links", () => {
    const people: LegacyPerson[] = [
      { id: "ego", firstName: "Ego", surname: "M", sex: "male" },
      { id: "brother", firstName: "Brother", surname: "M", sex: "male" },
      { id: "brothers-wife", firstName: "Wife", surname: "M", sex: "female" },
      { id: "brothers-son", firstName: "Son", surname: "M", sex: "male" },
      { id: "sons-wife", firstName: "Son Wife", surname: "M", sex: "female" },
      { id: "sister", firstName: "Sister", surname: "M", sex: "female" },
      {
        id: "sisters-husband",
        firstName: "Husband",
        surname: "M",
        sex: "male",
      },
    ];
    const relationships: Relationship[] = [
      {
        id: "ego-brother",
        type: "SIBLING_OF",
        personAId: "ego",
        personBId: "brother",
        seniority: "B_OLDER",
      },
      {
        id: "brother-marriage",
        type: "SPOUSE_OF",
        personAId: "brother",
        personBId: "brothers-wife",
      },
      {
        id: "brother-son",
        type: "PARENT_OF",
        personAId: "brother",
        personBId: "brothers-son",
      },
      {
        id: "son-marriage",
        type: "SPOUSE_OF",
        personAId: "brothers-son",
        personBId: "sons-wife",
      },
      {
        id: "ego-sister",
        type: "SIBLING_OF",
        personAId: "ego",
        personBId: "sister",
        seniority: "UNKNOWN",
      },
      {
        id: "sister-marriage",
        type: "SPOUSE_OF",
        personAId: "sister",
        personBId: "sisters-husband",
      },
    ];

    expect(
      resolveKinship("ego", "brothers-wife", people, relationships).title,
    ).toBe("Maiguru / Muramu");
    expect(
      resolveKinship("ego", "sons-wife", people, relationships).title,
    ).toBe("Mwana / Muroora");
    expect(
      resolveKinship("ego", "sisters-husband", people, relationships).title,
    ).toBe("Tsano / Mukwasha");
  });

  it("keeps the current React application API operational", () => {
    const people: LegacyPerson[] = [
      { id: "ego", firstName: "Ego", surname: "M", sex: "male" },
      { id: "son", firstName: "Son", surname: "M", sex: "male" },
      { id: "wife", firstName: "Wife", surname: "M", sex: "female" },
    ];
    const relationships: Relationship[] = [
      { id: "parent", type: "PARENT_OF", personAId: "ego", personBId: "son" },
      {
        id: "marriage",
        type: "SPOUSE_OF",
        personAId: "son",
        personBId: "wife",
      },
    ];

    const result = resolveKinship("ego", "wife", people, relationships);
    expect(result.title).toBe("Mwana / Muroora");
    expect(result.socialTerm).toBe("Vanyarikani");
  });

  it("preserves explicit sibling seniority for a classificatory parent's spouse", () => {
    const people: LegacyPerson[] = [
      { id: "ego", firstName: "Ego", surname: "M", sex: "male" },
      { id: "father", firstName: "Father", surname: "M", sex: "male" },
      { id: "uncle", firstName: "Uncle", surname: "M", sex: "male" },
      { id: "uncle-wife", firstName: "Wife", surname: "M", sex: "female" },
    ];
    const relationships: Relationship[] = [
      {
        id: "parent",
        type: "PARENT_OF",
        personAId: "father",
        personBId: "ego",
      },
      {
        id: "siblings",
        type: "SIBLING_OF",
        personAId: "uncle",
        personBId: "father",
        seniority: "A_OLDER",
      },
      {
        id: "marriage",
        type: "SPOUSE_OF",
        personAId: "uncle",
        personBId: "uncle-wife",
      },
    ];

    expect(
      resolveKinship("ego", "uncle-wife", people, relationships).title,
    ).toBe("Maiguru");
  });
});
