import { reciprocalCoreClassifications } from "./core-classification";
import type {
  AffinalSocialTerm,
  Context,
  CoreKinClass,
  KinClass,
  KinshipResolution,
  KPath,
  KStep,
  ProgressiveKinshipState,
  ProgressiveLineageAxis,
  ProgressiveTransitionSegment,
  Sex,
  TraversalResult,
} from "./model";
import { SOCIAL_DESCRIPTIONS } from "./social-protocol";

export type KinClassProjection = Omit<KinshipResolution, "traversal"> & {
  priority: number;
};

function progressiveAxis(
  classifications: readonly CoreKinClass[],
): ProgressiveLineageAxis {
  const patrilineal = classifications.some((classification) =>
    classification.startsWith("PATRILINEAL_"),
  );
  const matrilineal = classifications.some((classification) =>
    classification.startsWith("MATRILINEAL_"),
  );
  if (patrilineal && !matrilineal) return "PATRILINEAL";
  if (matrilineal && !patrilineal) return "MATRILINEAL";
  return "UNDETERMINED";
}

/** Convert a resolved prefix into the state consumed by the next edge. */
export function progressiveStateForResolution(
  resolution: KinshipResolution,
  traversal: TraversalResult,
  context: Context,
): ProgressiveKinshipState | undefined {
  if (
    (resolution.status !== "known" && resolution.status !== "ambiguous") ||
    !resolution.kinClass ||
    !resolution.coreClassifications?.length
  ) {
    return undefined;
  }

  if (resolution.progressiveState) {
    return {
      ...resolution.progressiveState,
      coreClassifications: [
        ...resolution.progressiveState.coreClassifications,
      ],
      derivation: [
        ...(resolution.derivation ?? resolution.progressiveState.derivation),
      ],
    };
  }

  const axis = progressiveAxis(resolution.coreClassifications);
  const finalStep = traversal.rawPath.at(-1);
  const matrilateralUncleLine =
    axis === "MATRILINEAL" &&
    resolution.kinClass === "GRANDFATHER" &&
    context.targetSex === "M" &&
    (finalStep === "B" ||
      resolution.ruleId === "SEKURU_HAAPERI" ||
      resolution.ruleId === "PROGRESSIVE_MATRILATERAL_UNCLE_SON");

  return {
    title: resolution.title,
    kinClass: resolution.kinClass,
    coreClassifications: [...resolution.coreClassifications],
    egoSex: context.egoSex,
    targetSex: context.targetSex,
    axis,
    branch: matrilateralUncleLine
      ? "MATRILATERAL_UNCLE_LINE"
      : finalStep === "B" || finalStep === "Z"
        ? "COLLATERAL"
        : "DIRECT",
    establishedBy: resolution.ruleId ?? "UNSPECIFIED_PREFIX_RULE",
    seniority: resolution.seniority ?? context.relativeAge,
    derivation: [...(resolution.derivation ?? [])],
  };
}

function progressiveKnown(
  ruleId: string,
  title: string,
  description: string,
  kinClass: KinClass,
  coreClassifications: CoreKinClass[],
  state: ProgressiveKinshipState,
  segment: ProgressiveTransitionSegment,
  branch: ProgressiveKinshipState["branch"],
): KinClassProjection {
  const derivation = [
    ...state.derivation,
    `${ruleId}: ${state.title} (${state.kinClass}) + ${segment.step} was reduced immediately before the next traversal edge.`,
  ];
  return {
    priority: 976,
    status: "known",
    specificity: "exact",
    ruleId,
    title,
    description,
    kinClass,
    coreClassifications,
    reducedPath: [],
    derivation,
    progressiveState: {
      title,
      kinClass,
      coreClassifications,
      egoSex: state.egoSex,
      targetSex: segment.targetSex,
      axis: progressiveAxis(coreClassifications),
      branch,
      establishedBy: ruleId,
      seniority: segment.egoRelativeAge,
      derivation,
    },
  };
}

