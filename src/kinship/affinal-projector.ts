import { FamilyTreeGraph } from "./family-tree-graph";
import type {
  AffinalSocialTerm,
  Context,
  KinshipResolution,
  KPath,
  KStep,
  Sex,
  TraversalResult,
} from "./model";
import { PathReducer } from "./path-reducer";

type AffinalProjection = Omit<KinshipResolution, "traversal"> & {
  priority: number;
};

const SOCIAL_DESCRIPTIONS: Record<AffinalSocialTerm, string> = {
  Vanyarikani:
    "A relationship governed primarily by respect, restraint, and the appropriate honorific forms.",
  Vasekedzani:
    "A reciprocal joking relationship in which familiar teasing helps sustain the alliance.",
  Vakaroorana: "The reciprocal social relationship between married spouses.",
};

function exact(path: readonly KStep[], expected: readonly KStep[]) {
  return (
    path.length === expected.length &&
    path.every((step, index) => step === expected[index])
  );
}

function known(
  ruleId: string,
  title: string,
  description: string,
  socialTerm: AffinalSocialTerm,
  reducedPath: KPath,
  explanation: string,
  aliases?: string[],
): AffinalProjection {
  return {
    priority: 965,
    status: "known",
    ruleId,
    title,
    description,
    aliases,
    socialTerm,
    socialDescription: SOCIAL_DESCRIPTIONS[socialTerm],
    reducedPath,
    derivation: [`${ruleId}: ${explanation}`],
  };
}

function ambiguous(
  ruleId: string,
  title: string,
  description: string,
  socialTerm: AffinalSocialTerm,
  reducedPath: KPath,
  explanation: string,
  possibilities: string[],
): AffinalProjection {
  return {
    priority: 965,
    status: "ambiguous",
    ruleId,
    title,
    description,
    socialTerm,
    socialDescription: SOCIAL_DESCRIPTIONS[socialTerm],
    possibilities,
    reducedPath,
    derivation: [`${ruleId}: ${explanation}`],
  };
}

/**
 * Projects a single marriage boundary over reduced classificatory kin.
 *
 * The projector does not enumerate complete K-Paths. It identifies the
 * alliance direction, reduces the consanguine segment on the other side of
 * the marriage, and uses lineage membership, sex, and generation to choose a
 * principal term and its social protocol.
 */
export class AffinalProjector {
  constructor(
    private readonly graph: FamilyTreeGraph,
    private readonly reducer: PathReducer,
  ) {}

  project(
    traversal: TraversalResult,
    context: Context,
    sourceResolution?: KinshipResolution,
  ): AffinalProjection | null {
    const rawPath = traversal.rawPath;
    const marriageIndexes = rawPath.flatMap((step, index) =>
      step === "H" || step === "W" ? [index] : [],
    );

    const siblingSpouseComposition = this.projectSiblingSpouseComposition(
      traversal,
      context,
    );
    if (siblingSpouseComposition) return siblingSpouseComposition;

    if (marriageIndexes.length === 1 && rawPath.length === 1) {
      return rawPath[0] === "H"
        ? known(
            "AFFINAL_SPOUSE_HUSBAND",
            "Murume",
            "Your husband.",
            "Vakaroorana",
            ["H"],
            "A direct H edge establishes the reciprocal marriage relationship.",
          )
        : known(
            "AFFINAL_SPOUSE_WIFE",
            "Mukadzi",
            "Your wife.",
            "Vakaroorana",
            ["W"],
            "A direct W edge establishes the reciprocal marriage relationship.",
          );
    }

    const childAlliance = this.projectChildAlliance(traversal, context);
    if (childAlliance) return childAlliance;

    const resolvedClassProjection = sourceResolution
      ? this.projectResolvedRelativeSpouse(traversal, context, sourceResolution)
      : null;
    if (resolvedClassProjection) return resolvedClassProjection;

    // Other multiple-marriage paths can express distinct alliances. They need
    // their own composition laws rather than an accidental inference.
    if (marriageIndexes.length !== 1) return null;

    if (marriageIndexes[0] === 0) {
      return this.projectSpouseLineage(traversal, context);
    }

    if (marriageIndexes[0] === rawPath.length - 1) {
      return this.projectRelativeSpouse(traversal, context);
    }

    return null;
  }

