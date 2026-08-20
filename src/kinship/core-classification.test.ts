import { describe, expect, it } from "vitest";

import { FamilyTreeGraph } from "./family-tree-graph";
import { projectReciprocalClass } from "./kin-class-algebra";
import { KinshipResolver } from "./kinship-resolver";
import {
  CORE_KIN_CLASSES,
  CORE_KIN_RECIPROCALS,
  type Context,
  type CoreKinClass,
  type KinshipResolution,
  type Person,
  type TraversalResult,
} from "./model";

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

function expectCore(
  resolver: KinshipResolver,
  egoId: string,
  targetId: string,
  title: string,
  ...coreClassifications: CoreKinClass[]
) {
  const result = resolver.resolve({ egoId, targetId });
  expect(result.title).toBe(title);
  expect(result.coreClassifications).toEqual(coreClassifications);
}

describe("primary Shona kinship hierarchy", () => {
  it("defines the ten classes in their requested hierarchical order", () => {
    expect(CORE_KIN_CLASSES).toEqual([
      "PATRILINEAL_GRANDPARENT",
      "PATRILINEAL_FATHER",
      "PATRILINEAL_SIBLING",
      "PATRILINEAL_CHILD",
      "PATRILINEAL_GRANDCHILD",
      "MATRILINEAL_GRANDPARENT",
      "MATRILINEAL_MOTHER",
      "MATRILINEAL_SIBLING",
      "MATRILINEAL_CHILD",
      "MATRILINEAL_GRANDCHILD",
    ]);
  });

  it("makes every ordinary hierarchy reciprocal", () => {
    for (const classification of CORE_KIN_CLASSES) {
      const reciprocal = CORE_KIN_RECIPROCALS[classification];
      expect(CORE_KIN_RECIPROCALS[reciprocal]).toBe(classification);
    }

    expect(CORE_KIN_RECIPROCALS).toMatchObject({
      PATRILINEAL_GRANDPARENT: "PATRILINEAL_GRANDCHILD",
      PATRILINEAL_FATHER: "PATRILINEAL_CHILD",
      PATRILINEAL_SIBLING: "PATRILINEAL_SIBLING",
      MATRILINEAL_GRANDPARENT: "MATRILINEAL_GRANDCHILD",
      MATRILINEAL_MOTHER: "MATRILINEAL_CHILD",
      MATRILINEAL_SIBLING: "MATRILINEAL_SIBLING",
    });
  });

  it("uses the hierarchy during reciprocal class projection", () => {
    const traversal: TraversalResult = {
      personIds: ["ego", "target"],
      rawPath: ["M"],
      canonicalPath: ["M"],
      generationDistance: 1,
      siblingSeniorities: [],
    };
    const context: Context = {
      egoId: "ego",
      targetId: "target",
      egoSex: "M",
      targetSex: "F",
      relativeAge: "unknown",
      siblingSeniorities: [],
      generationDistance: 1,
    };
    const reciprocal = (
      reverse: KinshipResolution,
      targetSex: "M" | "F" = "F",
    ) =>
      projectReciprocalClass(reverse, traversal, {
        ...context,
        targetSex,
      });

    expect(
      reciprocal({
        status: "known",
        title: "Mai",
        description: "Mother-class fixture",
        kinClass: "CLASSIFICATORY_MOTHER",
        coreClassifications: ["MATRILINEAL_MOTHER"],
      })?.coreClassifications,
    ).toEqual(["MATRILINEAL_CHILD"]);

    expect(
      reciprocal({
        status: "known",
        title: "Muzukuru",
        description: "Grandchild-class fixture",
        kinClass: "MUZUKURU",
        coreClassifications: ["MATRILINEAL_GRANDCHILD"],
      })?.coreClassifications,
    ).toEqual(["MATRILINEAL_GRANDPARENT"]);

    expect(
      reciprocal({
        status: "known",
        title: "Hanzvadzi",
        description: "Sibling-class fixture",
        kinClass: "CROSS_SEX_SIBLING",
        coreClassifications: ["PATRILINEAL_SIBLING"],
      })?.coreClassifications,
    ).toEqual(["PATRILINEAL_SIBLING"]);

    // Tete is deliberately not the ordinary Father -> Child reciprocal.
    expect(
      reciprocal({
        status: "known",
        title: "Tete",
        description: "Tete fixture",
        kinClass: "PATERNAL_AUNT",
        coreClassifications: ["PATRILINEAL_FATHER"],
      })?.coreClassifications,
    ).toEqual(["PATRILINEAL_GRANDCHILD"]);
  });

  it("classifies the patrilineal hierarchy and its ordinary reciprocals", () => {
    const resolver = resolverFor([
      person("paternal-grandfather", "M"),
      person("father", "M", { fatherId: "paternal-grandfather" }),
      person("tete", "F", { fatherId: "paternal-grandfather" }),
      person("ego", "M", { fatherId: "father", birthOrder: 1 }),
      person("brother", "M", { fatherId: "father", birthOrder: 2 }),
      person("son", "M", { fatherId: "ego" }),
      person("grandson", "M", { fatherId: "son" }),
      person("tetes-daughter", "F", { motherId: "tete" }),
    ]);

    expectCore(
      resolver,
      "ego",
      "paternal-grandfather",
      "Sekuru",
      "PATRILINEAL_GRANDPARENT",
    );
    expectCore(
      resolver,
      "paternal-grandfather",
      "ego",
      "Muzukuru",
      "PATRILINEAL_GRANDCHILD",
    );
    expectCore(
      resolver,
      "ego",
      "father",
      "Baba",
      "PATRILINEAL_FATHER",
    );
    expectCore(
      resolver,
      "father",
      "ego",
      "Mwana",
      "PATRILINEAL_CHILD",
    );
    expectCore(
      resolver,
      "ego",
      "brother",
      "Munin'ina",
      "PATRILINEAL_SIBLING",
    );
    expectCore(
      resolver,
      "brother",
      "ego",
      "Mukoma",
      "PATRILINEAL_SIBLING",
    );
    expectCore(
      resolver,
      "ego",
      "son",
      "Mwana",
      "PATRILINEAL_CHILD",
    );
    expectCore(
      resolver,
      "son",
      "ego",
      "Baba",
      "PATRILINEAL_FATHER",
    );
    expectCore(
      resolver,
      "ego",
      "grandson",
      "Muzukuru",
      "PATRILINEAL_GRANDCHILD",
    );
    expectCore(
      resolver,
      "grandson",
      "ego",
      "Sekuru",
      "PATRILINEAL_GRANDPARENT",
    );
  });

  it("classifies Tete in the Father class but applies her Grandchild exception", () => {
    const resolver = resolverFor([
      person("paternal-grandfather", "M"),
      person("father", "M", { fatherId: "paternal-grandfather" }),
      person("tete", "F", { fatherId: "paternal-grandfather" }),
      person("ego", "F", { fatherId: "father" }),
      person("tetes-son", "M", { motherId: "tete" }),
      person("tetes-daughter", "F", { motherId: "tete" }),
    ]);

    expectCore(
      resolver,
      "ego",
      "tete",
      "Tete",
      "PATRILINEAL_FATHER",
    );
    expectCore(
      resolver,
      "tete",
      "ego",
      "Muzukuru",
      "PATRILINEAL_GRANDCHILD",
    );
    for (const targetId of ["tetes-son", "tetes-daughter"]) {
      expectCore(
        resolver,
        "ego",
        targetId,
        "Muzukuru",
        "PATRILINEAL_GRANDCHILD",
      );
    }
  });

  it("classifies the matrilineal hierarchy and its promoted roles", () => {
    const resolver = resolverFor([
      person("maternal-grandfather", "M"),
      person("mother", "F", { fatherId: "maternal-grandfather" }),
      person("maternal-uncle", "M", {
        fatherId: "maternal-grandfather",
      }),
      person("ego", "F", { motherId: "mother", birthOrder: 1 }),
      person("sister", "F", { motherId: "mother", birthOrder: 2 }),
      person("daughter", "F", { motherId: "ego" }),
      person("granddaughter", "F", { motherId: "daughter" }),
      person("uncles-son", "M", { fatherId: "maternal-uncle" }),
      person("uncles-daughter", "F", { fatherId: "maternal-uncle" }),
    ]);

    expectCore(
      resolver,
      "ego",
      "maternal-grandfather",
      "Sekuru",
      "MATRILINEAL_GRANDPARENT",
    );
    expectCore(
      resolver,
      "maternal-grandfather",
      "ego",
      "Muzukuru",
      "MATRILINEAL_GRANDCHILD",
    );
    expectCore(
      resolver,
      "ego",
      "mother",
      "Mai",
      "MATRILINEAL_MOTHER",
    );
    expectCore(
      resolver,
      "mother",
      "ego",
      "Mwana",
      "MATRILINEAL_CHILD",
    );
    expectCore(
      resolver,
      "ego",
      "sister",
      "Munin'ina",
      "MATRILINEAL_SIBLING",
    );
    expectCore(
      resolver,
      "ego",
      "daughter",
      "Mwana",
      "MATRILINEAL_CHILD",
    );
    expectCore(
      resolver,
      "daughter",
      "ego",
      "Mai",
      "MATRILINEAL_MOTHER",
    );
    expectCore(
      resolver,
      "ego",
      "granddaughter",
      "Muzukuru",
      "MATRILINEAL_GRANDCHILD",
    );
    expectCore(
      resolver,
      "granddaughter",
      "ego",
      "Mbuya",
      "MATRILINEAL_GRANDPARENT",
    );
    expectCore(
      resolver,
      "ego",
      "maternal-uncle",
      "Sekuru",
      "MATRILINEAL_GRANDPARENT",
    );
    expectCore(
      resolver,
      "maternal-uncle",
      "ego",
      "Muzukuru",
      "MATRILINEAL_GRANDCHILD",
    );
    expectCore(
      resolver,
      "ego",
      "uncles-son",
      "Sekuru",
      "MATRILINEAL_GRANDPARENT",
    );
    expectCore(
      resolver,
      "ego",
      "uncles-daughter",
      "Mainini",
      "MATRILINEAL_MOTHER",
    );
  });
});
