import { AffinalProjector } from "./affinal-projector";
import { attachCoreClassifications } from "./core-classification";
import { FamilyTreeGraph } from "./family-tree-graph";
import {
  KinshipComposer,
  type ComposedKinshipResolution,
} from "./kinship-composer";
import {
  advanceProgressiveKinship,
  fundamentalStepForClass,
  progressiveStateForResolution,
  projectReciprocalClass,
} from "./kin-class-algebra";
import { terminalSiblingSeniority } from "./model";
import type {
  Context,
  KinClass,
  KinQuery,
  KinRule,
  KinshipResolution,
  KStep,
  TraversalResult,
} from "./model";
import { PathReducer } from "./path-reducer";

function exact(expected: readonly KStep[]) {
  return (path: readonly KStep[]) =>
    path.length === expected.length &&
    path.every((step, index) => step === expected[index]);
}

function isConsanguineal(path: readonly KStep[]) {
  return path.every((step) => step !== "H" && step !== "W");
}

const CLASSIFICATORY_PARENT_CLASSES = new Set<KinClass>([
  "CLASSIFICATORY_FATHER",
  "CLASSIFICATORY_MOTHER",
  "PATERNAL_AUNT",
  "GRANDFATHER",
  "GRANDMOTHER",
]);

const SPOUSE_INHERITED_GENERATIONAL_CLASSES = new Set<KinClass>([
  "CLASSIFICATORY_CHILD",
  "MUZUKURU",
  "GRANDFATHER",
  "GRANDMOTHER",
]);

const SPECIFICITY_RANK = {
  broad: 0,
  "alliance-side": 1,
  classificatory: 2,
  exact: 3,
} as const;

function known(
  ruleId: string,
  title: string,
  description: string,
  kinClass?: KinClass,
) {
  return {
    status: "known" as const,
    specificity: "exact" as const,
    ruleId,
    title,
    description,
    kinClass,
  };
}

function ambiguous(
  ruleId: string,
  title: string,
  description: string,
  possibilities: string[],
  kinClass?: KinClass,
) {
  return {
    status: "ambiguous" as const,
    specificity: "exact" as const,
    ruleId,
    title,
    description,
    possibilities,
    kinClass,
  };
}