  /**
   * Project a terminal spouse from the source relative's already-resolved kin
   * class. This composes fundamental categories instead of enumerating the
   * genealogical paths by which those categories were reached.
   */
  private projectResolvedRelativeSpouse(
    traversal: TraversalResult,
    context: Context,
    source: KinshipResolution,
  ): AffinalProjection | null {
    const marriageStep = traversal.rawPath.at(-1);
    if (marriageStep !== "H" && marriageStep !== "W") return null;

    const reducedPath: KPath = [...traversal.canonicalPath];
    const sourceRule = source.ruleId
      ? ` The source class was resolved by ${source.ruleId}.`
      : "";

    if (source.title === "Mwana") {
      return marriageStep === "W"
        ? known(
            "AFFINAL_MWANA_WIFE",
            "Muroora",
            "The wife of your classificatory child.",
            "Vanyarikani",
            reducedPath,
            `Mwana projects a female spouse to Muroora.${sourceRule}`,
          )
        : known(
            "AFFINAL_MWANA_HUSBAND",
            "Mukuwasha",
            "The husband of your classificatory child.",
            "Vanyarikani",
            reducedPath,
            `Mwana projects a male spouse to Mukuwasha.${sourceRule}`,
          );
    }

    const sameSexSiblingClass =
      source.title === "Mukoma" ||
      source.title === "Munin'ina" ||
      source.title === "Mukoma / Munin'ina";
    if (sameSexSiblingClass) {
      const older = source.title === "Mukoma";
      const younger = source.title === "Munin'ina";
      const femaleSpouse = context.targetSex === "F";

      if (!older && !younger) {
        return ambiguous(
          "AFFINAL_SAME_SEX_SIBLINGS_SPOUSE_AGE_REQUIRED",
          femaleSpouse ? "Maiguru / Mainini" : "Bamkuru / Bamnini",
          "The spouse of your same-sex sibling-equivalent; seniority determines the exact title.",
          femaleSpouse ? "Vanyarikani" : "Vasekedzani",
          reducedPath,
          `The source sibling class is age-ambiguous.${sourceRule}`,
          femaleSpouse ? ["Maiguru", "Mainini"] : ["Bamkuru", "Bamnini"],
        );
      }

      if (femaleSpouse) {
        return known(
          older ? "AFFINAL_MUKOMA_WIFE" : "AFFINAL_MUNININA_WIFE",
          older ? "Maiguru" : "Mainini",
          `The wife of your ${older ? "older" : "younger"} same-sex sibling-equivalent.`,
          "Vanyarikani",
          reducedPath,
          `A same-sex sibling's wife inherits that sibling's seniority class.${sourceRule}`,
          ["Muramu"],
        );
      }

      return known(
        older ? "AFFINAL_MUKOMA_HUSBAND" : "AFFINAL_MUNININA_HUSBAND",
        older ? "Bamkuru" : "Bamnini",
        `The husband of your ${older ? "older" : "younger"} same-sex sibling-equivalent.`,
        "Vasekedzani",
        reducedPath,
        `A same-sex sibling's husband inherits that sibling's seniority class.${sourceRule}`,
        older ? ["Babamukuru"] : ["Babamunini"],
      );
    }

    if (source.title === "Muzukuru") {
      return known(
        "AFFINAL_MUZUKURU_SPOUSE",
        "Muzukuru",
        "The spouse of your Muzukuru.",
        "Vasekedzani",
        reducedPath,
        `The Muzukuru class is preserved across the terminal marriage.${sourceRule}`,
      );
    }

    if (source.title === "Sekuru") {
      return known(
        "AFFINAL_SEKURU_SPOUSE",
        "Mbuya",
        "The spouse of your Sekuru.",
        "Vasekedzani",
        reducedPath,
        `Sekuru projects reciprocally to Mbuya across marriage.${sourceRule}`,
        ["Ambuya"],
      );
    }

    if (source.title === "Mbuya" || source.title === "Ambuya") {
      return known(
        "AFFINAL_MBUYA_SPOUSE",
        "Sekuru",
        "The spouse of your Mbuya.",
        "Vasekedzani",
        reducedPath,
        `Mbuya projects reciprocally to Sekuru across marriage.${sourceRule}`,
      );
    }

    if (source.title === "Tete" && context.targetSex === "M") {
      return known(
        "AFFINAL_TETE_HUSBAND",
        "Bamkuru",
        "The husband of your Tete.",
        "Vanyarikani",
        reducedPath,
        `Tete projects her husband to Bamkuru.${sourceRule}`,
        ["Babamukuru"],
      );
    }

    if (source.title === "Hanzvadzi") {
      if (context.egoSex === "F" && marriageStep === "W") {
        return known(
          "AFFINAL_FEMALE_EGO_BROTHERS_WIFE",
          "Muroora",
          "The wife of your brother; Muroora by clan alignment and Maiguru as an alternative kinship title.",
          "Vanyarikani",
          reducedPath,
          `A female ego's brother's wife enters the family as Muroora and may also be addressed as Maiguru.${sourceRule}`,
          ["Maiguru"],
        );
      }

      return context.targetSex === "M"
        ? known(
            "AFFINAL_HANZVADZI_MALE_SPOUSE",
            "Tsano",
            "The male spouse of your Hanzvadzi.",
            "Vanyarikani",
            reducedPath,
            `A male spouse of Hanzvadzi projects to Tsano.${sourceRule}`,
          )
        : known(
            "AFFINAL_HANZVADZI_FEMALE_SPOUSE",
            "Maiguru",
            "The female spouse of your Hanzvadzi.",
            "Vanyarikani",
            reducedPath,
            `A female spouse of Hanzvadzi projects to Maiguru.${sourceRule}`,
          );
    }

    return null;
  }

