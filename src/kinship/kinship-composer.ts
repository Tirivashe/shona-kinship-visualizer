import type {
  Context,
  KinshipResolution,
  KPath,
  TraversalResult,
} from "./model";

export type ComposedKinshipResolution = Omit<
  KinshipResolution,
  "traversal"
> & {
  priority: number;
};

interface CompositionCallbacks {
  resolveBetween(egoId: string, targetId: string): KinshipResolution;
  projectSemanticContinuation(
    splitIndex: number,
    prefix: KinshipResolution,
  ): ComposedKinshipResolution | null;
  projectMwanaAlliance(
    marriageIndex: number,
    prefix: KinshipResolution,
  ): ComposedKinshipResolution | null;
}

/**
 * Composes already-resolved semantic classes across internal marriage edges.
 *
 * The established resolver remains the authority for fundamental terms. This
 * layer only combines those terms, so a rule applies to every genealogical
 * path that reaches the same class rather than to one encoded full K-Path.
 */
export class KinshipComposer {
  compose(
    traversal: TraversalResult,
    context: Context,
    callbacks: CompositionCallbacks,
  ): ComposedKinshipResolution | null {
    for (
      let marriageIndex = 1;
      marriageIndex < traversal.rawPath.length - 1;
      marriageIndex += 1
    ) {
      const marriageStep = traversal.rawPath[marriageIndex];
      if (marriageStep !== "H" && marriageStep !== "W") continue;

      const sourceId = traversal.personIds[marriageIndex];
      if (!sourceId) continue;

      const prefix = callbacks.resolveBetween(context.egoId, sourceId);

      // Any path which has already reached the classificatory-child class can
      // reuse the ordinary S.W / D.H child-alliance algebra from this point.
      if (
        prefix.status === "known" &&
        prefix.kinClass === "CLASSIFICATORY_CHILD"
      ) {
        const projected = callbacks.projectMwanaAlliance(
          marriageIndex,
          prefix,
        );
        if (projected) return projected;
      }

      // Same-sex siblings are classificatory equivalents for the affinal
      // family beyond either sibling's spouse. Resolve that shorter alliance
      // from the sibling's perspective, then inherit its semantic class.
      if (prefix.kinClass !== "SAME_SEX_SIBLING") continue;

      const suffix = callbacks.resolveBetween(sourceId, context.targetId);
      if (
        (suffix.status !== "known" && suffix.status !== "ambiguous") ||
        !suffix.socialTerm ||
        suffix.socialTerm === "Vakaroorana"
      ) {
        continue;
      }

      return {
        priority: 955,
        status: suffix.status,
        ruleId: "COMPOSED_SAME_SEX_SIBLING_AFFINAL_INHERITANCE",
        title: suffix.title,
        description: `A same-sex sibling shares the established affinal relationship beyond their sibling's spouse. ${suffix.description}`,
        kinClass: suffix.kinClass,
        seniority: suffix.seniority,
        specificity: suffix.specificity,
        provenance: suffix.provenance,
        aliases: suffix.aliases,
        socialTerm: suffix.socialTerm,
        socialDescription: suffix.socialDescription,
        possibilities: suffix.possibilities,
        reducedPath: [...traversal.canonicalPath],
        derivation: [
          ...(prefix.derivation ?? []),
          ...(suffix.derivation ?? []),
          "COMPOSED_SAME_SEX_SIBLING_AFFINAL_INHERITANCE: a same-sex sibling-equivalent inherits the shorter affinal classification beyond the internal marriage boundary.",
        ],
      };
    }

    // Exact alliance laws above retain precedence. If none applies, prefer the
    // longest reducible semantic prefix. Replacing it with one fundamental
    // edge strictly shortens the path, so recursive evaluation terminates.
    for (
      let splitIndex = traversal.rawPath.length - 1;
      splitIndex >= 1;
      splitIndex -= 1
    ) {
      const sourceId = traversal.personIds[splitIndex];
      if (!sourceId) continue;

      const prefix = callbacks.resolveBetween(context.egoId, sourceId);
      if (prefix.status !== "known" && prefix.status !== "ambiguous") continue;

      const projected = callbacks.projectSemanticContinuation(
        splitIndex,
        prefix,
      );
      if (projected) return projected;
    }

    return null;
  }

  /** A traversed path is related even when no narrower cultural class wins. */
  broad(
    traversal: TraversalResult,
    reducedPath: KPath,
    derivation: readonly string[],
  ): ComposedKinshipResolution {
    return {
      priority: 1,
      status: "broad",
      specificity: "broad",
      ruleId: "COMPOSED_REACHABLE_RELATIVE",
      title: "Hama",
      description:
        "A genealogical or social kinship path connects you, but the available context does not establish a narrower Shona title.",
      reducedPath,
      derivation: [
        ...derivation,
        `COMPOSED_REACHABLE_RELATIVE: BFS established the connected path ${traversal.canonicalPath.join(".") || "SELF"}; the total algebra therefore retains the broad Hama class instead of treating the person as unrelated.`,
      ],
    };
  }
}