function progressiveAmbiguousSibling(
  state: ProgressiveKinshipState,
  segment: ProgressiveTransitionSegment,
  coreClassifications: CoreKinClass[],
): KinClassProjection {
  const ruleId = "PROGRESSIVE_PARENT_CLASS_CHILD_SENIORITY_REQUIRED";
  const title = "Mukoma / Munin'ina";
  const derivation = [
    ...state.derivation,
    `${ruleId}: ${state.title} (${state.kinClass}) + ${segment.step} entered Ego's same-sex Sibling class, but seniority is unknown.`,
  ];

  return {
    priority: 976,
    status: "ambiguous",
    specificity: "exact",
    ruleId,
    title,
    description:
      "The child of your classificatory parent is your same-sex sibling-equivalent; seniority is required for the exact title.",
    kinClass: "SAME_SEX_SIBLING",
    coreClassifications,
    seniority: "unknown",
    possibilities: ["Mukoma", "Munin'ina"],
    reducedPath: [],
    derivation,
    progressiveState: {
      title,
      kinClass: "SAME_SEX_SIBLING",
      coreClassifications,
      egoSex: state.egoSex,
      targetSex: segment.targetSex,
      axis: progressiveAxis(coreClassifications),
      branch: "COLLATERAL",
      establishedBy: ruleId,
      seniority: "unknown",
      derivation,
    },
  };
}

function classificatoryParentChild(
  state: ProgressiveKinshipState,
  segment: ProgressiveTransitionSegment,
): KinClassProjection {
  const coreClassifications: CoreKinClass[] = [
    state.kinClass === "CLASSIFICATORY_FATHER"
      ? "PATRILINEAL_SIBLING"
      : "MATRILINEAL_SIBLING",
  ];

  if (state.egoSex !== segment.targetSex) {
    return {
      ...progressiveKnown(
        "PROGRESSIVE_PARENT_CLASS_CHILD_TO_HANZVADZI",
        "Hanzvadzi",
        "The child of your classificatory parent is your cross-sex sibling-equivalent.",
        "CROSS_SEX_SIBLING",
        coreClassifications,
        state,
        segment,
        "COLLATERAL",
      ),
      reducedPath: [segment.targetSex === "M" ? "B" : "Z"],
    };
  }

  if (segment.egoRelativeAge === "older") {
    return {
      ...progressiveKnown(
        "PROGRESSIVE_PARENT_CLASS_CHILD_TO_MUKOMA",
        "Mukoma",
        "The older same-sex child of your classificatory parent is your older sibling-equivalent.",
        "SAME_SEX_SIBLING",
        coreClassifications,
        state,
        segment,
        "COLLATERAL",
      ),
      reducedPath: [segment.targetSex === "M" ? "B" : "Z"],
    };
  }

  if (segment.egoRelativeAge === "younger") {
    return {
      ...progressiveKnown(
        "PROGRESSIVE_PARENT_CLASS_CHILD_TO_MUNININA",
        "Munin'ina",
        "The younger same-sex child of your classificatory parent is your younger sibling-equivalent.",
        "SAME_SEX_SIBLING",
        coreClassifications,
        state,
        segment,
        "COLLATERAL",
      ),
      reducedPath: [segment.targetSex === "M" ? "B" : "Z"],
    };
  }

  return {
    ...progressiveAmbiguousSibling(state, segment, coreClassifications),
    reducedPath: [segment.targetSex === "M" ? "B" : "Z"],
  };
}

/**
 * Advance one already-resolved Ego-relative prefix by exactly one graph edge.
 * These are finite class transitions, not complete-path lookup entries.
 */