  /**
   * A wife enters the seniority class established by her husband's position
   * among his brothers. This composes two marriage boundaries without using
   * either woman's age: H.B(older).W -> Maiguru and
   * H.B(younger).W -> Mainini.
   */
  private projectSiblingSpouseComposition(
    traversal: TraversalResult,
    context: Context,
  ): AffinalProjection | null {
    const husbandsBrothersWife =
      context.egoSex === "F" &&
      context.targetSex === "F" &&
      exact(traversal.canonicalPath, ["H", "B", "W"]);
    const wifesSistersHusband =
      context.egoSex === "M" &&
      context.targetSex === "M" &&
      exact(traversal.canonicalPath, ["W", "Z", "H"]);
    if (!husbandsBrothersWife && !wifesSistersHusband) return null;

    const reducedPath: KPath = [...traversal.canonicalPath];

    if (context.structuralRelativeAge === "older") {
      return husbandsBrothersWife
        ? known(
            "AFFINAL_HUSBANDS_OLDER_BROTHERS_WIFE",
            "Maiguru",
            "The wife of your husband's older brother.",
            "Vanyarikani",
            reducedPath,
            "A brother's wife inherits her husband's seniority class among the brothers.",
          )
        : known(
            "AFFINAL_WIFES_OLDER_SISTERS_HUSBAND",
            "Bamkuru",
            "The husband of your wife's older sister.",
            "Vasekedzani",
            reducedPath,
            "A sister's husband inherits his wife's seniority class among the sisters.",
            ["Babamukuru"],
          );
    }

    if (context.structuralRelativeAge === "younger") {
      return husbandsBrothersWife
        ? known(
            "AFFINAL_HUSBANDS_YOUNGER_BROTHERS_WIFE",
            "Mainini",
            "The wife of your husband's younger brother.",
            "Vanyarikani",
            reducedPath,
            "A brother's wife inherits her husband's seniority class among the brothers.",
          )
        : known(
            "AFFINAL_WIFES_YOUNGER_SISTERS_HUSBAND",
            "Bamnini",
            "The husband of your wife's younger sister.",
            "Vasekedzani",
            reducedPath,
            "A sister's husband inherits his wife's seniority class among the sisters.",
            ["Babamunini"],
          );
    }

    return husbandsBrothersWife
      ? ambiguous(
          "AFFINAL_HUSBANDS_BROTHERS_WIFE_AGE_REQUIRED",
          "Maiguru / Mainini",
          "Your husband's brother's wife; her husband's seniority determines the exact title.",
          "Vanyarikani",
          reducedPath,
          "The brothers' relative seniority is required because their wives inherit that ordering.",
          ["Maiguru", "Mainini"],
        )
      : ambiguous(
          "AFFINAL_WIFES_SISTERS_HUSBAND_AGE_REQUIRED",
          "Bamkuru / Bamnini",
          "Your wife's sister's husband; his wife's seniority determines the exact title.",
          "Vasekedzani",
          reducedPath,
          "The sisters' relative seniority is required because their husbands inherit that ordering.",
          ["Bamkuru", "Bamnini"],
        );
  }

