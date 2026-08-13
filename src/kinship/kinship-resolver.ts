import { FamilyTreeGraph } from "./family-tree-graph";
import type {
  Context,
  KinQuery,
  KinRule,
  KinshipResolution,
  KStep,
  RelativeAge,
  TraversalResult,
} from "./model";
import { formatKPath } from "./model";
import { PathReducer } from "./path-reducer";

function exact(expected: readonly KStep[]) {
  return (path: readonly KStep[]) =>
    path.length === expected.length &&
    path.every((step, index) => step === expected[index]);
}

function known(ruleId: string, title: string, description: string) {
  return { status: "known" as const, ruleId, title, description };
}

function ambiguous(
  ruleId: string,
  title: string,
  description: string,
  possibilities: string[],
) {
  return {
    status: "ambiguous" as const,
    ruleId,
    title,
    description,
    possibilities,
  };
}

const rules: KinRule[] = [
  {
    id: "SELF",
    axis: "contextual",
    priority: 1000,
    matches: exact([]),
    resolve: () => known("SELF", "You", "This is the selected person."),
    explanation: "Ego and target are the same person.",
  },
  {
    id: "MATRILATERAL_UNCLE_DAUGHTER",
    axis: "M",
    priority: 990,
    matches: exact(["M", "B", "D"]),
    resolve: () =>
      known(
        "MATRILATERAL_UNCLE_DAUGHTER",
        "Mainini",
        "Your maternal uncle's daughter, structurally a junior mother.",
      ),
    explanation: "M.B.D is structurally elevated to the junior-mother class.",
  },
  {
    id: "SEKURU_HAAPERI",
    axis: "M",
    priority: 980,
    matches: (path) =>
      path.length >= 2 &&
      path[0] === "M" &&
      path[1] === "B" &&
      path.slice(2).every((step) => step === "S"),
    resolve: () =>
      known(
        "SEKURU_HAAPERI",
        "Sekuru",
        "Your maternal-uncle lineage; Sekuru continues recursively down its male line.",
      ),
    explanation: "Sekuru haaperi: M.B.S* remains Sekuru.",
  },
  {
    id: "PATERNAL_AUNT_CROSS_COUSIN",
    axis: "M",
    priority: 970,
    matches: (path) =>
      path.length === 3 &&
      path[0] === "F" &&
      path[1] === "Z" &&
      (path[2] === "S" || path[2] === "D"),
    resolve: (_path, context) =>
      context.egoSex === "F"
        ? known(
            "PATERNAL_AUNT_CHILD_FEMALE_EGO",
            "Mwana",
            "Your paternal aunt's child, viewed by a female ego.",
          )
        : known(
            "PATERNAL_AUNT_CHILD_MALE_EGO",
            "Muzukuru",
            "Your paternal aunt's child, viewed by a male ego.",
          ),
    explanation:
      "F.Z.S and F.Z.D are Mwana for a female ego and Muzukuru for a male ego.",
  },
  {
    id: "CLASSIFICATORY_PARENT_SPOUSE",
    axis: "P",
    priority: 975,
    matches: (path) =>
      exact(["F", "B", "W"])(path) || exact(["M", "Z", "H"])(path),
    resolve: (path, context) => {
      const paternal = path[0] === "F";
      if (context.structuralRelativeAge === "older") {
        return paternal
          ? known(
              "BAMKURU_WIFE",
              "Maiguru",
              "The wife of your father's older brother.",
            )
          : known(
              "MAIGURU_HUSBAND",
              "Bamkuru",
              "The husband of your mother's older sister.",
            );
      }
      if (context.structuralRelativeAge === "younger") {
        return paternal
          ? known(
              "BAMNINI_WIFE",
              "Mainini",
              "The wife of your father's younger brother.",
            )
          : known(
              "MAININI_HUSBAND",
              "Bamnini",
              "The husband of your mother's younger sister.",
            );
      }
      return ambiguous(
        "CLASSIFICATORY_PARENT_SPOUSE_AGE_REQUIRED",
        paternal ? "Maiguru / Mainini" : "Bamkuru / Bamnini",
        "The classificatory parent's seniority is required.",
        paternal ? ["Maiguru", "Mainini"] : ["Bamkuru", "Bamnini"],
      );
    },
    explanation:
      "A classificatory parent's spouse preserves that parent's seniority class.",
  },
  {
    id: "WIFES_BROTHER",
    axis: "A",
    priority: 960,
    matches: (path, context) =>
      context.egoSex === "M" && exact(["W", "B"])(path),
    resolve: () =>
      ambiguous(
        "WIFES_BROTHER",
        "Tsano / Tezvara",
        "Your wife's brother; usage context determines the preferred title.",
        ["Tsano", "Tezvara"],
      ),
    explanation: "The male wife-giver axis permits Tsano or Tezvara for W.B.",
  },
  {
    id: "HUSBANDS_BROTHER",
    axis: "A",
    priority: 960,
    matches: (path, context) =>
      context.egoSex === "F" && exact(["H", "B"])(path),
    resolve: (_path, context) => {
      // Husband's brother relative age operates correctly off Ego vs Target logic
      // (or more precisely, husband vs target, which usually aligns with standard relativeAge).
      if (context.structuralRelativeAge === "older") {
        return known(
          "HUSBANDS_OLDER_BROTHER",
          "Babamukuru",
          "Your husband's older brother.",
        );
      }
      if (context.structuralRelativeAge === "younger") {
        return known(
          "HUSBANDS_YOUNGER_BROTHER",
          "Muramu",
          "Your husband's younger brother.",
        );
      }
      return ambiguous(
        "HUSBANDS_BROTHER_AGE_REQUIRED",
        "Babamukuru / Muramu",
        "His seniority relative to your husband is required.",
        ["Babamukuru", "Muramu"],
      );
    },
    explanation:
      "H.B is distinguished by whether the brother is older or younger.",
  },
  ...(
    [
      ["W.F", ["W", "F"], "Tezvara", "Your wife's father."],
      ["W.M", ["W", "M"], "Mbuywasha", "Your wife's mother."],
      ["W.Z", ["W", "Z"], "Muramu", "Your wife's sister."],
      ["H.F", ["H", "F"], "Tezvara", "Your husband's father."],
      ["H.M", ["H", "M"], "Vamwene", "Your husband's mother."],
      ["H.Z", ["H", "Z"], "Vamwene", "Your husband's sister."],
    ] as const
  ).map(
    ([id, path, title, description]): KinRule => ({
      id: `AFFINAL_${id.replace(".", "_")}`,
      axis: "A",
      priority: 950,
      matches: exact(path),
      resolve: () =>
        known(`AFFINAL_${id.replace(".", "_")}`, title, description),
      explanation: `${id} resolves on the direct affinal axis.`,
    }),
  ),
  {
    id: "CO_PARENT_IN_LAW",
    axis: "A",
    priority: 945,
    matches: (path) =>
      path.length === 3 &&
      ((path[0] === "D" && path[1] === "H") ||
        (path[0] === "S" && path[1] === "W")) &&
      (path[2] === "F" || path[2] === "M"),
    resolve: (path) =>
      known(
        path[0] === "D" ? "SON_IN_LAW_PARENT" : "DAUGHTER_IN_LAW_PARENT",
        "Mukurungai",
        "A parent of your child's spouse; your co-parent-in-law.",
      ),
    explanation:
      "Either parent across a child's marriage boundary is Mukurungai.",
  },
  {
    id: "CHILD_IN_LAW_SIDE",
    axis: "A",
    priority: 935,
    matches: (path) => {
      if (path.length < 3) return false;
      const sonInLawSide = path[0] === "D" && path[1] === "H";
      const daughterInLawSide = path[0] === "S" && path[1] === "W";
      return (
        (sonInLawSide || daughterInLawSide) &&
        path
          .slice(2)
          .every((step) => ["F", "M", "S", "D", "B", "Z"].includes(step))
      );
    },
    resolve: (path) =>
      path[0] === "D"
        ? known(
            "SON_IN_LAW_SIDE_RELATIVE",
            "Hama yeVakuwasha",
            "A blood relative on your son-in-law's side.",
          )
        : known(
            "DAUGHTER_IN_LAW_SIDE_RELATIVE",
            "Hama dzeMuroora",
            "A blood relative on your daughter-in-law's side.",
          ),
    explanation:
      "A blood suffix beyond a child's spouse remains on that spouse's affinal side.",
  },
  {
    id: "WOMAN_MARRYING_IN",
    axis: "A",
    priority: 940,
    matches: (path) => {
      if (path.at(-1) !== "W") return false;
      const stem = path.slice(0, -1);
      return (
        exact(["S"])(stem) || exact(["B"])(stem) || exact(["F", "B", "S"])(stem)
      );
    },
    resolve: () =>
      known(
        "WOMAN_MARRYING_IN",
        "Muroora",
        "A woman marrying into ego's clan line.",
      ),
    explanation: "(S|B|F.B.S).W aligns inward as Muroora.",
  },
  {
    id: "MAN_MARRYING_OUT",
    axis: "A",
    priority: 940,
    matches: (path) => {
      if (path.at(-1) !== "H") return false;
      const stem = path.slice(0, -1);
      return (
        exact(["D"])(stem) || exact(["Z"])(stem) || exact(["F", "Z"])(stem)
      );
    },
    resolve: () =>
      known(
        "MAN_MARRYING_OUT",
        "Mukuwasha",
        "A man marrying a daughter of ego's clan line.",
      ),
    explanation: "(D|Z|F.Z).H aligns outward as Mukuwasha.",
  },
  {
    id: "OPPOSITE_SEX_SIBLING_CHILD",
    axis: "P",
    priority: 910,
    matches: (path, context) => {
      if (path.length !== 2) return false;
      const oppositeSexSibling =
        (context.egoSex === "M" && path[0] === "Z") ||
        (context.egoSex === "F" && path[0] === "B");
      return oppositeSexSibling && (path[1] === "S" || path[1] === "D");
    },
    resolve: () =>
      known(
        "OPPOSITE_SEX_SIBLING_CHILD",
        "Muzukuru",
        "The child of your opposite-sex sibling.",
      ),
    explanation:
      "An opposite-sex sibling's child belongs to ego's Muzukuru category.",
  },
  {
    id: "DIRECT_SIBLING",
    axis: "P",
    priority: 900,
    matches: (path) => exact(["B"])(path) || exact(["Z"])(path),
    resolve: (_path, context) => {
      if (context.egoSex !== context.targetSex) {
        return known(
          "CROSS_SEX_SIBLING",
          "Hanzvadzi",
          "Your cross-sex sibling-equivalent.",
        );
      }
      if (context.relativeAge === "older") {
        return known(
          "OLDER_SAME_SEX_SIBLING",
          "Mukoma",
          "Your older same-sex sibling-equivalent.",
        );
      }
      if (context.relativeAge === "younger") {
        return known(
          "YOUNGER_SAME_SEX_SIBLING",
          "Munin'ina",
          "Your younger same-sex sibling-equivalent.",
        );
      }
      return ambiguous(
        "SAME_SEX_SIBLING_AGE_REQUIRED",
        "Mukoma / Munin'ina",
        "Relative age is required for a same-sex sibling-equivalent.",
        ["Mukoma", "Munin'ina"],
      );
    },
    explanation:
      "Sibling terminology uses sex correspondence and relative age.",
  },
  {
    id: "GRANDPARENT",
    axis: "contextual",
    priority: 850,
    matches: (path, context) =>
      context.generationDistance === 2 &&
      path.length === 2 &&
      path.every((step) => step === "F" || step === "M"),
    resolve: (_path, context) =>
      context.targetSex === "M"
        ? known("GRANDFATHER", "Sekuru", "Your grandfather.")
        : known("GRANDMOTHER", "Ambuya", "Your grandmother."),
    explanation: "Two upward generations form a grandparent category.",
  },
  {
    id: "GRANDCHILD",
    axis: "contextual",
    priority: 850,
    matches: (path, context) =>
      context.generationDistance === -2 &&
      path.length === 2 &&
      path.every((step) => step === "S" || step === "D"),
    resolve: () => known("GRANDCHILD", "Muzukuru", "Your grandchild."),
    explanation: "Two downward generations form a grandchild category.",
  },
  {
    id: "GREAT_GRANDCHILD",
    axis: "contextual",
    priority: 850,
    matches: (path, context) =>
      context.generationDistance === -3 &&
      path.length === 3 &&
      path.every((step) => step === "S" || step === "D"),
    resolve: () =>
      known("GREAT_GRANDCHILD", "Chizukuruchibvi", "Your great-grandchild."),
    explanation:
      "Three downward generations form the great-grandchild category.",
  },
  {
    id: "DISTANT_MALE_ANCESTOR",
    axis: "P",
    priority: 840,
    matches: (path, context) =>
      context.targetSex === "M" &&
      context.generationDistance >= 3 &&
      path.length >= 3 &&
      path.every((step) => step === "F" || step === "M"),
    resolve: () =>
      known("DISTANT_MALE_ANCESTOR", "Tateguru", "Your distant male ancestor."),
    explanation:
      "A male ancestor at least three generations above ego is Tateguru.",
  },
  ...(
    [
      ["F", "Baba", "Your father."],
      ["M", "Mai", "Your mother."],
      ["S", "Mwana", "Your son."],
      ["D", "Mwana", "Your daughter."],
      ["H", "Murume", "Your husband."],
      ["W", "Mukadzi", "Your wife."],
      [
        "F.B",
        "Bamkuru / Bamnini",
        "Your father's brother; seniority determines the exact title.",
      ],
      ["F.Z", "Tete", "Your father's sister."],
      [
        "M.Z",
        "Maiguru / Mainini",
        "Your mother's sister; seniority determines the exact title.",
      ],
    ] as const
  ).map(([encoded, title, description]): KinRule => {
    const path = encoded.split(".") as KStep[];
    return {
      id: `BASIC_${encoded.replace(".", "_")}`,
      axis: "contextual",
      priority: 800,
      matches: exact(path),
      resolve: (_path, context) => {
        if (encoded === "F.B") {
          if (context.structuralRelativeAge === "older")
            return known("PATERNAL_UNCLE_OLDER", "Bamkuru", description);
          if (context.structuralRelativeAge === "younger")
            return known("PATERNAL_UNCLE_YOUNGER", "Bamnini", description);
          return ambiguous("PATERNAL_UNCLE_AGE_REQUIRED", title, description, [
            "Bamkuru",
            "Bamnini",
          ]);
        }
        if (encoded === "M.Z") {
          if (context.structuralRelativeAge === "older")
            return known("MATERNAL_AUNT_OLDER", "Maiguru", description);
          if (context.structuralRelativeAge === "younger")
            return known("MATERNAL_AUNT_YOUNGER", "Mainini", description);
          return ambiguous("MATERNAL_AUNT_AGE_REQUIRED", title, description, [
            "Maiguru",
            "Mainini",
          ]);
        }
        return known(`BASIC_${encoded.replace(".", "_")}`, title, description);
      },
      explanation: `${encoded} is a fundamental kin category.`,
    };
  }),
];