export function advanceProgressiveKinship(
  state: ProgressiveKinshipState,
  segment: ProgressiveTransitionSegment,
): KinClassProjection | undefined {
  const maternalMother = state.coreClassifications.includes(
    "MATRILINEAL_MOTHER",
  );
  const maternalGrandparent = state.coreClassifications.includes(
    "MATRILINEAL_GRANDPARENT",
  );

  // Parent classes are functional categories. Their children enter Ego's
  // sibling class wherever that parent class was established in the path.
  // Exceptional parent-like classes (Tete and matrilateral Sekuru) have their
  // own transitions below and deliberately use distinct KinClass values.
  if (
    (state.kinClass === "CLASSIFICATORY_FATHER" ||
      state.kinClass === "CLASSIFICATORY_MOTHER") &&
    (segment.step === "S" || segment.step === "D")
  ) {
    return classificatoryParentChild(state, segment);
  }

  if (
    maternalMother &&
    state.kinClass === "CLASSIFICATORY_MOTHER" &&
    segment.step === "B"
  ) {
    return progressiveKnown(
      "PROGRESSIVE_MOTHER_CLASS_BROTHER_TO_SEKURU",
      "Sekuru",
      "A brother of any member of your matrilineal Mother class is elevated to Sekuru.",
      "GRANDFATHER",
      ["MATRILINEAL_GRANDPARENT"],
      state,
      segment,
      "MATRILATERAL_UNCLE_LINE",
    );
  }

  if (
    state.kinClass === "PATERNAL_AUNT" &&
    (segment.step === "S" || segment.step === "D")
  ) {
    return state.egoSex === "M"
      ? progressiveKnown(
          "PROGRESSIVE_TETE_CHILD_TO_MUZUKURU",
          "Muzukuru",
          "For a male Ego, a Tete's son or daughter enters the Grandchild class.",
          "MUZUKURU",
          ["PATRILINEAL_GRANDCHILD"],
          state,
          segment,
          "COLLATERAL",
        )
      : progressiveKnown(
          "PROGRESSIVE_TETE_CHILD_TO_MWANA",
          "Mwana",
          "For a female Ego, a Tete's son or daughter enters the Child class.",
          "CLASSIFICATORY_CHILD",
          ["PATRILINEAL_CHILD"],
          state,
          segment,
          "COLLATERAL",
        );
  }

  if (
    maternalMother &&
    state.kinClass === "CLASSIFICATORY_MOTHER" &&
    segment.step === "M"
  ) {
    return progressiveKnown(
      "PROGRESSIVE_MOTHER_TO_GRANDMOTHER",
      "Mbuya",
      "Your mother-class relative's mother is in your matrilineal Grandparent class.",
      "GRANDMOTHER",
      ["MATRILINEAL_GRANDPARENT"],
      state,
      segment,
      "DIRECT",
    );
  }

  if (
    maternalGrandparent &&
    state.kinClass === "GRANDMOTHER" &&
    segment.step === "B"
  ) {
    return progressiveKnown(
      "PROGRESSIVE_GRANDMOTHERS_BROTHER",
      "Sekuru",
      "Your Mbuya's brother remains in the matrilineal Grandparent class as Sekuru.",
      "GRANDFATHER",
      ["MATRILINEAL_GRANDPARENT"],
      state,
      segment,
      "MATRILATERAL_UNCLE_LINE",
    );
  }

  if (
    maternalGrandparent &&
    state.kinClass === "GRANDFATHER" &&
    state.branch === "MATRILATERAL_UNCLE_LINE"
  ) {
    if (segment.step === "S") {
      return progressiveKnown(
        "PROGRESSIVE_MATRILATERAL_UNCLE_SON",
        "Sekuru",
        "The male line descending from this matrilateral Sekuru remains Sekuru.",
        "GRANDFATHER",
        ["MATRILINEAL_GRANDPARENT"],
        state,
        segment,
        "MATRILATERAL_UNCLE_LINE",
      );
    }

    if (segment.step === "D") {
      return progressiveKnown(
        "PROGRESSIVE_MATRILATERAL_UNCLE_DAUGHTER",
        "Mainini",
        "The daughter reached from this matrilateral Sekuru enters the junior Mother class.",
        "CLASSIFICATORY_MOTHER",
        ["MATRILINEAL_MOTHER"],
        state,
        segment,
        "COLLATERAL",
      );
    }
  }

  return undefined;
}

/**
 * Return the fundamental K-step represented by a semantic kin class.
 *
 * These substitutions are deliberately class-based. A path can therefore
 * reach Maiguru, Mainini, or Mai by different genealogical routes and still
 * continue through the same classificatory-mother algebra.
 */
export function fundamentalStepForClass(
  kinClass: KinClass | undefined,
  relativeSex: Sex,
): KStep | undefined {
  switch (kinClass) {
    case "CLASSIFICATORY_FATHER":
      return "F";
    case "CLASSIFICATORY_MOTHER":
      return "M";
    case "CLASSIFICATORY_CHILD":
      return relativeSex === "M" ? "S" : "D";
    case "SAME_SEX_SIBLING":
    case "CROSS_SEX_SIBLING":
      return relativeSex === "M" ? "B" : "Z";
    default:
      return undefined;
  }
}

