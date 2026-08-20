import { describe, expect, it } from "vitest";

import type { Person as LegacyPerson, Relationship } from "@/types/family";

import {
  FamilyTreeGraph,
  validateFamilyGraphInput,
} from "./family-tree-graph";
import { projectReciprocalClass } from "./kin-class-algebra";
import { KinshipResolver } from "./kinship-resolver";
import {
  KIN_CLASSES,
  terminalSiblingSeniority,
  type Context,
  type KinshipResolution,
  type Person,
  type TraversalResult,
} from "./model";
import { createKinshipSession } from "./resolve";

function person(
  id: string,
  sex: "M" | "F",
  family: Partial<Person> = {},
): Person {
  return { id, sex, spouseIds: [], ...family };
}

function resolve(people: Person[], egoId: string, targetId: string) {
  return new KinshipResolver(new FamilyTreeGraph(people)).resolve({
    egoId,
    targetId,
  });
}

describe("architecture review regressions", () => {
  it("reports malformed graph input before attempting resolution", () => {
    const people = [
      person("duplicate", "M"),
      person("duplicate", "F"),
      person("wrong-father", "F"),
      person("child", "M", {
        fatherId: "wrong-father",
        spouseIds: ["missing-spouse"],
      }),
      person("cycle-a", "M", { fatherId: "cycle-b" }),
      person("cycle-b", "M", { fatherId: "cycle-a" }),
    ];

    const report = validateFamilyGraphInput(
      people,
      [
        {
          personAId: "cycle-a",
          personBId: "cycle-b",
          personBRelativeAge: "older",
        },
        {
          personAId: "cycle-b",
          personBId: "cycle-a",
          personBRelativeAge: "older",
        },
      ],
    );
    const codes = new Set(report.issues.map((issue) => issue.code));

    expect(report.valid).toBe(false);
    expect(codes).toContain("DUPLICATE_PERSON_ID");
    expect(codes).toContain("DANGLING_SPOUSE");
    expect(codes).toContain("PARENT_SEX_MISMATCH");
    expect(codes).toContain("PARENT_CYCLE");
    expect(codes).toContain("CONTRADICTORY_SENIORITY");

    const result = new KinshipResolver(new FamilyTreeGraph(people)).resolve({
      egoId: "child",
      targetId: "wrong-father",
    });
    expect(result.status).toBe("invalid");
    expect(result.validationIssues?.length).toBeGreaterThan(0);
  });

  it("keeps ordinal birth order distinct from birth timestamps", () => {
    const ordinalGraph = new FamilyTreeGraph([
      person("first", "F", {
        birthOrder: 1,
        birthTimestamp: Date.parse("2010-01-01"),
      }),
      person("second", "F", {
        birthOrder: 2,
        birthTimestamp: Date.parse("2000-01-01"),
      }),
    ]);
    expect(ordinalGraph.relativeAge("second", "first")).toBe("older");

    const dateGraph = new FamilyTreeGraph([
      person("older", "M", { birthTimestamp: Date.parse("1990-01-01") }),
      person("younger", "M", {
        birthTimestamp: Date.parse("2000-01-01"),
      }),
    ]);
    expect(dateGraph.relativeAge("younger", "older")).toBe("older");
  });

  it("retains seniority for every sibling segment and selects the terminal one", () => {
    const graph = new FamilyTreeGraph(
      [
        person("a", "M"),
        person("b", "M"),
        person("c", "F"),
        person("d", "F"),
      ],
      [
        {
          personAId: "a",
          personBId: "b",
          personBRelativeAge: "older",
        },
        {
          personAId: "c",
          personBId: "d",
          personBRelativeAge: "younger",
        },
      ],
    );
    const siblingSeniorities = graph.describeSiblingSeniorities(
      ["a", "b", "c", "d"],
      ["B", "H", "Z"],
    );

    expect(siblingSeniorities.map((segment) => segment.relativeAge)).toEqual([
      "older",
      "younger",
    ]);
    const context: Context = {
      egoId: "a",
      targetId: "d",
      egoSex: "M",
      targetSex: "F",
      relativeAge: "unknown",
      siblingSeniorities,
      generationDistance: 0,
    };
    expect(terminalSiblingSeniority(context)).toBe("younger");
  });

  it("resolves M.B.D as sex-invariant Mainini with attested provenance", () => {
    const people = [
      person("maternal-grandfather", "M"),
      person("mother", "F", { fatherId: "maternal-grandfather" }),
      person("maternal-uncle", "M", {
        fatherId: "maternal-grandfather",
      }),
      person("male-ego", "M", { motherId: "mother" }),
      person("female-ego", "F", { motherId: "mother" }),
      person("maternal-uncles-daughter", "F", {
        fatherId: "maternal-uncle",
      }),
    ];

    for (const egoId of ["male-ego", "female-ego"]) {
      const result = resolve(people, egoId, "maternal-uncles-daughter");
      expect(result.title).toBe("Mainini");
      expect(result.kinClass).toBe("CLASSIFICATORY_MOTHER");
      expect(result.provenance).toMatchObject({
        confidence: "attested",
        sexCondition: "sex-invariant",
      });
      expect(result.provenance?.sources).toHaveLength(2);
    }
  });

  it("resolves either grandfather's sister as Tete for both Ego sexes", () => {
    const people = [
      person("paternal-great-grandfather", "M"),
      person("paternal-grandfather", "M", {
        fatherId: "paternal-great-grandfather",
      }),
      person("paternal-grandfathers-sister", "F", {
        fatherId: "paternal-great-grandfather",
      }),
      person("father", "M", { fatherId: "paternal-grandfather" }),
      person("maternal-great-grandfather", "M"),
      person("maternal-grandfather", "M", {
        fatherId: "maternal-great-grandfather",
      }),
      person("maternal-grandfathers-sister", "F", {
        fatherId: "maternal-great-grandfather",
      }),
      person("mother", "F", { fatherId: "maternal-grandfather" }),
      person("male-ego", "M", {
        fatherId: "father",
        motherId: "mother",
      }),
      person("female-ego", "F", {
        fatherId: "father",
        motherId: "mother",
      }),
    ];

    for (const egoId of ["male-ego", "female-ego"]) {
      for (const [targetId, expectedPath] of [
        ["paternal-grandfathers-sister", ["F", "F", "Z"]],
        ["maternal-grandfathers-sister", ["M", "F", "Z"]],
      ] as const) {
        const result = resolve(people, egoId, targetId);
        expect(result.title).toBe("Tete");
        expect(result.kinClass).toBe("PATERNAL_AUNT");
        expect(result.ruleId).toBe("GRANDFATHERS_SISTER");
        expect(result.traversal?.canonicalPath).toEqual(expectedPath);

        const reciprocal = resolve(people, targetId, egoId);
        expect(reciprocal.title).toBe("Muzukuru");
        expect(reciprocal.kinClass).toBe("MUZUKURU");
      }
    }
  });

  it("resolves either grandfather's brother as Sekuru for both Ego sexes", () => {
    const people = [
      person("paternal-great-grandfather", "M"),
      person("paternal-grandfather", "M", {
        fatherId: "paternal-great-grandfather",
      }),
      person("paternal-grandfathers-brother", "M", {
        fatherId: "paternal-great-grandfather",
      }),
      person("father", "M", { fatherId: "paternal-grandfather" }),
      person("maternal-great-grandfather", "M"),
      person("maternal-grandfather", "M", {
        fatherId: "maternal-great-grandfather",
      }),
      person("maternal-grandfathers-brother", "M", {
        fatherId: "maternal-great-grandfather",
      }),
      person("mother", "F", { fatherId: "maternal-grandfather" }),
      person("male-ego", "M", {
        fatherId: "father",
        motherId: "mother",
      }),
      person("female-ego", "F", {
        fatherId: "father",
        motherId: "mother",
      }),
    ];

    for (const egoId of ["male-ego", "female-ego"]) {
      for (const [targetId, expectedPath] of [
        ["paternal-grandfathers-brother", ["F", "F", "B"]],
        ["maternal-grandfathers-brother", ["M", "F", "B"]],
      ] as const) {
        const result = resolve(people, egoId, targetId);
        expect(result.title).toBe("Sekuru");
        expect(result.traversal?.canonicalPath).toEqual(expectedPath);

        const reciprocal = resolve(people, targetId, egoId);
        expect(reciprocal.title).toBe("Muzukuru");
      }
    }
  });

  it("resolves a female ego's husband's mother's brother's daughter's daughter as Tete", () => {
    const people = [
      person("husbands-maternal-grandfather", "M"),
      person("husbands-mother", "F", {
        fatherId: "husbands-maternal-grandfather",
      }),
      person("husbands-maternal-uncle", "M", {
        fatherId: "husbands-maternal-grandfather",
      }),
      person("husband", "M", {
        motherId: "husbands-mother",
        spouseIds: ["female-ego"],
      }),
      person("female-ego", "F", { spouseIds: ["husband"] }),
      person("husbands-maternal-uncles-daughter", "F", {
        fatherId: "husbands-maternal-uncle",
      }),
      person("target", "F", {
        motherId: "husbands-maternal-uncles-daughter",
      }),
    ];

    const husbandPerspective = resolve(people, "husband", "target");
    expect(husbandPerspective.traversal?.canonicalPath).toEqual([
      "M",
      "B",
      "D",
      "D",
    ]);
    expect(husbandPerspective.title).toBe("Hanzvadzi");
    expect(husbandPerspective.kinClass).toBe("CROSS_SEX_SIBLING");
    expect(husbandPerspective.derivation).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "M_MATRILATERAL_UNCLE_DAUGHTER_ELEVATION",
        ),
        expect.stringContaining("P_CLASSIFICATORY_PARENT_CHILD"),
      ]),
    );

    const terminalMotherClass = resolve(
      people,
      "female-ego",
      "husbands-maternal-uncles-daughter",
    );
    expect(terminalMotherClass.traversal?.canonicalPath).toEqual([
      "H",
      "M",
      "B",
      "D",
    ]);
    expect(terminalMotherClass.title).toBe("Vamwene");
    expect(terminalMotherClass.kinClass).toBe("MOTHER_IN_LAW");
    expect(terminalMotherClass.derivation).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "AFFINAL_LEADING_SPOUSE_SEMANTIC_PROJECTION",
        ),
      ]),
    );

    const result = resolve(people, "female-ego", "target");
    expect(result.traversal?.canonicalPath).toEqual([
      "H",
      "M",
      "B",
      "D",
      "D",
    ]);
    expect(result.title).toBe("Tete");
    expect(result.ruleId).toBe("AFFINAL_HUSBANDS_SISTER");
    expect(result.derivation).toEqual(
      expect.arrayContaining([
        expect.stringContaining("AFFINAL_HUSBANDS_SISTER"),
      ]),
    );
  });

  it("applies Sekuru haaperi generatively beyond five male descendants", () => {
    const people = [
      person("maternal-grandfather", "M"),
      person("mother", "F", { fatherId: "maternal-grandfather" }),
      person("maternal-uncle", "M", {
        fatherId: "maternal-grandfather",
      }),
      person("ego", "F", { motherId: "mother" }),
    ];
    let parentId = "maternal-uncle";
    for (let depth = 1; depth <= 7; depth += 1) {
      const id = `male-descendant-${depth}`;
      people.push(person(id, "M", { fatherId: parentId }));
      parentId = id;
    }

    const result = resolve(people, "ego", parentId);
    expect(result.title).toBe("Sekuru");
    expect(result.ruleId).toBe("SEKURU_HAAPERI");
    expect(result.traversal?.canonicalPath).toEqual([
      "M",
      "B",
      "S",
      "S",
      "S",
      "S",
      "S",
      "S",
      "S",
    ]);
  });

  it("keeps the recursive rule set stable as lineage depth increases", () => {
    const firedRules = new Set<string>();

    for (let requestedDepth = 0; requestedDepth <= 8; requestedDepth += 1) {
      const people = [
        person("maternal-grandfather", "M"),
        person("mother", "F", { fatherId: "maternal-grandfather" }),
        person("maternal-uncle", "M", {
          fatherId: "maternal-grandfather",
        }),
        person("ego", "M", { motherId: "mother" }),
      ];
      let targetId = "maternal-uncle";
      for (let depth = 1; depth <= requestedDepth; depth += 1) {
        const id = `descendant-${depth}`;
        people.push(person(id, "M", { fatherId: targetId }));
        targetId = id;
      }
      const result = resolve(people, "ego", targetId);
      expect(result.title).toBe("Sekuru");
      if (result.ruleId) firedRules.add(result.ruleId);
    }

    expect(firedRules).toEqual(new Set(["SEKURU_HAAPERI"]));
  });

  it("defines a runtime reciprocal projection for every KinClass", () => {
    const traversal: TraversalResult = {
      personIds: ["ego", "target"],
      rawPath: ["B"],
      canonicalPath: ["B"],
      generationDistance: 0,
      siblingSeniorities: [],
    };

    for (const kinClass of KIN_CLASSES) {
      for (const targetSex of ["M", "F"] as const) {
        const reverse: KinshipResolution = {
          status: "known",
          title: kinClass,
          description: "Invariant fixture",
          kinClass,
        };
        const reciprocal = projectReciprocalClass(reverse, traversal, {
          egoId: "ego",
          targetId: "target",
          egoSex: targetSex === "M" ? "F" : "M",
          targetSex,
          relativeAge: "unknown",
          siblingSeniorities: [],
          generationDistance: 0,
        });

        expect(reciprocal, `${kinClass} (${targetSex})`).toBeDefined();
        expect(KIN_CLASSES).toContain(reciprocal?.kinClass);
      }
    }
  });

  it("keeps parent and one-sided spouse graph edges reciprocal", () => {
    const graph = new FamilyTreeGraph([
      person("father", "M", { spouseIds: ["mother"] }),
      person("mother", "F"),
      person("child", "F", { fatherId: "father" }),
    ]);

    expect(graph.findShortestPath("father", "child")?.rawPath).toEqual([
      "D",
    ]);
    expect(graph.findShortestPath("child", "father")?.rawPath).toEqual([
      "F",
    ]);
    expect(graph.findShortestPath("father", "mother")?.rawPath).toEqual([
      "W",
    ]);
    expect(graph.findShortestPath("mother", "father")?.rawPath).toEqual([
      "H",
    ]);
  });

  it("is deterministic when person input order changes", () => {
    const people = [
      person("grandfather", "M"),
      person("father", "M", { fatherId: "grandfather", birthOrder: 1 }),
      person("uncle", "M", { fatherId: "grandfather", birthOrder: 2 }),
      person("ego", "M", { fatherId: "father" }),
      person("uncles-wife", "F", { spouseIds: ["uncle"] }),
    ];
    people.find((member) => member.id === "uncle")?.spouseIds.push(
      "uncles-wife",
    );

    const forward = resolve(people, "ego", "uncles-wife");
    const reordered = resolve([...people].reverse(), "ego", "uncles-wife");
    expect({
      status: reordered.status,
      title: reordered.title,
      kinClass: reordered.kinClass,
      ruleId: reordered.ruleId,
    }).toEqual({
      status: forward.status,
      title: forward.title,
      kinClass: forward.kinClass,
      ruleId: forward.ruleId,
    });
  });

  it("preserves malformed legacy spouse references for session validation", () => {
    const people: LegacyPerson[] = [
      { id: "ego", firstName: "Ego", surname: "M", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "dangling-marriage",
        type: "SPOUSE_OF",
        personAId: "ego",
        personBId: "missing",
      },
    ];

    const session = createKinshipSession(people, relationships);
    expect(session.validation.valid).toBe(false);
    expect(session.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DANGLING_SPOUSE" }),
      ]),
    );
  });
});