const rules: KinRule[] = [
  {
    id: "SELF",
    axis: "contextual",
    priority: 1000,
    matches: exact([]),
    resolve: () =>
      known("SELF", "You", "This is the selected person.", "SELF"),
    explanation: "Ego and target are the same person.",
  },
  {
    id: "MATRILATERAL_UNCLE_DAUGHTER",
    axis: "M",
    priority: 990,
    provenance: {
      sources: [
        "Rose Jaji, Women, gender fluidity and Shona kinship structure in Zimbabwe, Anthropology Southern Africa 47(4), 2025, DOI: 10.1080/23323256.2025.2468523",
        "Rose Jaji, Kubereka: singleness, childlessness and non-biological mothering in Shona culture, Journal of Gender Studies, 2026, DOI: 10.1080/09589236.2026.2637530",
      ],
      confidence: "attested",
      sexCondition: "sex-invariant",
      scope:
        "The sources describe a mother's brother's daughter as occupying a mother/Mainini role without conditioning the relationship on Ego's sex.",
    },
    matches: exact(["M", "B", "D"]),
    resolve: () =>
      known(
        "MATRILATERAL_UNCLE_DAUGHTER",
        "Mainini",
        "Your maternal uncle's daughter, structurally a junior mother.",
        "CLASSIFICATORY_MOTHER",
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
        "GRANDFATHER",
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
      context.egoSex === "M"
        ? known(
            "PATERNAL_AUNT_CHILD_TO_MUZUKURU",
            "Muzukuru",
            "For a male Ego, a Tete's son or daughter enters the Grandchild class.",
            "MUZUKURU",
          )
        : known(
            "PATERNAL_AUNT_CHILD_TO_MWANA",
            "Mwana",
            "For a female Ego, a Tete's son or daughter enters the Child class.",
            "CLASSIFICATORY_CHILD",
          ),
    explanation:
      "Tete's child is Ego-sex-conditioned: Muzukuru for a male Ego and Mwana for a female Ego.",
  },
  {
    id: "CLASSIFICATORY_PARENT_SPOUSE",
    axis: "P",
    priority: 975,
    matches: (path) =>
      exact(["F", "B", "W"])(path) || exact(["M", "Z", "H"])(path),
    resolve: (path, context) => {
      const paternal = path[0] === "F";
      if (terminalSiblingSeniority(context) === "older") {
        return paternal
          ? known(
              "BAMKURU_WIFE",
              "Maiguru",
              "The wife of your father's older brother.",
              "CLASSIFICATORY_MOTHER",
            )
          : known(
              "MAIGURU_HUSBAND",
              "Bamkuru",
              "The husband of your mother's older sister.",
              "CLASSIFICATORY_FATHER",
            );
      }
      if (terminalSiblingSeniority(context) === "younger") {
        return paternal
          ? known(
              "BAMNINI_WIFE",
              "Mainini",
              "The wife of your father's younger brother.",
              "CLASSIFICATORY_MOTHER",
            )
          : known(
              "MAININI_HUSBAND",
              "Bamnini",
              "The husband of your mother's younger sister.",
              "CLASSIFICATORY_FATHER",
            );
      }
      return ambiguous(
        "CLASSIFICATORY_PARENT_SPOUSE_AGE_REQUIRED",
        paternal ? "Maiguru / Mainini" : "Bamkuru / Bamnini",
        "The classificatory parent's seniority is required.",
        paternal ? ["Maiguru", "Mainini"] : ["Bamkuru", "Bamnini"],
        paternal ? "CLASSIFICATORY_MOTHER" : "CLASSIFICATORY_FATHER",
      );
    },
    explanation:
      "A classificatory parent's spouse preserves that parent's seniority class.",
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
        "MUZUKURU",
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
          "CROSS_SEX_SIBLING",
        );
      }
      if (context.relativeAge === "older") {
        return {
          ...known(
            "OLDER_SAME_SEX_SIBLING",
            "Mukoma",
            "Your older same-sex sibling-equivalent.",
            "SAME_SEX_SIBLING",
          ),
          seniority: "older" as const,
        };
      }
      if (context.relativeAge === "younger") {
        return {
          ...known(
            "YOUNGER_SAME_SEX_SIBLING",
            "Munin'ina",
            "Your younger same-sex sibling-equivalent.",
            "SAME_SEX_SIBLING",
          ),
          seniority: "younger" as const,
        };
      }
      return {
        ...ambiguous(
          "SAME_SEX_SIBLING_AGE_REQUIRED",
          "Mukoma / Munin'ina",
          "Relative age is required for a same-sex sibling-equivalent.",
          ["Mukoma", "Munin'ina"],
          "SAME_SEX_SIBLING",
        ),
        seniority: "unknown" as const,
      };
    },
    explanation:
      "Sibling terminology uses sex correspondence and relative age.",
  },
  {
    id: "GRANDFATHERS_SISTER",
    axis: "contextual",
    priority: 855,
    matches: (path, context) =>
      context.generationDistance === 2 &&
      context.targetSex === "F" &&
      path.length === 3 &&
      (path[0] === "F" || path[0] === "M") &&
      path[1] === "F" &&
      path[2] === "Z",
    resolve: () =>
      known(
        "GRANDFATHERS_SISTER",
        "Tete",
        "Your grandfather's sister.",
        "PATERNAL_AUNT",
      ),
    explanation:
      "A female sibling of either paternal or maternal grandfather remains in the Tete class.",
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
        ? known("GRANDFATHER", "Sekuru", "Your grandfather.", "GRANDFATHER")
        : known(
            "GRANDMOTHER",
            "Mbuya",
            "Your grandmother.",
            "GRANDMOTHER",
          ),
    explanation: "Two upward generations form a grandparent category.",
  },
  {
    id: "GRANDPARENT_GENERATION_COLLATERAL",
    axis: "contextual",
    priority: 845,
    matches: (path, context) =>
      context.generationDistance === 2 &&
      path.length >= 2 &&
      isConsanguineal(path),
    resolve: (_path, context) =>
          context.targetSex === "M"
        ? known(
            "GRANDPARENT_GENERATION_MALE_COLLATERAL",
            "Sekuru",
            "Your male grandparent-generation relative.",
            "GRANDFATHER",
          )
        : known(
            "GRANDPARENT_GENERATION_FEMALE_COLLATERAL",
            "Mbuya",
            "Your female grandparent-generation relative.",
            "GRANDMOTHER",
          ),
    explanation:
      "Consanguineal piblings, siblings, and cousins in ego's grandparent generation are classified by target sex.",
  },
  {
    id: "GRANDCHILD",
    axis: "contextual",
    priority: 850,
    matches: (path, context) =>
      context.generationDistance === -2 &&
      path.length === 2 &&
      path.every((step) => step === "S" || step === "D"),
    resolve: () =>
      known("GRANDCHILD", "Muzukuru", "Your grandchild.", "MUZUKURU"),
    explanation: "Two downward generations form a grandchild category.",
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
          if (terminalSiblingSeniority(context) === "older")
            return known(
              "PATERNAL_UNCLE_OLDER",
              "Bamkuru",
              description,
              "CLASSIFICATORY_FATHER",
            );
          if (terminalSiblingSeniority(context) === "younger")
            return known(
              "PATERNAL_UNCLE_YOUNGER",
              "Bamnini",
              description,
              "CLASSIFICATORY_FATHER",
            );
          return ambiguous("PATERNAL_UNCLE_AGE_REQUIRED", title, description, [
            "Bamkuru",
            "Bamnini",
          ], "CLASSIFICATORY_FATHER");
        }
        if (encoded === "M.Z") {
          if (terminalSiblingSeniority(context) === "older")
            return known(
              "MATERNAL_AUNT_OLDER",
              "Maiguru",
              description,
              "CLASSIFICATORY_MOTHER",
            );
          if (terminalSiblingSeniority(context) === "younger")
            return known(
              "MATERNAL_AUNT_YOUNGER",
              "Mainini",
              description,
              "CLASSIFICATORY_MOTHER",
            );
          return ambiguous("MATERNAL_AUNT_AGE_REQUIRED", title, description, [
            "Maiguru",
            "Mainini",
          ], "CLASSIFICATORY_MOTHER");
        }
        const kinClass: KinClass | undefined =
          encoded === "F"
            ? "CLASSIFICATORY_FATHER"
            : encoded === "M"
              ? "CLASSIFICATORY_MOTHER"
              : encoded === "S" || encoded === "D"
                ? "CLASSIFICATORY_CHILD"
                : encoded === "H"
                  ? "HUSBAND"
                  : encoded === "W"
                    ? "WIFE"
                    : encoded === "F.Z"
                      ? "PATERNAL_AUNT"
                      : undefined;
        return known(
          `BASIC_${encoded.replace(".", "_")}`,
          title,
          description,
          kinClass,
        );
      },
      explanation: `${encoded} is a fundamental kin category.`,
    };
  }),
];