function known(
  ruleId: string,
  title: string,
  description: string,
  kinClass: KinClass,
  reducedPath: KPath,
  reverse: KinshipResolution,
  socialTerm?: AffinalSocialTerm,
  aliases?: string[],
): KinClassProjection {
  return {
    priority: 957,
    status: "known",
    specificity: "exact",
    ruleId,
    title,
    description,
    kinClass,
    coreClassifications: reciprocalCoreClassifications(
      reverse.coreClassifications,
    ),
    aliases,
    socialTerm,
    socialDescription: socialTerm
      ? SOCIAL_DESCRIPTIONS[socialTerm]
      : undefined,
    reducedPath,
    derivation: [
      ...(reverse.derivation ?? []),
      `${ruleId}: ${reverse.kinClass} has this declared reciprocal class in the reverse direction.`,
    ],
  };
}

function ambiguousSibling(
  traversal: TraversalResult,
  reverse: KinshipResolution,
): KinClassProjection {
  return {
    priority: 957,
    status: "ambiguous",
    specificity: "exact",
    ruleId: "RECIPROCAL_SAME_SEX_SIBLING_AGE_REQUIRED",
    title: "Mukoma / Munin'ina",
    description:
      "Your same-sex sibling-equivalent; relative seniority is required for the exact reciprocal title.",
    kinClass: "SAME_SEX_SIBLING",
    coreClassifications: reciprocalCoreClassifications(
      reverse.coreClassifications,
    ),
    seniority: "unknown",
    possibilities: ["Mukoma", "Munin'ina"],
    reducedPath: [...traversal.canonicalPath],
    derivation: [
      ...(reverse.derivation ?? []),
      "RECIPROCAL_SAME_SEX_SIBLING_AGE_REQUIRED: siblinghood is reciprocal but the available ordering does not distinguish Mukoma from Munin'ina.",
    ],
  };
}

/**
 * Calculate the culturally declared inverse of an already-resolved class.
 *
 * This is not a title dictionary: homonyms are separated by KinClass and
 * underdetermined classes are intentionally absent. The caller uses it only
 * after ordinary forward algebra has failed, so a precise directional rule
 * always wins over reciprocal inference.
 */
