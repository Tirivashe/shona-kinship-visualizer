import { describe, expect, it } from "vitest";

import type { Person as LegacyPerson, Relationship } from "@/types/family";

import { FamilyTreeGraph } from "./family-tree-graph";
import { KinshipResolver } from "./kinship-resolver";
import type { KinQuery, Person } from "./model";
import { PathReducer } from "./path-reducer";
import { resolveKinship } from "./resolve";

function person(id: string, sex: "M" | "F", family: Partial<Person> = {}): Person {
  return { id, sex, spouseIds: [], ...family };
}

function resolverFor(people: Person[]) {
  return new KinshipResolver(new FamilyTreeGraph(people));
}

function resolve(people: Person[], query: KinQuery) {
  return resolverFor(people).resolve(query);
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
    const result = new FamilyTreeGraph(people).findShortestPath("ego", "cousin");

    expect(result?.rawPath).toEqual(["F", "F", "D", "S"]);
    expect(result?.personIds).toEqual(["ego", "father", "gf", "aunt", "cousin"]);
    expect(result?.generationDistance).toBe(0);
  });

  it("collapses parent-child traversal into anthropological siblings", () => {
    expect(FamilyTreeGraph.canonicalize(["F", "S"])).toEqual(["B"]);
    expect(FamilyTreeGraph.canonicalize(["M", "D"])).toEqual(["Z"]);
    expect(new FamilyTreeGraph(people).findShortestPath("ego", "cousin")?.canonicalPath).toEqual([
      "F",
      "Z",
      "S",
    ]);
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
});

