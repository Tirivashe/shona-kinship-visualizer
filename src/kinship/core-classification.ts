import {
  CORE_KIN_RECIPROCALS,
  type Context,
  type CoreKinClass,
  type KinClass,
  type KinshipResolution,
  type KStep,
  type TraversalResult,
} from "./model";

type CoreAxis = "PATRILINEAL" | "MATRILINEAL";
type CoreRank =
  | "GRANDPARENT"
  | "FATHER"
  | "MOTHER"
  | "SIBLING"
  | "CHILD"
  | "GRANDCHILD";

function coreClass(axis: CoreAxis, rank: CoreRank): CoreKinClass | undefined {
  const value = `${axis}_${rank}` as CoreKinClass;
  return value in CORE_KIN_RECIPROCALS ? value : undefined;
}

function unique(classes: readonly CoreKinClass[]): CoreKinClass[] {
  return [...new Set(classes)];
}

/** Infer which lineage branch the selected traversal first enters. */
function traversalAxes(
  traversal: TraversalResult,
  context: Context,
): CoreAxis[] {
  const path = traversal.rawPath;
  let index = 0;
  while (path[index] === "H" || path[index] === "W") index += 1;

  const first: KStep | undefined = path[index];
  if (first === "F") return ["PATRILINEAL"];
  if (first === "M") return ["MATRILINEAL"];

  // Explicit B/Z links may stand for a shared father, shared mother, or both.
  // Preserve both classifications instead of inventing a lineage source.
  if (first === "B" || first === "Z") {
    return ["PATRILINEAL", "MATRILINEAL"];
  }

  // A direct descendant continues the male Ego's patrilineal child axis or
  // the female Ego's matrilineal child axis.
  if (first === "S" || first === "D") {
    const remainingConsanguineSteps = path
      .slice(index)
      .filter((step) => step !== "H" && step !== "W").length;
    if (remainingConsanguineSteps > 1) {
      return [first === "S" ? "PATRILINEAL" : "MATRILINEAL"];
    }
    return [context.egoSex === "M" ? "PATRILINEAL" : "MATRILINEAL"];
  }

  return [];
}

function classificationsForRole(
  resolution: Pick<KinshipResolution, "kinClass" | "ruleId">,
  traversal: TraversalResult,
  context: Context,
): CoreKinClass[] {
  const kinClass: KinClass | undefined = resolution.kinClass;
  const axes = traversalAxes(traversal, context);
  const forAxes = (rank: CoreRank) =>
    unique(
      axes.flatMap((axis) => {
        const classification = coreClass(axis, rank);
        return classification ? [classification] : [];
      }),
    );

  switch (kinClass) {
    case "CLASSIFICATORY_FATHER":
      return ["PATRILINEAL_FATHER"];
    case "CLASSIFICATORY_MOTHER":
      return ["MATRILINEAL_MOTHER"];
    case "CLASSIFICATORY_CHILD":
      return forAxes("CHILD");
    case "SAME_SEX_SIBLING":
    case "CROSS_SEX_SIBLING":
      return forAxes("SIBLING");
    case "GRANDFATHER":
    case "GRANDMOTHER":
      return forAxes("GRANDPARENT");
    case "MUZUKURU":
      if (resolution.ruleId === "OPPOSITE_SEX_SIBLING_CHILD") {
        return [
          context.egoSex === "M"
            ? "MATRILINEAL_GRANDCHILD"
            : "PATRILINEAL_GRANDCHILD",
        ];
      }
      return forAxes("GRANDCHILD");
    case "PATERNAL_AUNT":
      // Tete is situated in the Father class even though her reciprocal is
      // exceptionally Muzukuru rather than the ordinary Mwana.
      return ["PATRILINEAL_FATHER"];
    default:
      return [];
  }
}

/** Attach primary hierarchy metadata without changing the role-specific term. */
export function attachCoreClassifications<
  TResolution extends KinshipResolution,
>(
  resolution: TResolution,
  traversal: TraversalResult,
  context: Context,
): TResolution {
  if (resolution.coreClassifications?.length) return resolution;

  const coreClassifications = classificationsForRole(
    resolution,
    traversal,
    context,
  );
  return coreClassifications.length
    ? { ...resolution, coreClassifications }
    : resolution;
}

export function reciprocalCoreClassifications(
  classifications: readonly CoreKinClass[] | undefined,
): CoreKinClass[] | undefined {
  if (!classifications?.length) return undefined;
  return unique(
    classifications.map(
      (classification) => CORE_KIN_RECIPROCALS[classification],
    ),
  );
}