export function projectReciprocalClass(
  reverse: KinshipResolution,
  traversal: TraversalResult,
  context: Context,
): KinClassProjection | undefined {
  if (
    (reverse.status !== "known" && reverse.status !== "ambiguous") ||
    !reverse.kinClass
  ) {
    return undefined;
  }

  const reducedPath: KPath = [...traversal.canonicalPath];

  switch (reverse.kinClass) {
    case "SELF":
      return known(
        "RECIPROCAL_SELF",
        "You",
        "This is the selected person.",
        "SELF",
        reducedPath,
        reverse,
      );
    case "CLASSIFICATORY_FATHER":
    case "CLASSIFICATORY_MOTHER":
      return known(
        "RECIPROCAL_PARENT_TO_CHILD",
        "Mwana",
        "The reciprocal of a classificatory parent is a classificatory child.",
        "CLASSIFICATORY_CHILD",
        reducedPath,
        reverse,
      );
    case "CLASSIFICATORY_CHILD":
      return context.targetSex === "M"
        ? known(
            "RECIPROCAL_CHILD_TO_FATHER",
            "Baba",
            "The male reciprocal of a classificatory child is a classificatory father.",
            "CLASSIFICATORY_FATHER",
            reducedPath,
            reverse,
          )
        : known(
            "RECIPROCAL_CHILD_TO_MOTHER",
            "Mai",
            "The female reciprocal of a classificatory child is a classificatory mother.",
            "CLASSIFICATORY_MOTHER",
            reducedPath,
            reverse,
          );
    case "SAME_SEX_SIBLING":
      if (context.relativeAge === "older") {
        return {
          ...known(
            "RECIPROCAL_OLDER_SAME_SEX_SIBLING",
            "Mukoma",
            "Your older same-sex sibling-equivalent.",
            "SAME_SEX_SIBLING",
            reducedPath,
            reverse,
          ),
          seniority: "older",
        };
      }
      if (context.relativeAge === "younger") {
        return {
          ...known(
            "RECIPROCAL_YOUNGER_SAME_SEX_SIBLING",
            "Munin'ina",
            "Your younger same-sex sibling-equivalent.",
            "SAME_SEX_SIBLING",
            reducedPath,
            reverse,
          ),
          seniority: "younger",
        };
      }
      return ambiguousSibling(traversal, reverse);
    case "CROSS_SEX_SIBLING":
      return known(
        "RECIPROCAL_CROSS_SEX_SIBLING",
        "Hanzvadzi",
        "Cross-sex sibling-equivalence is reciprocal and independent of seniority.",
        "CROSS_SEX_SIBLING",
        reducedPath,
        reverse,
      );
    case "GRANDFATHER":
    case "GRANDMOTHER":
      return known(
        "RECIPROCAL_ANCESTOR_TO_MUZUKURU",
        "Muzukuru",
        "The reciprocal descendant of this ancestor-class relationship is Muzukuru.",
        "MUZUKURU",
        reducedPath,
        reverse,
        "Vasekedzani",
      );
    case "PATERNAL_AUNT":
      return {
        ...known(
          "RECIPROCAL_TETE_TO_MUZUKURU",
          "Muzukuru",
          "Tete exceptionally reciprocates through the Grandparent–Grandchild relationship rather than the ordinary Father–Child relationship.",
          "MUZUKURU",
          reducedPath,
          reverse,
          "Vasekedzani",
        ),
        coreClassifications: ["PATRILINEAL_GRANDCHILD"],
      };
    case "MUZUKURU":
      return context.targetSex === "M"
        ? known(
            "RECIPROCAL_MUZUKURU_TO_SEKURU",
            "Sekuru",
            "A male ancestor reciprocal to Muzukuru is Sekuru.",
            "GRANDFATHER",
            reducedPath,
            reverse,
            "Vasekedzani",
          )
        : known(
            "RECIPROCAL_MUZUKURU_TO_MBUYA",
            "Mbuya",
            "A female ancestor reciprocal to Muzukuru is Mbuya.",
            "GRANDMOTHER",
            reducedPath,
            reverse,
            "Vasekedzani",
          );
    case "HUSBAND":
      return known(
        "RECIPROCAL_HUSBAND_TO_WIFE",
        "Mukadzi",
        "The reciprocal of husband is wife.",
        "WIFE",
        reducedPath,
        reverse,
        "Vakaroorana",
      );
    case "WIFE":
      return known(
        "RECIPROCAL_WIFE_TO_HUSBAND",
        "Murume",
        "The reciprocal of wife is husband.",
        "HUSBAND",
        reducedPath,
        reverse,
        "Vakaroorana",
      );
    case "MOTHER_IN_LAW":
      return known(
        "RECIPROCAL_MOTHER_IN_LAW_TO_CHILD_IN_LAW",
        "Mwana",
        "A child's spouse remains Mwana and also carries the appropriate incoming or outgoing alliance title.",
        "CLASSIFICATORY_CHILD",
        reducedPath,
        reverse,
        "Vanyarikani",
        [context.targetSex === "M" ? "Mukwasha" : "Muroora"],
      );
    case "WIFE_GIVING_MALE_PEER":
      return known(
        "RECIPROCAL_WIFE_GIVER_TO_WIFE_RECEIVER",
        "Tsano",
        "The male reciprocal of a wife-giving peer is a wife-receiving peer.",
        "WIFE_RECEIVER_MALE_PEER",
        reducedPath,
        reverse,
        "Vanyarikani",
        ["Mukuwasha"],
      );
    case "WIFES_BROTHERS_WIFE":
      return known(
        "RECIPROCAL_AMBUYA_TO_MUKUWASHA",
        "Mukuwasha",
        "A wife's brother's wife reciprocally addresses the male wife-receiver as Mukuwasha.",
        "WIFE_RECEIVER_MALE_PEER",
        reducedPath,
        reverse,
        "Vanyarikani",
      );
    case "WIFE_RECEIVER_MALE_PEER":
      return known(
        "RECIPROCAL_MUKUWASHA_TO_AMBUYA",
        "Ambuya",
        "A male wife-receiving peer reciprocally addresses the wife's brother's wife as Ambuya.",
        "WIFES_BROTHERS_WIFE",
        reducedPath,
        reverse,
        "Vanyarikani",
      );
    default: {
      // Adding a new semantic class is a compile-time error until its reverse
      // cultural relationship is deliberately specified here.
      const exhaustiveClass: never = reverse.kinClass;
      return exhaustiveClass;
    }
  }
}