  private projectSpouseLineage(
    traversal: TraversalResult,
    context: Context,
  ): AffinalProjection {
    const spouseStep = traversal.rawPath[0];
    const spouseId = traversal.personIds[1];
    const suffix = traversal.rawPath.slice(1);
    const spouseSex: Sex = spouseStep === "W" ? "F" : "M";
    const normalized = this.normalize(suffix, context, spouseSex);
    const reducedPath: KPath = [spouseStep, ...normalized];
    const generation = FamilyTreeGraph.generationDistance(suffix);
    const sameLineage = this.graph.sharesPatrilineage(
      spouseId,
      context.targetId,
    );

    if (spouseStep === "W") {
      if (this.isMotherEquivalent(normalized, context.targetSex)) {
        return known(
          "AFFINAL_WIFE_MOTHER_CLASS",
          "Ambuya",
          "Your wife's mother or classificatory mother.",
          "Vanyarikani",
          reducedPath,
          "The wife's mother-class belongs to the respected wife-giving side.",
          ["Mbuyawasha", "Ambuyawasha"],
        );
      }

      if (this.isFatherEquivalent(normalized, context.targetSex)) {
        return known(
          "AFFINAL_WIFE_FATHER_CLASS",
          "Tezvara",
          "Your wife's father or classificatory father.",
          "Vanyarikani",
          reducedPath,
          "The wife's father-class is the senior male wife-giver category.",
          ["Baba"],
        );
      }

      if (exact(normalized, ["Z"])) {
        if (context.structuralRelativeAge === "older") {
          return known(
            "AFFINAL_WIFES_OLDER_SISTER",
            "Maiguru",
            "Your wife's older sister.",
            "Vasekedzani",
            reducedPath,
            "A wife's same-sex sibling retains her seniority-specific sister class across the marriage boundary.",
            ["Muramu"],
          );
        }

        if (context.structuralRelativeAge === "younger") {
          return known(
            "AFFINAL_WIFES_YOUNGER_SISTER",
            "Mainini",
            "Your wife's younger sister.",
            "Vasekedzani",
            reducedPath,
            "A wife's same-sex sibling retains her seniority-specific sister class across the marriage boundary.",
            ["Muramu"],
          );
        }

        return known(
          "AFFINAL_WIFES_SISTER",
          "Muramu",
          "Your wife's sister; seniority distinguishes Maiguru from Mainini.",
          "Vasekedzani",
          reducedPath,
          "Muramu remains the valid generic joking category when the sisters' relative seniority is unknown.",
          ["Maiguru", "Mainini"],
        );
      }

      const directChildClass =
        generation === -1 &&
        normalized.length === 1 &&
        (normalized[0] === "S" || normalized[0] === "D");
      if (directChildClass) {
        return known(
          "AFFINAL_WIFE_CLASSIFICATORY_CHILD",
          "Mwana",
          "Your wife's child or the child of her same-sex sibling-equivalent.",
          "Vanyarikani",
          reducedPath,
          "After wife-giving alignment, the wife's Z.(S|D) branch reduces algebraically to her direct child class.",
        );
      }

      const wifesBrothersChildClass =
        generation === -1 &&
        normalized.length === 2 &&
        normalized[0] === "B" &&
        (normalized[1] === "S" || normalized[1] === "D");
      if (wifesBrothersChildClass) {
        return context.targetSex === "M"
          ? known(
              "AFFINAL_WIFES_BROTHERS_SON",
              "Sekuru",
              "Your wife's brother's son or male child-equivalent.",
              "Vasekedzani",
              reducedPath,
              "The wife's brother's male child class is elevated to Sekuru on the wife-giving axis.",
            )
          : known(
              "AFFINAL_WIFES_BROTHERS_DAUGHTER",
              "Mainini",
              "Your wife's brother's daughter or female child-equivalent.",
              "Vasekedzani",
              reducedPath,
              "The wife's brother's female child class resolves to Mainini on the wife-giving axis.",
              ["Muramu"],
            );
      }

      if (sameLineage && context.targetSex === "M") {
        return known(
          "AFFINAL_WIFE_GIVING_MALE_LINEAGE",
          "Tezvara",
          "A male member of your wife's classificatory patrilineage.",
          "Vanyarikani",
          reducedPath,
          "Male members of the wife-giving lineage project to Tezvara without enumerating their paths.",
          generation === 0 ? ["Tsano"] : ["Baba"],
        );
      }

      if (
        (sameLineage && context.targetSex === "F") ||
        exact(normalized, ["Z"]) ||
        exact(normalized, ["F", "Z"])
      ) {
        return known(
          "AFFINAL_WIFE_GIVING_FEMALE_LINEAGE",
          "Muramu",
          "A female member of your wife's classificatory lineage.",
          "Vasekedzani",
          reducedPath,
          "Women of the wife-giving lineage participate in the reciprocal Muramu relationship.",
        );
      }

      if (exact(normalized, ["B"])) {
        return known(
          "AFFINAL_WIFES_BROTHER",
          "Tsano / Tezvara",
          "Your wife's brother.",
          "Vanyarikani",
          reducedPath,
          "A wife's brother is a same-generation male of the wife-giving side.",
          ["Tsano", "Tezvara"],
        );
      }

      return known(
        "AFFINAL_WIFE_SIDE_RELATIVE",
        "Hama yaTezvara",
        "A relative on your wife's wife-giving side.",
        "Vanyarikani",
        reducedPath,
        "The relationship remains within the wife-giving alliance when no narrower class is established.",
      );
    }

    const directChildClass =
      generation === -1 &&
      normalized.length === 1 &&
      (normalized[0] === "S" || normalized[0] === "D");
    if (directChildClass) {
      return known(
        "AFFINAL_HUSBAND_CLASSIFICATORY_CHILD",
        "Mwana",
        "Your husband's child or the child of his same-sex sibling-equivalent.",
        "Vanyarikani",
        reducedPath,
        "After inward clan alignment, the husband's B.(S|D) branch reduces algebraically to his direct child class.",
      );
    }

    const sistersChildClass =
      generation === -1 &&
      normalized.length === 2 &&
      normalized[0] === "Z" &&
      (normalized[1] === "S" || normalized[1] === "D");
    if (sistersChildClass) {
      return known(
        "AFFINAL_HUSBANDS_SISTERS_CHILD",
        "Muzukuru",
        "The child of your husband's sister or opposite-sex sibling-equivalent.",
        "Vasekedzani",
        reducedPath,
        "After inward clan alignment, the husband's opposite-sex sibling's child remains in the Muzukuru class.",
      );
    }

    if (generation >= 2) {
      return context.targetSex === "M"
        ? known(
            "AFFINAL_HUSBAND_GRANDFATHER_CLASS",
            "Sekuru",
            "Your husband's grandfather or grandfather-equivalent.",
            "Vasekedzani",
            reducedPath,
            "A wife enters her husband's grandparent categories without a generic in-law label.",
          )
        : known(
            "AFFINAL_HUSBAND_GRANDMOTHER_CLASS",
            "Ambuya",
            "Your husband's grandmother or grandmother-equivalent.",
            "Vasekedzani",
            reducedPath,
            "A wife enters her husband's grandparent categories without a generic in-law label.",
          );
    }

    if (this.isFatherEquivalent(normalized, context.targetSex)) {
      return known(
        "AFFINAL_HUSBAND_FATHER_CLASS",
        "Tezvara",
        "Your husband's father or classificatory father.",
        "Vanyarikani",
        reducedPath,
        "The husband's father-class is Tezvara to the incoming wife.",
        ["Baba"],
      );
    }

    if (this.isMotherEquivalent(normalized, context.targetSex)) {
      return known(
        "AFFINAL_HUSBAND_MOTHER_CLASS",
        "Vamwene",
        "Your husband's mother or classificatory mother.",
        "Vanyarikani",
        reducedPath,
        "The husband's mother-class is Vamwene to the incoming wife.",
        ["Amai"],
      );
    }

    if (exact(normalized, ["B"])) {
      if (context.structuralRelativeAge === "older") {
        return known(
          "AFFINAL_HUSBANDS_OLDER_BROTHER",
          "Bamkuru",
          "Your husband's older brother or older brother-equivalent.",
          "Vasekedzani",
          reducedPath,
          "A husband's brother retains his seniority-specific father-brother class across the marriage boundary.",
          ["Babamukuru", "Muramu"],
        );
      }

      if (context.structuralRelativeAge === "younger") {
        return known(
          "AFFINAL_HUSBANDS_YOUNGER_BROTHER",
          "Bamnini",
          "Your husband's younger brother or younger brother-equivalent.",
          "Vasekedzani",
          reducedPath,
          "A husband's brother retains his seniority-specific father-brother class across the marriage boundary.",
          ["Babamunini", "Muramu"],
        );
      }

      return known(
        "AFFINAL_HUSBANDS_BROTHER",
        "Muramu",
        "Your husband's brother or brother-equivalent; seniority distinguishes Bamkuru from Bamnini.",
        "Vasekedzani",
        reducedPath,
        "Muramu remains the generic joking category when the brothers' relative seniority is unknown.",
        ["Bamkuru", "Bamnini", "Babamukuru", "Babamunini"],
      );
    }

    if (exact(normalized, ["Z"])) {
      return known(
        "AFFINAL_HUSBANDS_SISTER",
        "Tete",
        "Your husband's sister or sister-equivalent.",
        "Vanyarikani",
        reducedPath,
        "A husband's sister enters the incoming wife's paternal-aunt class as Tete.",
      );
    }

    if (exact(normalized, ["F", "Z"])) {
      return known(
        "AFFINAL_HUSBANDS_PATERNAL_AUNT",
        "Vamwene",
        "Your husband's paternal aunt or paternal-aunt equivalent.",
        "Vanyarikani",
        reducedPath,
        "The husband's paternal-aunt branch retains its established senior female in-law category.",
      );
    }

    if (sameLineage && generation >= 0) {
      if (context.targetSex === "M") {
        return known(
          generation === 0
            ? "AFFINAL_HUSBAND_MALE_PEER_LINEAGE"
            : "AFFINAL_HUSBAND_MALE_PARENT_LINEAGE",
          generation === 0 ? "Muramu" : "Tezvara",
          "A male member of your husband's classificatory patrilineage.",
          generation === 0 ? "Vasekedzani" : "Vanyarikani",
          reducedPath,
          "Sex and generation project a husband's male lineage member to a brother- or father-in-law class.",
        );
      }

      return known(
        "AFFINAL_HUSBAND_FEMALE_LINEAGE",
        "Vamwene",
        "A female member of your husband's classificatory patrilineage.",
        "Vanyarikani",
        reducedPath,
        "Women of the husband's lineage project to the Vamwene class.",
      );
    }

    return known(
      "AFFINAL_HUSBAND_SIDE_RELATIVE",
      "Hama dzeVamwene",
      "A relative on your husband's wife-receiving side.",
      "Vanyarikani",
      reducedPath,
      "The relationship remains within the husband's alliance when no narrower class is established.",
    );
  }

