import type { Context, KPath, KStep, ReductionResult } from "./model";

interface AlgebraicRewrite {
  id: string;
  explanation: string;
  match(path: readonly KStep[], index: number, context: Context): number;
  replacement(path: readonly KStep[], index: number, context: Context): KPath;
}

const rewrites: AlgebraicRewrite[] = [
  {
    id: "P_SAME_SEX_SIBLING_CHILD",
    explanation:
      "A same-sex sibling's child belongs to ego's classificatory-child category.",
    match: (path, index, context) => {
      if (index !== 0 || path.length < 2) return 0;
      const sameSexSibling =
        (context.egoSex === "M" && path[0] === "B") ||
        (context.egoSex === "F" && path[0] === "Z");
      const child = path[1] === "S" || path[1] === "D";
      return sameSexSibling && child ? 2 : 0;
    },
    replacement: (path) => (path[1] === "S" ? ["S"] : ["D"]),
  },
  {
    id: "P_PARALLEL_FATHER",
    explanation:
      "Patrilineal parallel kin: a father's brother is a classificatory father (intermediate step only).",
    match: (path, index) =>
      // FIX: index + 2 ensures we don't collapse the terminal target
      index + 2 < path.length && path[index] === "F" && path[index + 1] === "B"
        ? 2
        : 0,
    replacement: () => ["F"],
  },
  {
    id: "P_PARALLEL_MOTHER",
    explanation:
      "Parallel maternal kin: a mother's sister is a classificatory mother (intermediate step only).",
    match: (path, index) =>
      // FIX: index + 2 ensures we don't collapse the terminal target
      index + 2 < path.length && path[index] === "M" && path[index + 1] === "Z"
        ? 2
        : 0,
    replacement: () => ["M"],
  },
  {
    id: "M_MATRILATERAL_UNCLE_DAUGHTER_ELEVATION",
    explanation:
      "A maternal uncle's daughter is structurally a classificatory mother (intermediate step only).",
    match: (path, index) =>
      index + 3 < path.length &&
      path[index] === "M" &&
      path[index + 1] === "B" &&
      path[index + 2] === "D"
        ? 3
        : 0,
    replacement: () => ["M"],
  },
  {
    id: "P_CLASSIFICATORY_PARENT_CHILD",
    explanation: "A classificatory parent's child reduces to a sibling-equivalent.",
    match: (path, index) =>
      index + 1 < path.length &&
      (path[index] === "F" || path[index] === "M") &&
      (path[index + 1] === "S" || path[index + 1] === "D")
        ? 2
        : 0,
    replacement: (path, index) => (path[index + 1] === "S" ? ["B"] : ["Z"]),
  },
  {
    id: "A_TO_M_GENERATIONAL_TRANSFORMATION",
    explanation:
      "Entering a sibling-equivalent's maternal branch promotes that branch to ego's matrilateral axis.",
    match: (path, index) =>
      index + 1 < path.length &&
      (path[index] === "B" || path[index] === "Z") &&
      path[index + 1] === "M"
        ? 2
        : 0,
    replacement: () => ["M"],
  },
  {
    id: "P_SIBLING_PATERNAL_ALIGNMENT",
    explanation:
      "Entering a sibling-equivalent's paternal branch promotes that branch to ego's patrilineal axis.",
    match: (path, index) =>
      index + 1 < path.length &&
      (path[index] === "B" || path[index] === "Z") &&
      path[index + 1] === "F"
        ? 2
        : 0,
    replacement: () => ["F"],
  },
];

/** Fixed-point algebraic K-Path reducer. */
export class PathReducer {
  reduce(canonicalPath: readonly KStep[], context: Context): ReductionResult {
    let path: KPath = [...canonicalPath];
    const derivation: string[] = [];
    const safetyLimit = Math.max(16, path.length * 6);

    for (let pass = 0; pass < safetyLimit; pass += 1) {
      let changed = false;

      for (let index = 0; index < path.length; index += 1) {
        for (const rewrite of rewrites) {
          const consumed = rewrite.match(path, index, context);
          if (consumed === 0) continue;

          const replacement = rewrite.replacement(path, index, context);
          if (replacement.length >= consumed) {
            throw new Error(
              `Non-terminating K-Path rewrite ${rewrite.id}: replacement must be shorter than its match.`,
            );
          }
          path = [
            ...path.slice(0, index),
            ...replacement,
            ...path.slice(index + consumed),
          ];
          derivation.push(`${rewrite.id}: ${rewrite.explanation}`);
          changed = true;
          break;
        }

        if (changed) break;
      }

      if (!changed) return { reducedPath: path, derivation };
    }

    throw new Error("K-Path reduction exceeded its termination safety limit.");
  }
}