export class KinshipResolver {
  private readonly reducer: PathReducer;

  constructor(
    private readonly graph: FamilyTreeGraph,
    reducer = new PathReducer(),
  ) {
    this.reducer = reducer;
  }

  resolve(query: KinQuery): KinshipResolution {
    const ego = this.graph.getPerson(query.egoId);
    const target = this.graph.getPerson(query.targetId);
    if (!ego || !target) {
      return {
        status: "unrelated",
        title: "Mutorwa / Relationship Unmapped",
        description: "The ego or target does not exist in this family graph.",
      };
    }

    // Prepare the base context elements that apply globally to this query
    const baseContext = {
      egoId: query.egoId,
      targetId: query.targetId,
      egoSex: query.egoSex ?? ego.sex,
      targetSex: query.targetSex ?? target.sex,
      relativeAge:
        query.relativeAge ??
        this.relativeAge(ego.birthOrder, target.birthOrder),
    };

    const paths = this.graph.findShortestPaths(query.egoId, query.targetId);
    if (paths.length === 0) {
      return {
        status: "unrelated",
        title: "Mutorwa / Relationship Unmapped",
        description: "No genealogical path connects ego and target.",
      };
    }

    const candidates = paths.map((traversal) => {
      const context: Context = {
        ...baseContext,
        generationDistance: traversal.generationDistance,
        structuralRelativeAge: this.getStructuralRelativeAge(traversal),
      };
      return this.resolveTraversal(traversal, context);
    });

    candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const bestPriority = candidates[0].priority ?? 0;
    const best = candidates.filter(
      (candidate) => (candidate.priority ?? 0) === bestPriority,
    );
    const titles = [...new Set(best.map((candidate) => candidate.title))];

    if (titles.length > 1) {
      return {
        status: "ambiguous",
        title: "Multiple valid relationships",
        description:
          "Equally short paths resolve to different Shona categories.",
        possibilities: titles,
        traversal: best[0].traversal,
      };
    }

    const resolution: KinshipResolution & { priority?: number } = {
      ...best[0],
    };
    delete resolution.priority;
    return resolution;
  }