  private projectRelativeSpouse(
    traversal: TraversalResult,
    context: Context,
  ): AffinalProjection | null {
    const marriageStep = traversal.rawPath.at(-1);
    if (marriageStep !== "H" && marriageStep !== "W") return null;

    const sourceId = traversal.personIds.at(-2);
    if (!sourceId) return null;

    const stem = traversal.rawPath.slice(0, -1);
    const normalized = this.normalize(stem, context, context.egoSex);
    const sourceAligned =
      this.graph.sharesPatrilineage(context.egoId, sourceId) ||
      exact(normalized, ["S"]) ||
      exact(normalized, ["D"]) ||
      exact(normalized, ["B"]) ||
      exact(normalized, ["Z"]);

    if (!sourceAligned) return null;

    const reducedPath: KPath = [...normalized, marriageStep];
    return marriageStep === "W"
      ? known(
          "AFFINAL_WOMAN_MARRYING_IN",
          "Muroora",
          "A woman marrying a man of your classificatory family line.",
          "Vanyarikani",
          reducedPath,
          "A W edge from a clan-aligned man projects the incoming woman to Muroora.",
        )
      : known(
          "AFFINAL_MAN_MARRYING_OUT",
          "Mukuwasha",
          "A man marrying a woman of your classificatory family line.",
          "Vanyarikani",
          reducedPath,
          "An H edge from a clan-aligned woman projects the incoming man to Mukuwasha.",
        );
  }