describe("three-axis Shona algebra", () => {
  it("distinguishes same-sex siblings by relative age", () => {
    const people = [
      person("father", "M"),
      person("ego", "M", { fatherId: "father" }),
      person("brother", "M", { fatherId: "father" }),
    ];

    expect(resolve(people, { egoId: "ego", targetId: "brother", relativeAge: "older" }).title).toBe(
      "Mukoma",
    );
    expect(resolve(people, { egoId: "ego", targetId: "brother", relativeAge: "younger" }).title).toBe(
      "Munin'ina",
    );
  });

  it("classifies cross-sex siblings as Hanzvadzi without age", () => {
    const people = [
      person("mother", "F"),
      person("ego", "M", { motherId: "mother" }),
      person("sister", "F", { motherId: "mother" }),
    ];

    expect(resolve(people, { egoId: "ego", targetId: "sister" }).title).toBe("Hanzvadzi");
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
    expect(resolve(people, { egoId: "ego", targetId: "uncle-grandson" }).traversal?.canonicalPath).toEqual([
      "M",
      "B",
      "S",
      "S",
    ]);
  });

  it("resolves M.B.D specifically as Mainini", () => {
    const people = [
      person("mgf", "M"),
      person("mother", "F", { fatherId: "mgf" }),
      person("uncle", "M", { fatherId: "mgf" }),
      person("ego", "M", { motherId: "mother" }),
      person("uncle-daughter", "F", { fatherId: "uncle" }),
    ];

    const result = resolve(people, { egoId: "ego", targetId: "uncle-daughter" });
    expect(result.traversal?.canonicalPath).toEqual(["M", "B", "D"]);
    expect(result.title).toBe("Mainini");
  });

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

    expect(resolve(people, { egoId: "ego", targetId: "cousin" }).title).toBe("Muzukuru");
    },
  );

  it.each([
    ["aunts-son", "M", "S"],
    ["aunts-daughter", "F", "D"],
  ] as const)(
    "resolves a female ego's father's sister's child %s as Mwana",
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

      expect(result.traversal?.rawPath).toEqual([
        "F",
        "F",
        "D",
        childStep,
      ]);
      expect(result.traversal?.canonicalPath).toEqual([
        "F",
        "Z",
        childStep,
      ]);
      expect(result.status).toBe("known");
      expect(result.title).toBe("Mwana");
      expect(result.ruleId).toBe("PATERNAL_AUNT_CHILD_FEMALE_EGO");
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

    expect(resolve(people, { egoId: "ego", targetId: "muroora" }).title).toBe("Muroora");
    expect(resolve(people, { egoId: "ego", targetId: "mukuwasha" }).title).toBe("Mukuwasha");
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

    expect(resolve(people, { egoId: "ego", targetId: "son-in-law-father" }).title).toBe(
      "Mukurungai",
    );
    expect(resolve(people, { egoId: "ego", targetId: "son-in-law-sister" }).title).toBe(
      "Hama yeVakuwasha",
    );
    expect(resolve(people, { egoId: "ego", targetId: "daughter-in-law-mother" }).title).toBe(
      "Mukurungai",
    );
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
      person("ancestor", "M"),
      person("grandfather", "M", { fatherId: "ancestor" }),
      person("father", "M", { fatherId: "grandfather" }),
      person("ego", "M", { fatherId: "father" }),
      person("child", "F", { fatherId: "ego" }),
      person("grandchild", "M", { motherId: "child" }),
      person("great-grandchild", "F", { fatherId: "grandchild" }),
    ];

    expect(resolve(people, { egoId: "ego", targetId: "grandfather" }).title).toBe("Sekuru");
    expect(resolve(people, { egoId: "ego", targetId: "ancestor" }).title).toBe("Tateguru");
    expect(resolve(people, { egoId: "ego", targetId: "grandchild" }).title).toBe("Muzukuru");
    expect(resolve(people, { egoId: "ego", targetId: "great-grandchild" }).title).toBe(
      "Chizukuruchibvi",
    );
  });

  it("resolves the direct wife-giver axis for a male ego", () => {
    const people = [
      person("wf", "M"),
      person("wm", "F"),
      person("wife", "F", { fatherId: "wf", motherId: "wm", spouseIds: ["ego"] }),
      person("wb", "M", { fatherId: "wf" }),
      person("wz", "F", { fatherId: "wf" }),
      person("ego", "M", { spouseIds: ["wife"] }),
    ];

    expect(resolve(people, { egoId: "ego", targetId: "wf" }).title).toBe("Tezvara");
    expect(resolve(people, { egoId: "ego", targetId: "wm" }).title).toBe("Mbuywasha");
    expect(resolve(people, { egoId: "ego", targetId: "wb" }).possibilities).toEqual([
      "Tsano",
      "Tezvara",
    ]);
    expect(resolve(people, { egoId: "ego", targetId: "wz" }).title).toBe("Muramu");
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

    expect(resolve(people, { egoId: "ego", targetId: "hf" }).title).toBe("Tezvara");
    expect(resolve(people, { egoId: "ego", targetId: "hm" }).title).toBe("Vamwene");
    expect(resolve(people, { egoId: "ego", targetId: "hz" }).title).toBe("Vamwene");
    expect(
      resolve(people, { egoId: "ego", targetId: "hb-old" }).title,
    ).toBe("Babamukuru");
    expect(
      resolve(people, { egoId: "ego", targetId: "hb-young" }).title,
    ).toBe("Muramu");
  });

  it("applies the maternal generational transformation recursively", () => {
    // Use an explicit K-path reduction test because a graph-native person cannot
    // give two mothers to the same sibling; the law itself is algebraic.
    const result = new PathReducer().reduce(
      ["B", "M", "B", "S"],
      {
        egoId: "ego",
        targetId: "uncle-son",
        egoSex: "M",
        targetSex: "M",
        relativeAge: "unknown",
        structuralRelativeAge: "unknown",
        generationDistance: 0,
      },
    );
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

      const pibling = resolveKinship(
        "ego",
        "uncle",
        people,
        relationships,
      );
      const cousin = resolveKinship(
        "ego",
        "cousin",
        people,
        relationships,
      );

      expect(pibling.path?.steps).toEqual(["father", "brother"]);
      expect(pibling.title).toBe("Bamkuru");
      expect(cousin.path?.steps).toEqual([
        "father",
        "brother",
        "son",
      ]);
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
      { id: "mother-ego", type: "PARENT_OF", personAId: "mother", personBId: "ego" },
      { id: "marriage", type: "SPOUSE_OF", personAId: "mother", personBId: "father" },
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

    const pibling = resolveKinship(
      "ego",
      "pibling",
      people,
      relationships,
    );
    const cousin = resolveKinship(
      "ego",
      "cousin",
      people,
      relationships,
    );

    expect(pibling.path?.steps).toEqual(["father", "brother"]);
    expect(pibling.status).toBe("known");
    expect(pibling.title).toBe("Bamnini");
    expect(cousin.path?.steps).toEqual([
      "father",
      "brother",
      "son",
    ]);
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
      { id: "ebba-tiri", type: "PARENT_OF", personAId: "ebba", personBId: "tiri" },
      { id: "ebba-tina", type: "PARENT_OF", personAId: "ebba", personBId: "tina" },
      { id: "ebba-johnson", type: "SPOUSE_OF", personAId: "ebba", personBId: "johnson" },
      {
        id: "johnson-father",
        type: "PARENT_OF",
        personAId: "johnson-father",
        personBId: "johnson",
      },
    ];

    const father = resolveKinship(
      "tiri",
      "johnson",
      people,
      relationships,
    );
    const child = resolveKinship(
      "johnson",
      "tiri",
      people,
      relationships,
    );
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
      { id: "father-child", type: "PARENT_OF", personAId: "father", personBId: "child" },
      { id: "marriage", type: "SPOUSE_OF", personAId: "father", personBId: "wife" },
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
      { id: "ebba-tiri", type: "PARENT_OF", personAId: "ebba", personBId: "tiri" },
      {
        id: "johnson-tiri",
        type: "PARENT_OF",
        personAId: "johnson",
        personBId: "tiri",
      },
      { id: "marriage", type: "SPOUSE_OF", personAId: "ebba", personBId: "johnson" },
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

    const father = resolveKinship(
      "child",
      "father",
      people,
      relationships,
    );
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

  it("keeps the current React application API operational", () => {
    const people: LegacyPerson[] = [
      { id: "ego", firstName: "Ego", surname: "M", sex: "male" },
      { id: "son", firstName: "Son", surname: "M", sex: "male" },
      { id: "wife", firstName: "Wife", surname: "M", sex: "female" },
    ];
    const relationships: Relationship[] = [
      { id: "parent", type: "PARENT_OF", personAId: "ego", personBId: "son" },
      { id: "marriage", type: "SPOUSE_OF", personAId: "son", personBId: "wife" },
    ];

    expect(resolveKinship("ego", "wife", people, relationships).title).toBe("Muroora");
  });

  it("preserves explicit sibling seniority for a classificatory parent's spouse", () => {
    const people: LegacyPerson[] = [
      { id: "ego", firstName: "Ego", surname: "M", sex: "male" },
      { id: "father", firstName: "Father", surname: "M", sex: "male" },
      { id: "uncle", firstName: "Uncle", surname: "M", sex: "male" },
      { id: "uncle-wife", firstName: "Wife", surname: "M", sex: "female" },
    ];
    const relationships: Relationship[] = [
      { id: "parent", type: "PARENT_OF", personAId: "father", personBId: "ego" },
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