  private resolveTraversal(traversal: TraversalResult, context: Context) {
    const canonicalRule = this.bestRule(traversal.canonicalPath, context, 970);
    const reduction = this.reducer.reduce(traversal.canonicalPath, context);
    const rule = canonicalRule ?? this.bestRule(reduction.reducedPath, context);

    if (!rule?.resolve) {
      return {
        priority: 0,
        status: "unmapped" as const,
        title: "Mutorwa / Relationship Unmapped",
        description: `No Shona algebraic rule matched ${formatKPath(reduction.reducedPath) || "SELF"}.`,
        traversal,
        reducedPath: reduction.reducedPath,
        derivation: reduction.derivation,
      };
    }

    return {
      priority: rule.priority,
      ...rule.resolve(
        canonicalRule ? traversal.canonicalPath : reduction.reducedPath,
        context,
      ),
      traversal,
      reducedPath: reduction.reducedPath,
      derivation: [...reduction.derivation, `${rule.id}: ${rule.explanation}`],
    };
  }

  private bestRule(
    path: readonly KStep[],
    context: Context,
    minimumPriority = 0,
  ) {
    return rules
      .filter(
        (rule) =>
          rule.priority >= minimumPriority && rule.matches(path, context),
      )
      .sort((a, b) => b.priority - a.priority)[0];
  }

  private relativeAge(egoOrder?: number, targetOrder?: number): RelativeAge {
    if (egoOrder === undefined || targetOrder === undefined) return "unknown";
    if (targetOrder < egoOrder) return "older";
    if (targetOrder > egoOrder) return "younger";
    return "same";
  }

  /** Find the first sibling comparison represented by the raw traversal. */
  private getStructuralRelativeAge(traversal: TraversalResult): RelativeAge {
    for (let index = 0; index < traversal.rawPath.length; index += 1) {
      const step = traversal.rawPath[index];

      if (step === "B" || step === "Z") {
        const referenceId = traversal.personIds[index];
        const targetId = traversal.personIds[index + 1];
        if (referenceId && targetId) {
          return this.graph.relativeAge(referenceId, targetId);
        }
      }

      const next = traversal.rawPath[index + 1];
      if (
        (step === "F" || step === "M") &&
        (next === "S" || next === "D")
      ) {
        const referenceId = traversal.personIds[index];
        const targetId = traversal.personIds[index + 2];
        if (referenceId && targetId) {
          return this.graph.relativeAge(referenceId, targetId);
        }
      }
    }

    return "unknown";
  }
}