  private projectChildAlliance(
    traversal: TraversalResult,
    context: Context,
  ): AffinalProjection | null {
    const [childStep, spouseStep] = traversal.rawPath;
    const outgoing = childStep === "D" && spouseStep === "H";
    const incoming = childStep === "S" && spouseStep === "W";
    if (!outgoing && !incoming) return null;

    const suffix = traversal.rawPath.slice(2);
    const spouseId = traversal.personIds[2];
    const normalized = this.normalize(suffix, context, outgoing ? "M" : "F");
    const reducedPath: KPath = [childStep, spouseStep, ...normalized];
    const generation = FamilyTreeGraph.generationDistance(suffix);

    if (suffix.length === 0) {
      return outgoing
        ? known(
            "AFFINAL_SON_IN_LAW",
            "Mukuwasha",
            "Your daughter's husband.",
            "Vanyarikani",
            reducedPath,
            "A man married to a daughter of ego's family is Mukuwasha.",
          )
        : known(
            "AFFINAL_DAUGHTER_IN_LAW",
            "Muroora",
            "Your son's wife.",
            "Vanyarikani",
            reducedPath,
            "A woman married to a son of ego's family is Muroora.",
          );
    }

    if (
      generation === -1 &&
      (exact(normalized, ["S"]) || exact(normalized, ["D"]))
    ) {
      return known(
        "AFFINAL_CHILD_IN_LAW_CHILD",
        "Muzukuru",
        "A child of your son-in-law or daughter-in-law; your classificatory grandchild.",
        "Vasekedzani",
        reducedPath,
        "A child one generation below a child's spouse enters ego's grandchild category.",
      );
    }

    if (this.isParentEquivalent(normalized, context.targetSex)) {
      return known(
        "AFFINAL_CO_PARENT_IN_LAW",
        "Mukurungai",
        "A parent or classificatory parent of your child's spouse.",
        "Vanyarikani",
        reducedPath,
        "The parents across a child's marriage form the reciprocal Mukurungai relationship.",
      );
    }

    if (exact(normalized, ["B"]) && context.targetSex === "M") {
      return outgoing
        ? known(
            "AFFINAL_SON_IN_LAW_BROTHER_CLASS",
            "Mukuwasha",
            "Your son-in-law's brother or male sibling-equivalent.",
            "Vanyarikani",
            reducedPath,
            "The male sibling class of Mukuwasha remains in the Mukuwasha category.",
          )
        : known(
            "AFFINAL_DAUGHTER_IN_LAW_BROTHER_CLASS",
            "Tezvara",
            "Your daughter-in-law's brother or male sibling-equivalent.",
            "Vanyarikani",
            reducedPath,
            "A male sibling-equivalent on the Muroora wife-giving side projects to Tezvara.",
            ["Tsano"],
          );
    }

    if (exact(normalized, ["Z"]) && context.targetSex === "F") {
      return incoming
        ? known(
            "AFFINAL_DAUGHTER_IN_LAW_SISTER_CLASS",
            "Muroora",
            "Your daughter-in-law's sister or female sibling-equivalent.",
            "Vanyarikani",
            reducedPath,
            "The female sibling class of Muroora remains in the Muroora category.",
          )
        : known(
            "AFFINAL_SON_IN_LAW_SISTER_CLASS",
            "Hama yeVakuwasha",
            "Your son-in-law's sister or female sibling-equivalent.",
            "Vanyarikani",
            reducedPath,
            "The female sibling class remains a named relative of the Mukuwasha side.",
          );
    }

    const sameLineage = this.graph.sharesPatrilineage(
      spouseId,
      context.targetId,
    );

    if (outgoing && sameLineage && context.targetSex === "M") {
      return known(
        "AFFINAL_SON_IN_LAW_MALE_LINEAGE",
        "Mukuwasha",
        "A male member of your son-in-law's classificatory patrilineage.",
        "Vanyarikani",
        reducedPath,
        "The Mukuwasha category extends through the male wife-receiving line.",
      );
    }

    if (incoming && sameLineage && context.targetSex === "F") {
      return known(
        "AFFINAL_DAUGHTER_IN_LAW_FEMALE_LINEAGE",
        "Muroora",
        "A female member of your daughter-in-law's classificatory lineage.",
        "Vanyarikani",
        reducedPath,
        "The Muroora category extends through the female wife-giving line.",
      );
    }

    if (incoming && sameLineage && context.targetSex === "M") {
      return known(
        "AFFINAL_DAUGHTER_IN_LAW_MALE_LINEAGE",
        "Tezvara",
        "A male member of your daughter-in-law's classificatory patrilineage.",
        "Vanyarikani",
        reducedPath,
        "Male members of the Muroora wife-giving lineage project to Tezvara after parent-equivalents are resolved.",
        generation === 0 ? ["Tsano"] : undefined,
      );
    }

    return outgoing
      ? known(
          "AFFINAL_SON_IN_LAW_SIDE_RELATIVE",
          "Hama yeVakuwasha",
          "A relative on your son-in-law's side.",
          "Vanyarikani",
          reducedPath,
          "The relative belongs to the wife-receiving alliance but no narrower title is established.",
        )
      : known(
          "AFFINAL_DAUGHTER_IN_LAW_SIDE_RELATIVE",
          "Hama dzeMuroora",
          "A relative on your daughter-in-law's side.",
          "Vanyarikani",
          reducedPath,
          "The relative belongs to the wife-giving alliance but no narrower title is established.",
        );
  }

  private normalize(
    rawPath: readonly KStep[],
    context: Context,
    localEgoSex: Sex,
  ): KPath {
    const canonical = FamilyTreeGraph.canonicalize(rawPath);
    return this.reducer.reduce(canonical, {
      ...context,
      egoSex: localEgoSex,
      generationDistance: FamilyTreeGraph.generationDistance(rawPath),
    }).reducedPath;
  }

  private isParentEquivalent(path: readonly KStep[], targetSex: Sex) {
    return (
      this.isFatherEquivalent(path, targetSex) ||
      this.isMotherEquivalent(path, targetSex)
    );
  }

  private isFatherEquivalent(path: readonly KStep[], targetSex: Sex) {
    return targetSex === "M" && (exact(path, ["F"]) || exact(path, ["F", "B"]));
  }

  private isMotherEquivalent(path: readonly KStep[], targetSex: Sex) {
    return targetSex === "F" && (exact(path, ["M"]) || exact(path, ["M", "Z"]));
  }
}