export class KinshipResolver {
  private readonly reducer: PathReducer;
  private readonly affinalProjector: AffinalProjector;
  private readonly composer = new KinshipComposer();
  private readonly resolutionCache = new Map<string, KinshipResolution>();
  private readonly reciprocalPairsInProgress = new Set<string>();

  constructor(
    private readonly graph: FamilyTreeGraph,
    reducer = new PathReducer(),
  ) {
    this.reducer = reducer;
    this.affinalProjector = new AffinalProjector(graph, reducer);
  }

  resolve(query: KinQuery): KinshipResolution {
    const cacheKey = JSON.stringify([
      query.egoId,
      query.targetId,
      query.egoSex ?? null,
      query.targetSex ?? null,
      query.relativeAge ?? null,
    ]);
    const cached = this.resolutionCache.get(cacheKey);
    if (cached) return cached;

    const resolution = this.resolveUncached(query);
    this.resolutionCache.set(cacheKey, resolution);
    return resolution;
  }

  private resolveUncached(query: KinQuery): KinshipResolution {
    const validation = this.graph.getValidationReport();
    if (!validation.valid) {
      return {
        status: "invalid",
        specificity: "broad",
        title: "Invalid family data",
        description:
          "Kinship cannot be resolved until the family graph validation errors are corrected.",
        validationIssues: validation.issues,
      };
    }

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
        query.relativeAge ?? this.graph.relativeAge(query.egoId, query.targetId),
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
        siblingSeniorities: traversal.siblingSeniorities,
      };
      return attachCoreClassifications(
        this.resolveTraversal(traversal, context),
        traversal,
        context,
      );
    });

    candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const bestPriority = candidates[0].priority ?? 0;
    const best = candidates.filter(
      (candidate) => (candidate.priority ?? 0) === bestPriority,
    );
    const categories = [
      ...new Set(
        best.map(
          (candidate) =>
            `${candidate.title}\u0000${candidate.kinClass ?? ""}\u0000${candidate.socialTerm ?? ""}`,
        ),
      ),
    ];

    if (categories.length > 1) {
      return {
        status: "ambiguous",
        specificity: "exact",
        title: "Multiple valid relationships",
        description:
          "Equally short paths resolve to different Shona categories.",
        possibilities: best.map((candidate) =>
          candidate.socialTerm
            ? `${candidate.title} (${candidate.socialTerm})`
            : candidate.title,
        ),
        traversal: best[0].traversal,
      };
    }

    const resolution: KinshipResolution & { priority?: number } = {
      ...best[0],
      coreClassifications: [
        ...new Set(
          best.flatMap((candidate) => candidate.coreClassifications ?? []),
        ),
      ],
    };
    if (resolution.coreClassifications?.length === 0) {
      delete resolution.coreClassifications;
    }
    delete resolution.priority;

    if (
      resolution.status === "broad" ||
      resolution.specificity === "alliance-side"
    ) {
      const reciprocal = this.resolveFromReciprocal(query, resolution);
      if (
        reciprocal &&
        SPECIFICITY_RANK[reciprocal.specificity ?? "exact"] >
          SPECIFICITY_RANK[resolution.specificity ?? "exact"]
      ) {
        return reciprocal;
      }
    }

    return resolution;
  }

  private resolveTraversal(
    traversal: TraversalResult,
    context: Context,
  ): KinshipResolution & { priority: number } {
    const resolution = attachCoreClassifications(
      this.resolveTraversalByAlgebra(traversal, context),
      traversal,
      context,
    );
    const resolvedTraversal = resolution.traversal ?? traversal;
    const existing = resolvedTraversal.nodeClassifications ?? [];
    let nodeClassifications = [...existing];

    // Exact cultural axioms remain authoritative at their terminal node, but
    // their preceding nodes must still be classified. Build the trace from
    // the immediate canonical prefix when the algebra did not already carry
    // one forward for us.
    if (nodeClassifications.length === 0) {
      const canonicalSegments =
        traversal.canonicalSegments ??
        this.graph.describeCanonicalSegments(
          traversal.personIds,
          traversal.rawPath,
        );
      const finalSegment = canonicalSegments.at(-1);
      if (canonicalSegments.length > 1 && finalSegment) {
        const prefixRawPath = traversal.rawPath.slice(
          0,
          finalSegment.rawStartIndex,
        );
        const prefixPersonIds = traversal.personIds.slice(
          0,
          finalSegment.rawStartIndex + 1,
        );
        const prefixPerson = this.graph.getPerson(finalSegment.fromPersonId);
        if (prefixPerson) {
          const prefixTraversal: TraversalResult = {
            personIds: prefixPersonIds,
            rawPath: prefixRawPath,
            canonicalPath: FamilyTreeGraph.canonicalize(prefixRawPath),
            canonicalSegments: canonicalSegments.slice(0, -1),
            generationDistance:
              FamilyTreeGraph.generationDistance(prefixRawPath),
            siblingSeniorities: this.graph.describeSiblingSeniorities(
              prefixPersonIds,
              prefixRawPath,
            ),
          };
          const prefixContext: Context = {
            egoId: context.egoId,
            targetId: finalSegment.fromPersonId,
            egoSex: context.egoSex,
            targetSex: prefixPerson.sex,
            relativeAge: this.graph.relativeAge(
              context.egoId,
              finalSegment.fromPersonId,
            ),
            siblingSeniorities: prefixTraversal.siblingSeniorities,
            generationDistance: prefixTraversal.generationDistance,
          };
          nodeClassifications = [
            ...(this.resolveTraversal(prefixTraversal, prefixContext).traversal
              ?.nodeClassifications ?? []),
          ];
        }
      }
    }

    if (!nodeClassifications.some((entry) => entry.personId === context.egoId)) {
      nodeClassifications.unshift({
        egoId: context.egoId,
        personId: context.egoId,
        canonicalPath: [],
        status: "known",
        title: "You",
        kinClass: "SELF",
        coreClassifications: [],
        seniority: "same",
        establishedBy: "SELF",
      });
    }

    const targetClassification = {
      egoId: context.egoId,
      personId: context.targetId,
      canonicalPath: [...traversal.canonicalPath],
      status: resolution.status,
      title: resolution.title,
      kinClass: resolution.kinClass,
      coreClassifications: [...(resolution.coreClassifications ?? [])],
      seniority: resolution.seniority ?? context.relativeAge,
      establishedBy: resolution.ruleId ?? "RELATIONSHIP_UNMAPPED",
    };
    const targetIndex = nodeClassifications.findIndex(
      (entry) => entry.personId === context.targetId,
    );
    if (targetIndex >= 0) {
      nodeClassifications[targetIndex] = targetClassification;
    } else {
      nodeClassifications.push(targetClassification);
    }

    return {
      ...resolution,
      traversal: {
        ...resolvedTraversal,
        nodeClassifications,
      },
    };
  }

  private resolveTraversalByAlgebra(
    traversal: TraversalResult,
    context: Context,
  ): KinshipResolution & { priority: number } {
    const canonicalRule = this.bestRule(traversal.canonicalPath, context, 970);
    const progressiveResolution = canonicalRule
      ? undefined
      : this.resolveProgressiveContinuation(traversal, context);

    if (progressiveResolution) {
      return {
        ...progressiveResolution,
        traversal: progressiveResolution.traversal ?? traversal,
      };
    }

    const grandparentAncestor = canonicalRule
      ? undefined
      : this.resolveGrandparentAncestor(traversal, context);

    if (grandparentAncestor) {
      return {
        priority: 965,
        ...grandparentAncestor,
        traversal,
        reducedPath: traversal.canonicalPath,
        derivation: [
          "GRANDPARENT_ANCESTOR: ancestors of Sekuru or Mbuya remain in the grandparent class according to target sex.",
        ],
      };
    }

    const muzukuruDescendant = canonicalRule
      ? undefined
      : this.resolveMuzukuruLineageDescendant(traversal, context);

    if (muzukuruDescendant) {
      return {
        priority: 965,
        ...muzukuruDescendant,
        traversal,
        reducedPath: traversal.canonicalPath,
        derivation: [
          "MUZUKURU_LINEAGE_DESCENDANT: a child of Mwana enters the Muzukuru class, whose later descendants remain Muzukuru.",
        ],
      };
    }

    const sourceResolution = canonicalRule
      ? undefined
      : this.resolveSourceBeforeMarriage(traversal, context);
    const affinalProjection = canonicalRule
      ? null
      : this.affinalProjector.project(traversal, context, sourceResolution);
    const deferredAffinalProjection =
      affinalProjection?.specificity === "alliance-side"
        ? affinalProjection
        : null;

    if (affinalProjection && !deferredAffinalProjection) {
      return {
        ...affinalProjection,
        traversal,
      };
    }

    const inheritedSpouseKin = canonicalRule
      ? undefined
      : this.resolveLeadingSpouseInheritance(traversal, context);
    if (inheritedSpouseKin) {
      return {
        priority: 960,
        ...inheritedSpouseKin,
        traversal,
        reducedPath: traversal.canonicalPath,
      };
    }

    const reduction = this.reducer.reduce(traversal.canonicalPath, context);
    const rule = canonicalRule ?? this.bestRule(reduction.reducedPath, context);

    if (!rule?.resolve) {
      const grandparentProjection = this.resolveParentClassAsGrandparent(
        traversal,
        context,
      );
      if (grandparentProjection) {
        return {
          priority: 965,
          ...grandparentProjection,
          traversal,
          reducedPath: reduction.reducedPath,
          derivation: [
            ...reduction.derivation,
            "PARENT_CLASS_TO_GRANDPARENT: a child's parent's classificatory parent becomes the child's grandparent class.",
          ],
        };
      }

      const composed = this.composer.compose(traversal, context, {
        resolveBetween: (egoId, targetId) =>
          this.resolve({
            egoId,
            targetId,
            relativeAge: this.graph.relativeAge(egoId, targetId),
          }),
        projectSemanticContinuation: (splitIndex, prefix) =>
          this.projectSemanticContinuation(
            traversal,
            context,
            splitIndex,
            prefix,
          ),
        projectMwanaAlliance: (marriageIndex, prefix) =>
          this.projectMwanaAlliance(
            traversal,
            context,
            marriageIndex,
            prefix,
          ),
      });
      if (composed) {
        return {
          ...composed,
          traversal,
        };
      }

      // Generic wife-giving/wife-receiving labels are valid fallbacks, but
      // they must not prevent a more precise semantic composition from being
      // attempted first.
      if (deferredAffinalProjection) {
        return {
          ...deferredAffinalProjection,
          traversal,
        };
      }

      return {
        ...this.composer.broad(
          traversal,
          reduction.reducedPath,
          reduction.derivation,
        ),
        traversal,
      };
    }

    const resolved = rule.resolve(
      canonicalRule ? traversal.canonicalPath : reduction.reducedPath,
      context,
    );
    return {
      priority: rule.priority,
      ...resolved,
      provenance: resolved.provenance ?? rule.provenance,
      traversal,
      reducedPath: reduction.reducedPath,
      derivation: [...reduction.derivation, `${rule.id}: ${rule.explanation}`],
    };
  }

  /**
   * Resolve the complete prefix first, then advance it by the final graph edge.
   * Inductively, every longer traversal therefore continues the semantic state
   * established by its left prefix and cannot be regrouped around a suffix.
   */
  private resolveProgressiveContinuation(
    traversal: TraversalResult,
    context: Context,
  ):
    | (ComposedKinshipResolution & { traversal: TraversalResult })
    | undefined {
    const canonicalSegments =
      traversal.canonicalSegments ??
      this.graph.describeCanonicalSegments(
        traversal.personIds,
        traversal.rawPath,
      );
    if (
      canonicalSegments.length < 2 ||
      !isConsanguineal(traversal.rawPath)
    ) {
      return undefined;
    }

    const finalSegment = canonicalSegments.at(-1);
    if (!finalSegment) return undefined;
    const { fromPersonId, toPersonId } = finalSegment;
    const fromPerson = fromPersonId
      ? this.graph.getPerson(fromPersonId)
      : undefined;
    const toPerson = toPersonId ? this.graph.getPerson(toPersonId) : undefined;
    if (!fromPersonId || !toPersonId || !fromPerson || !toPerson) {
      return undefined;
    }

    const prefixRawPath = traversal.rawPath.slice(
      0,
      finalSegment.rawStartIndex,
    );
    const prefixPersonIds = traversal.personIds.slice(
      0,
      finalSegment.rawStartIndex + 1,
    );
    const prefixTraversal: TraversalResult = {
      personIds: prefixPersonIds,
      rawPath: prefixRawPath,
      canonicalPath: FamilyTreeGraph.canonicalize(prefixRawPath),
      canonicalSegments: canonicalSegments.slice(0, -1),
      generationDistance: FamilyTreeGraph.generationDistance(prefixRawPath),
      siblingSeniorities: this.graph.describeSiblingSeniorities(
        prefixPersonIds,
        prefixRawPath,
      ),
    };
    const prefixContext: Context = {
      egoId: context.egoId,
      targetId: fromPersonId,
      egoSex: context.egoSex,
      targetSex: fromPerson.sex,
      relativeAge: this.graph.relativeAge(context.egoId, fromPersonId),
      siblingSeniorities: prefixTraversal.siblingSeniorities,
      generationDistance: prefixTraversal.generationDistance,
    };
    const prefixResolution: KinshipResolution & { priority: number } =
      attachCoreClassifications(
      this.resolveTraversal(prefixTraversal, prefixContext),
      prefixTraversal,
      prefixContext,
      );
    const state = progressiveStateForResolution(
      prefixResolution,
      prefixTraversal,
      prefixContext,
    );
    if (!state) return undefined;

    const advanced = advanceProgressiveKinship(state, {
      step: finalSegment.step,
      fromPersonId,
      toPersonId,
      targetSex: toPerson.sex,
      egoRelativeAge: context.relativeAge,
      relativeAge: this.graph.relativeAge(fromPersonId, toPersonId),
    });
    if (!advanced) return undefined;
    const advancedReducedPath = advanced.reducedPath;

    return {
      ...advanced,
      reducedPath:
        advancedReducedPath && advancedReducedPath.length > 0
          ? [...advancedReducedPath]
          : [...traversal.canonicalPath],
      traversal: {
        ...traversal,
        nodeClassifications:
          prefixResolution.traversal?.nodeClassifications ?? [],
      },
    };
  }

  /**
   * Continue a path from an already-resolved semantic class. The prefix may
   * have been reached through any number of genealogical or affinal steps;
   * replacing it by its fundamental class edge prevents full-path maps and
   * makes ordinary reduction rules reusable at arbitrary depth.
   */
  private projectSemanticContinuation(
    traversal: TraversalResult,
    context: Context,
    splitIndex: number,
    prefix: KinshipResolution,
  ): ComposedKinshipResolution | null {
    const sourceId = traversal.personIds[splitIndex];
    const source = sourceId ? this.graph.getPerson(sourceId) : undefined;
    if (!source) return null;

    const fundamentalStep = fundamentalStepForClass(
      prefix.kinClass,
      source.sex,
    );
    if (!fundamentalStep) return null;

    const suffix = traversal.rawPath.slice(splitIndex);
    if (1 + suffix.length >= traversal.rawPath.length) return null;

    const rawPath: KStep[] = [fundamentalStep, ...suffix];
    const compacted: TraversalResult = {
      personIds: [
        context.egoId,
        sourceId,
        ...traversal.personIds.slice(splitIndex + 1),
      ],
      rawPath,
      canonicalPath: FamilyTreeGraph.canonicalize(rawPath),
      generationDistance: FamilyTreeGraph.generationDistance(rawPath),
      siblingSeniorities: this.graph.describeSiblingSeniorities(
        [
          context.egoId,
          sourceId,
          ...traversal.personIds.slice(splitIndex + 1),
        ],
        rawPath,
      ),
    };
    const compactedContext: Context = {
      ...context,
      generationDistance: compacted.generationDistance,
      siblingSeniorities: compacted.siblingSeniorities,
    };
    const projected = this.resolveTraversal(compacted, compactedContext);
    if (projected.status !== "known" && projected.status !== "ambiguous") {
      return null;
    }

    const { traversal: compactedTraversal, ...resolution } = projected;
    return {
      ...resolution,
      reducedPath: [...traversal.canonicalPath],
      derivation: [
        ...(prefix.derivation ?? []),
        ...(projected.derivation ?? []),
        `SEMANTIC_CLASS_CONTINUATION: ${prefix.kinClass} was compacted to ${fundamentalStep}; the ordinary algebra resolved ${(compactedTraversal ?? compacted).canonicalPath.join(".")}.`,
      ],
    };
  }

  /**
   * If the forward algebra is connected but incomplete, calculate the reverse
   * direction once and apply only an explicitly declared reciprocal class.
   * The unordered-pair guard prevents E→T and T→E from recursively asking
   * each other for an answer when neither direction is culturally defined.
   */
  private resolveFromReciprocal(
    query: KinQuery,
    direct: KinshipResolution,
  ): KinshipResolution | undefined {
    const traversal = direct.traversal;
    const ego = this.graph.getPerson(query.egoId);
    const target = this.graph.getPerson(query.targetId);
    if (!traversal || !ego || !target) return undefined;

    const pairKey = [query.egoId, query.targetId].sort().join("\u0000");
    if (this.reciprocalPairsInProgress.has(pairKey)) return undefined;

    this.reciprocalPairsInProgress.add(pairKey);
    try {
      const reverse = this.resolveUncached({
        egoId: query.targetId,
        targetId: query.egoId,
        egoSex: query.targetSex,
        targetSex: query.egoSex,
      });
      const context: Context = {
        egoId: query.egoId,
        targetId: query.targetId,
        egoSex: query.egoSex ?? ego.sex,
        targetSex: query.targetSex ?? target.sex,
        relativeAge:
          query.relativeAge ??
          this.graph.relativeAge(query.egoId, query.targetId),
        siblingSeniorities: traversal.siblingSeniorities,
        generationDistance: traversal.generationDistance,
      };
      const reciprocal = projectReciprocalClass(reverse, traversal, context);
      return reciprocal ? { ...reciprocal, traversal } : undefined;
    } finally {
      this.reciprocalPairsInProgress.delete(pairKey);
    }
  }

  /**
   * Rebase an arbitrarily derived Mwana prefix onto the fundamental child
   * edge and reuse the existing child-alliance projector for the remaining
   * marriage suffix. This makes the composition depend on Mwana, not on the
   * complete path which originally produced that class.
   */
  private projectMwanaAlliance(
    traversal: TraversalResult,
    context: Context,
    marriageIndex: number,
    prefix: KinshipResolution,
  ): ComposedKinshipResolution | null {
    const sourceId = traversal.personIds[marriageIndex];
    const source = sourceId ? this.graph.getPerson(sourceId) : undefined;
    if (!source) return null;

    const childStep: KStep = source.sex === "M" ? "S" : "D";
    const rawPath: KStep[] = [
      childStep,
      ...traversal.rawPath.slice(marriageIndex),
    ];
    const personIds = [
      context.egoId,
      ...traversal.personIds.slice(marriageIndex),
    ];
    const compacted: TraversalResult = {
      personIds,
      rawPath,
      canonicalPath: FamilyTreeGraph.canonicalize(rawPath),
      generationDistance: FamilyTreeGraph.generationDistance(rawPath),
      siblingSeniorities: this.graph.describeSiblingSeniorities(
        personIds,
        rawPath,
      ),
    };
    const compactedContext: Context = {
      ...context,
      generationDistance: compacted.generationDistance,
      siblingSeniorities: compacted.siblingSeniorities,
    };
    const projection = this.affinalProjector.project(
      compacted,
      compactedContext,
    );
    if (!projection) return null;

    return {
      ...projection,
      reducedPath: [...traversal.canonicalPath],
      derivation: [
        ...(prefix.derivation ?? []),
        ...(projection.derivation ?? []),
        "COMPOSED_MWANA_ALLIANCE: an already-resolved Mwana prefix was compacted to its fundamental child class before applying the remaining affinal suffix.",
      ],
    };
  }

  /**
   * Compose a leading parent edge with the relationship already calculated
   * from that parent. A person in the parent's classificatory-parent class is
   * in the child's grandparent class, even when Omaha skewing means the raw
   * genealogy is not a simple F.F or M.M path.
   */
  private resolveParentClassAsGrandparent(
    traversal: TraversalResult,
    context: Context,
  ) {
    const firstStep = traversal.rawPath[0];
    if (
      traversal.rawPath.length < 2 ||
      (firstStep !== "F" && firstStep !== "M") ||
      !isConsanguineal(traversal.canonicalPath)
    ) {
      return undefined;
    }

    const parentId = traversal.personIds[1];
    if (!parentId || parentId === context.targetId) return undefined;

    const parentResolution = this.resolve({
      egoId: parentId,
      targetId: context.targetId,
      relativeAge: this.graph.relativeAge(parentId, context.targetId),
    });

    if (
      parentResolution.status !== "known" ||
      !parentResolution.kinClass ||
      !CLASSIFICATORY_PARENT_CLASSES.has(parentResolution.kinClass)
    ) {
      return undefined;
    }

    return context.targetSex === "M"
      ? known(
          "PARENT_CLASS_MALE_GRANDPARENT",
          "Sekuru",
          "Your parent's male classificatory parent is in your Sekuru class.",
          "GRANDFATHER",
        )
      : known(
          "PARENT_CLASS_FEMALE_GRANDPARENT",
          "Mbuya",
          "Your parent's female classificatory parent is in your Mbuya class.",
          "GRANDMOTHER",
        );
  }

  /**
   * Reciprocate the recursive Muzukuru descendant rule in the upward
   * direction. Once the person immediately below the target belongs to ego's
   * grandparent class, that person's parent remains in the same class, with
   * the final ancestor's sex selecting Sekuru or Mbuya. Each recursive
   * call resolves a strictly shorter traversal, so arbitrary depths terminate.
   */
  private resolveGrandparentAncestor(
    traversal: TraversalResult,
    context: Context,
  ) {
    const finalStep = traversal.rawPath.at(-1);
    if (
      traversal.rawPath.length < 2 ||
      (finalStep !== "F" && finalStep !== "M")
    ) {
      return undefined;
    }

    const descendantId = traversal.personIds.at(-2);
    if (!descendantId || descendantId === context.egoId) return undefined;

    const descendantResolution = this.resolve({
      egoId: context.egoId,
      targetId: descendantId,
      egoSex: context.egoSex,
      relativeAge: this.graph.relativeAge(context.egoId, descendantId),
    });

    if (
      descendantResolution.status !== "known" ||
      (descendantResolution.kinClass !== "GRANDFATHER" &&
        descendantResolution.kinClass !== "GRANDMOTHER")
    ) {
      return undefined;
    }

    return context.targetSex === "M"
      ? known(
          "RECURSIVE_MALE_GRANDPARENT_ANCESTOR",
          "Sekuru",
          "A male ancestor of your grandparent-class relative remains Sekuru.",
          "GRANDFATHER",
        )
      : known(
          "RECURSIVE_FEMALE_GRANDPARENT_ANCESTOR",
          "Mbuya",
          "A female ancestor of your grandparent-class relative remains Mbuya.",
          "GRANDMOTHER",
        );
  }

  /**
   * Enter Muzukuru from a child of Mwana, then propagate Muzukuru through any
   * number of later child edges. Resolving only the target's parent keeps this
   * rule recursive and path-independent: each call operates on a strictly
   * shorter traversal and therefore terminates at the relationship that
   * established Mwana or Muzukuru.
   */
  private resolveMuzukuruLineageDescendant(
    traversal: TraversalResult,
    context: Context,
  ) {
    const finalStep = traversal.rawPath.at(-1);
    if (
      traversal.rawPath.length < 2 ||
      (finalStep !== "S" && finalStep !== "D")
    ) {
      return undefined;
    }

    const parentId = traversal.personIds.at(-2);
    if (!parentId || parentId === context.egoId) return undefined;

    const parentResolution = this.resolve({
      egoId: context.egoId,
      targetId: parentId,
      egoSex: context.egoSex,
      relativeAge: this.graph.relativeAge(context.egoId, parentId),
    });

    if (parentResolution.status !== "known") {
      return undefined;
    }

    if (parentResolution.kinClass === "CLASSIFICATORY_CHILD") {
      return known(
        "MWANA_CHILD_TO_MUZUKURU",
        "Muzukuru",
        "A child of your Mwana enters your Muzukuru category.",
        "MUZUKURU",
      );
    }

    if (parentResolution.kinClass !== "MUZUKURU") return undefined;

    return known(
      "MUZUKURU_DESCENDANT",
      "Muzukuru",
      "A descendant of your Muzukuru remains in your Muzukuru category.",
      "MUZUKURU",
    );
  }

  /**
   * Resolve the relative immediately before a terminal marriage edge. The
   * prefix is strictly shorter than the target traversal, so recursive
   * kin-class projection terminates while reusing the engine's existing rules.
   */
  private resolveSourceBeforeMarriage(
    traversal: TraversalResult,
    context: Context,
  ): KinshipResolution | undefined {
    const marriageStep = traversal.rawPath.at(-1);
    if (
      traversal.rawPath.length < 2 ||
      (marriageStep !== "H" && marriageStep !== "W")
    ) {
      return undefined;
    }

    const sourceId = traversal.personIds.at(-2);
    if (!sourceId || sourceId === context.egoId) return undefined;

    return this.resolve({
      egoId: context.egoId,
      targetId: sourceId,
      egoSex: context.egoSex,
      // A terminal spouse can have a different age from the relative through
      // whom the marriage is reached. Preserve the source relative's own
      // explicit sibling seniority (or birth order) for class projection.
      relativeAge: this.graph.relativeAge(context.egoId, sourceId),
    });
  }

  /**
   * Resolve the spouse-to-target relationship first, then project its
   * semantic class through Ego's leading marriage edge. Fundamental classes
   * reuse the ordinary short affinal rules (for example H + Z -> Tete), while
   * stable recursive generations retain the spouse's established class.
   * Resolving from the direct spouse shortens the traversal and terminates.
   */
  private resolveLeadingSpouseInheritance(
    traversal: TraversalResult,
    context: Context,
  ): KinshipResolution | undefined {
    const firstStep = traversal.rawPath[0];
    if (
      traversal.rawPath.length < 2 ||
      (firstStep !== "H" && firstStep !== "W")
    ) {
      return undefined;
    }

    const spouseId = traversal.personIds[1];
    if (!spouseId || spouseId === context.targetId) return undefined;

    const spouseResolution = this.resolve({
      egoId: spouseId,
      targetId: context.targetId,
      relativeAge: this.graph.relativeAge(spouseId, context.targetId),
    });
    if (
      spouseResolution.status !== "known" ||
      !spouseResolution.kinClass
    ) {
      return undefined;
    }

    const fundamentalStep = fundamentalStepForClass(
      spouseResolution.kinClass,
      context.targetSex,
    );
    if (fundamentalStep) {
      const rawPath: KStep[] = [firstStep, fundamentalStep];
      const personIds = [context.egoId, spouseId, context.targetId];
      const compacted: TraversalResult = {
        personIds,
        rawPath,
        canonicalPath: FamilyTreeGraph.canonicalize(rawPath),
        generationDistance: FamilyTreeGraph.generationDistance(rawPath),
        siblingSeniorities: this.graph.describeSiblingSeniorities(
          personIds,
          rawPath,
        ),
      };
      const compactedContext: Context = {
        ...context,
        generationDistance: compacted.generationDistance,
        siblingSeniorities: compacted.siblingSeniorities,
      };
      const projected = this.affinalProjector.project(
        compacted,
        compactedContext,
      );

      if (projected && projected.specificity !== "alliance-side") {
        const resolution: KinshipResolution & { priority?: number } = {
          ...projected,
        };
        delete resolution.priority;
        return {
          ...resolution,
          provenance: resolution.provenance ?? spouseResolution.provenance,
          derivation: [
            ...(spouseResolution.derivation ?? []),
            ...(resolution.derivation ?? []),
            `AFFINAL_LEADING_SPOUSE_SEMANTIC_PROJECTION: ${spouseResolution.kinClass} was compacted to ${fundamentalStep} and projected through the leading ${firstStep} edge.`,
          ],
        };
      }
    }

    if (
      !SPOUSE_INHERITED_GENERATIONAL_CLASSES.has(spouseResolution.kinClass)
    ) {
      return undefined;
    }

    return {
      status: "known",
      ruleId: "AFFINAL_LEADING_SPOUSE_INHERITED_GENERATIONAL_CLASS",
      title: spouseResolution.title,
      kinClass: spouseResolution.kinClass,
      specificity: spouseResolution.specificity,
      seniority: spouseResolution.seniority,
      aliases: spouseResolution.aliases,
      provenance: spouseResolution.provenance,
      description: `By marriage, you inherit your spouse's ${spouseResolution.title} relationship to this relative.`,
      socialTerm: spouseResolution.socialTerm,
      socialDescription: spouseResolution.socialDescription,
      derivation: [
        ...(spouseResolution.derivation ?? []),
        `AFFINAL_LEADING_SPOUSE_INHERITED_GENERATIONAL_CLASS: the leading ${firstStep} edge transfers the spouse's stable generational class.`,
      ],
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

}
