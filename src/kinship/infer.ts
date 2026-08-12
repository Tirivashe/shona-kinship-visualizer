import type { PathStep, Person, RelationshipPath } from "@/types/family";

type InferredStep =
  | PathStep
  | "social_father"
  | "social_mother"
  | "older_social_father"
  | "younger_social_father"
  | "older_social_mother"
  | "younger_social_mother"
  | "social_son"
  | "social_daughter";

export interface KinshipInference {
  canonicalSteps: PathStep[];
  derivation: string[];
}

interface InferenceContext {
  ego: Person;
}

interface Rewrite {
  consumed: number;
  replacement: InferredStep[];
  explanation: string;
}

const brotherSteps = new Set<InferredStep>([
  "older_brother",
  "younger_brother",
  "brother",
]);

const sisterSteps = new Set<InferredStep>([
  "older_sister",
  "younger_sister",
  "sister",
]);

const childSteps = new Set<InferredStep>(["son", "daughter"]);

function siblingForChild(step: InferredStep): InferredStep {
  return step === "son" ? "brother" : "sister";
}

function socialChildFor(step: InferredStep): InferredStep {
  return step === "son" ? "social_son" : "social_daughter";
}

function socialFatherFor(step: InferredStep): InferredStep {
  if (step === "older_brother") return "older_social_father";
  if (step === "younger_brother") return "younger_social_father";
  return "social_father";
}

function socialMotherFor(step: InferredStep): InferredStep {
  if (step === "older_sister") return "older_social_mother";
  if (step === "younger_sister") return "younger_social_mother";
  return "social_mother";
}

function isSocialParent(step: InferredStep | undefined) {
  return Boolean(
    step &&
      [
        "social_father",
        "social_mother",
        "older_social_father",
        "younger_social_father",
        "older_social_mother",
        "younger_social_mother",
      ].includes(step),
  );
}

function isSibling(step: InferredStep | undefined) {
  return Boolean(step && (brotherSteps.has(step) || sisterSteps.has(step)));
}

function isSameSexSibling(
  step: InferredStep | undefined,
  egoSex: Person["sex"],
) {
  if (!step) return false;
  return egoSex === "male" ? brotherSteps.has(step) : sisterSteps.has(step);
}

/**
 * Match one reusable Shona social-equivalence rule at a path position.
 * Rules reduce or preserve path length, so normalization always terminates.
 */
function matchRewrite(
  steps: InferredStep[],
  index: number,
  context: InferenceContext,
): Rewrite | null {
  const first = steps[index];
  const second = steps[index + 1];

  if (
    first === "father" &&
    brotherSteps.has(second) &&
    index + 2 < steps.length
  ) {
    return {
      consumed: 2,
      replacement: [socialFatherFor(second)],
      explanation:
        second === "older_brother"
          ? "A father's older brother is Bamkuru, an older social father."
          : second === "younger_brother"
            ? "A father's younger brother is Bamnini, a younger social father."
            : "A father's brother is a social father.",
    };
  }

  if (
    first === "mother" &&
    sisterSteps.has(second) &&
    index + 2 < steps.length
  ) {
    return {
      consumed: 2,
      replacement: [socialMotherFor(second)],
      explanation:
        second === "older_sister"
          ? "A mother's older sister is Maiguru, an older social mother."
          : second === "younger_sister"
            ? "A mother's younger sister is Mainini, a younger social mother."
            : "A mother's sister is a social mother.",
    };
  }

  if (
    isSocialParent(first) &&
    childSteps.has(second)
  ) {
    return {
      consumed: 2,
      replacement: [siblingForChild(second)],
      explanation: "A social parent's child is a sibling-equivalent.",
    };
  }

  if (isSibling(first) && second === "father") {
    return {
      consumed: 2,
      replacement: ["social_father"],
      explanation: "A sibling-equivalent's father is a social father.",
    };
  }

  if (isSibling(first) && second === "mother") {
    return {
      consumed: 2,
      replacement: ["social_mother"],
      explanation: "A sibling-equivalent's mother is a social mother.",
    };
  }

  if (first === "social_father" && second === "wife") {
    return {
      consumed: 2,
      replacement: ["social_mother"],
      explanation: "A social father's wife is a social mother.",
    };
  }

  if (first === "older_social_father" && second === "wife") {
    return {
      consumed: 2,
      replacement: ["older_social_mother"],
      explanation: "Bamkuru's wife is Maiguru.",
    };
  }

  if (first === "younger_social_father" && second === "wife") {
    return {
      consumed: 2,
      replacement: ["younger_social_mother"],
      explanation: "Bamnini's wife is Mainini.",
    };
  }

  if (first === "social_mother" && second === "husband") {
    return {
      consumed: 2,
      replacement: ["social_father"],
      explanation: "A social mother's husband is a social father.",
    };
  }

  if (first === "older_social_mother" && second === "husband") {
    return {
      consumed: 2,
      replacement: ["older_social_father"],
      explanation: "Maiguru's husband is Bamkuru.",
    };
  }

  if (first === "younger_social_mother" && second === "husband") {
    return {
      consumed: 2,
      replacement: ["younger_social_father"],
      explanation: "Mainini's husband is Bamnini.",
    };
  }

  // Ego's sex only classifies a sibling step when that step is relative to
  // ego. A later sibling token is relative to the preceding person (for
  // example, the brother in mother -> brother -> son), so it must not use
  // ego's sex for this reduction.
  if (
    index === 0 &&
    isSameSexSibling(first, context.ego.sex) &&
    childSteps.has(second)
  ) {
    return {
      consumed: 2,
      replacement: [socialChildFor(second)],
      explanation:
        "A same-sex sibling's child belongs to ego's social child category.",
    };
  }

  return null;
}

function materialize(step: InferredStep): PathStep[] {
  if (step === "social_father") return ["father"];
  if (step === "social_mother") return ["mother"];
  if (step === "older_social_father") return ["father", "older_brother"];
  if (step === "younger_social_father") {
    return ["father", "younger_brother"];
  }
  if (step === "older_social_mother") return ["mother", "older_sister"];
  if (step === "younger_social_mother") {
    return ["mother", "younger_sister"];
  }
  if (step === "social_son") return ["son"];
  if (step === "social_daughter") return ["daughter"];
  return [step];
}

/**
 * Reduce a genealogical path to a canonical cultural relationship.
 *
 * The engine uses a leftmost, highest-priority rewrite strategy. Every rule
 * consumes at least as many tokens as it emits, and one-for-one replacements
 * introduce social tokens that no rule can convert back, guaranteeing a
 * bounded fixed point without enumerating complete relationship paths.
 */
export function inferCanonicalKinship(
  path: RelationshipPath,
  ego: Person,
): KinshipInference {
  let steps: InferredStep[] = [...path.steps];
  const derivation: string[] = [];
  const maxRewrites = Math.max(16, steps.length * 4);

  for (let rewriteCount = 0; rewriteCount < maxRewrites; rewriteCount += 1) {
    let applied = false;

    for (let index = 0; index < steps.length; index += 1) {
      const rewrite = matchRewrite(steps, index, { ego });

      if (!rewrite) continue;

      steps = [
        ...steps.slice(0, index),
        ...rewrite.replacement,
        ...steps.slice(index + rewrite.consumed),
      ];
      derivation.push(rewrite.explanation);
      applied = true;
      break;
    }

    if (!applied) {
      return {
        canonicalSteps: steps.flatMap(materialize),
        derivation,
      };
    }
  }

  throw new Error("Kinship inference exceeded its rewrite safety limit.");
}
