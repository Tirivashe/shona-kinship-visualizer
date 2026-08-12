import type {
  KinshipResult,
  PathStep,
  Person,
  Relationship,
  RelationshipPath,
} from "@/types/family";

import { findRelationshipPaths } from "./graph";

interface RankedResult {
  priority: number;
  result: KinshipResult;
}

type RelativeSeniority = "older" | "younger" | "unknown";

const readableStep: Record<PathStep, string> = {
  father: "Father",
  mother: "Mother",
  son: "Son",
  daughter: "Daughter",
  husband: "Husband",
  wife: "Wife",
  older_brother: "Older brother",
  younger_brother: "Younger brother",
  brother: "Brother",
  older_sister: "Older sister",
  younger_sister: "Younger sister",
  sister: "Sister",
};

const brotherSteps = new Set<PathStep>([
  "older_brother",
  "younger_brother",
  "brother",
]);

const sisterSteps = new Set<PathStep>([
  "older_sister",
  "younger_sister",
  "sister",
]);

const childSteps = new Set<PathStep>(["son", "daughter"]);
const parentSteps = new Set<PathStep>(["father", "mother"]);

function known(
  path: RelationshipPath,
  ruleId: string,
  title: string,
  description: string,
  priority: number,
  aliases?: string[],
): RankedResult {
  return {
    priority,
    result: {
      status: "known",
      title,
      description,
      path,
      ruleId,
      aliases,
    },
  };
}

function ambiguous(
  path: RelationshipPath,
  ruleId: string,
  title: string,
  description: string,
  possibilities: string[],
  priority: number,
): RankedResult {
  return {
    priority,
    result: {
      status: "ambiguous",
      title,
      description,
      path,
      ruleId,
      possibilities,
    },
  };
}

function contextual(
  path: RelationshipPath,
  ruleId: string,
  title: string,
  description: string,
  possibilities: string[],
  priority: number,
): RankedResult {
  return {
    priority,
    result: {
      status: "contextual",
      title,
      description,
      path,
      ruleId,
      possibilities,
    },
  };
}

function seniorityFromStep(step: PathStep): RelativeSeniority {
  if (step.startsWith("older_")) return "older";
  if (step.startsWith("younger_")) return "younger";
  return "unknown";
}

function seniorityFromBirthDates(
  ego: Person,
  target: Person,
): RelativeSeniority {
  if (!ego.dateOfBirth || !target.dateOfBirth) return "unknown";

  const egoBirth = Date.parse(ego.dateOfBirth);
  const targetBirth = Date.parse(target.dateOfBirth);

  if (Number.isNaN(egoBirth) || Number.isNaN(targetBirth)) return "unknown";
  if (targetBirth < egoBirth) return "older";
  if (targetBirth > egoBirth) return "younger";

  return "unknown";
}

function resolveSiblingEquivalent(
  path: RelationshipPath,
  ego: Person,
  target: Person,
  seniority: RelativeSeniority,
  source: "sibling" | "parallel cousin",
): RankedResult {
  if (ego.sex !== target.sex) {
    return known(
      path,
      "OPPOSITE_SEX_SIBLING_EQUIVALENT",
      "Hanzvadzi",
      `Your opposite-sex ${source}.`,
      820,
    );
  }

  if (seniority === "older") {
    return known(
      path,
      "OLDER_SAME_SEX_SIBLING_EQUIVALENT",
      "Mukoma",
      `Your older same-sex ${source}.`,
      820,
    );
  }

  if (seniority === "younger") {
    return known(
      path,
      "YOUNGER_SAME_SEX_SIBLING_EQUIVALENT",
      "Munin'ina",
      `Your younger same-sex ${source}.`,
      820,
    );
  }

  return ambiguous(
    path,
    "SAME_SEX_SIBLING_SENIORITY_REQUIRED",
    "Same-sex sibling",
    `Seniority is required to title this ${source}.`,
    ["Mukoma", "Munin'ina"],
    820,
  );
}

function isSiblingStep(step: PathStep | undefined) {
  return Boolean(step && (brotherSteps.has(step) || sisterSteps.has(step)));
}

function isConsanguinealPath(steps: PathStep[]) {
  return steps.every((step) => step !== "husband" && step !== "wife");
}

function resolvePath(
  path: RelationshipPath,
  ego: Person,
  target: Person,
): RankedResult {
  const { steps } = path;
  const key = steps.join(">");

  if (steps.length === 0) {
    return known(path, "SELF", "You", "This is the selected person.", 1000);
  }

  // Cross-cousin exceptions must run before the broader cousin-as-sibling rule.
  if (
    steps.length === 3 &&
    steps[0] === "father" &&
    sisterSteps.has(steps[1]) &&
    childSteps.has(steps[2])
  ) {
    return ego.sex === "male"
      ? known(
          path,
          "PATERNAL_AUNT_CHILD_MALE_EGO",
          "Muzukuru",
          "Your paternal aunt's child, viewed by a male ego.",
          940,
        )
      : known(
          path,
          "PATERNAL_AUNT_CHILD_FEMALE_EGO",
          "Mwana",
          "Your paternal aunt's child, viewed by a female ego.",
          940,
        );
  }

  if (
    ego.sex === "male" &&
    steps.length === 3 &&
    steps[0] === "mother" &&
    brotherSteps.has(steps[1]) &&
    childSteps.has(steps[2])
  ) {
    return target.sex === "male"
      ? known(
          path,
          "MATERNAL_UNCLE_SON_MALE_EGO",
          "Sekuru",
          "Your maternal uncle's son, viewed by a male ego.",
          940,
        )
      : known(
          path,
          "MATERNAL_UNCLE_DAUGHTER_MALE_EGO",
          "Mainini",
          "Your maternal uncle's daughter, viewed by a male ego.",
          940,
        );
  }

  // The guide assigns both Tsano and Tezvara to a wife's brother.
  if (
    steps.length === 2 &&
    steps[0] === "wife" &&
    brotherSteps.has(steps[1])
  ) {
    return contextual(
      path,
      "WIFES_BROTHER_CONTEXT_REQUIRED",
      "Tsano / Tezvara",
      "The guide gives both titles for a wife's brother; usage context is required.",
      ["Tsano", "Tezvara"],
      930,
    );
  }

  if (key === "wife>father") {
    return known(
      path,
      "FATHER_IN_LAW_THROUGH_WIFE",
      "Tezvara",
      "Your wife's father.",
      920,
    );
  }

  if (key === "husband>mother") {
    return known(
      path,
      "MOTHER_IN_LAW_THROUGH_HUSBAND",
      "Vamwene",
      "Your husband's mother.",
      920,
    );
  }

  if (
    steps.length === 2 &&
    (steps[0] === "wife" || steps[0] === "husband") &&
    isSiblingStep(steps[1])
  ) {
    return known(
      path,
      "SPOUSES_SIBLING",
      "Muramu",
      "Your sibling-in-law in a joking relationship.",
      880,
    );
  }

  if (
    steps.length >= 2 &&
    steps.at(-1) === "wife" &&
    isConsanguinealPath(steps.slice(0, -1))
  ) {
    return known(
      path,
      "WOMAN_MARRIED_INTO_FAMILY",
      "Muroora",
      "A woman married into your consanguineal family.",
      860,
    );
  }

  if (
    steps.length >= 2 &&
    steps.at(-1) === "husband" &&
    isConsanguinealPath(steps.slice(0, -1))
  ) {
    return known(
      path,
      "MAN_MARRIED_TO_FAMILY_DAUGHTER",
      "Mukuwasha",
      "A man married to a daughter of your consanguineal family.",
      860,
    );
  }

  if (steps.length === 1 && isSiblingStep(steps[0])) {
    const explicitSeniority = seniorityFromStep(steps[0]);

    return resolveSiblingEquivalent(
      path,
      ego,
      target,
      explicitSeniority === "unknown"
        ? seniorityFromBirthDates(ego, target)
        : explicitSeniority,
      "sibling",
    );
  }

  // A shared parent is sufficient to establish siblinghood; callers should
  // not have to duplicate that fact with a SIBLING_OF relationship.
  if (
    steps.length === 2 &&
    parentSteps.has(steps[0]) &&
    childSteps.has(steps[1])
  ) {
    return resolveSiblingEquivalent(
      path,
      ego,
      target,
      seniorityFromBirthDates(ego, target),
      "sibling",
    );
  }

  const isParallelCousin =
    steps.length === 3 &&
    childSteps.has(steps[2]) &&
    ((steps[0] === "father" && brotherSteps.has(steps[1])) ||
      (steps[0] === "mother" && sisterSteps.has(steps[1])));

  if (isParallelCousin) {
    return resolveSiblingEquivalent(
      path,
      ego,
      target,
      seniorityFromBirthDates(ego, target),
      "parallel cousin",
    );
  }

  const exactRules: Record<
    string,
    Omit<RankedResult["result"], "status" | "path"> & { priority: number }
  > = {
    father: {
      ruleId: "FATHER",
      title: "Baba",
      description: "Your biological father.",
      priority: 800,
    },
    mother: {
      ruleId: "MOTHER",
      title: "Mai",
      description: "Your biological mother.",
      aliases: ["Amai"],
      priority: 800,
    },
    "father>older_brother": {
      ruleId: "PATERNAL_UNCLE_OLDER",
      title: "Bamkuru",
      description: "Your father's older brother and social father.",
      aliases: ["Babamukuru"],
      priority: 850,
    },
    "father>younger_brother": {
      ruleId: "PATERNAL_UNCLE_YOUNGER",
      title: "Bamnini",
      description: "Your father's younger brother and social father.",
      aliases: ["Babamunini", "Babanini"],
      priority: 850,
    },
    "father>older_sister": {
      ruleId: "PATERNAL_AUNT",
      title: "Tete",
      description: "Your father's sister.",
      priority: 850,
    },
    "father>younger_sister": {
      ruleId: "PATERNAL_AUNT",
      title: "Tete",
      description: "Your father's sister.",
      priority: 850,
    },
    "father>sister": {
      ruleId: "PATERNAL_AUNT",
      title: "Tete",
      description: "Your father's sister.",
      priority: 850,
    },
    "mother>older_sister": {
      ruleId: "MATERNAL_AUNT_OLDER",
      title: "Maiguru",
      description: "Your mother's older sister and social mother.",
      priority: 850,
    },
    "mother>younger_sister": {
      ruleId: "MATERNAL_AUNT_YOUNGER",
      title: "Mainini",
      description: "Your mother's younger sister and social mother.",
      priority: 850,
    },
    "mother>older_brother": {
      ruleId: "MATERNAL_UNCLE",
      title: "Sekuru",
      description: "Your mother's brother.",
      priority: 850,
    },
    "mother>younger_brother": {
      ruleId: "MATERNAL_UNCLE",
      title: "Sekuru",
      description: "Your mother's brother.",
      priority: 850,
    },
    "mother>brother": {
      ruleId: "MATERNAL_UNCLE",
      title: "Sekuru",
      description: "Your mother's brother.",
      priority: 850,
    },
    "father>father": {
      ruleId: "GRANDFATHER",
      title: "Sekuru",
      description: "Your paternal grandfather.",
      priority: 800,
    },
    "mother>father": {
      ruleId: "GRANDFATHER",
      title: "Sekuru",
      description: "Your maternal grandfather.",
      priority: 800,
    },
    "father>mother": {
      ruleId: "GRANDMOTHER",
      title: "Ambuya",
      description: "Your paternal grandmother.",
      priority: 800,
    },
    "mother>mother": {
      ruleId: "GRANDMOTHER",
      title: "Ambuya",
      description: "Your maternal grandmother.",
      priority: 800,
    },
    son: {
      ruleId: "CHILD",
      title: "Mwana",
      description: "Your child.",
      priority: 780,
    },
    daughter: {
      ruleId: "CHILD",
      title: "Mwana",
      description: "Your child.",
      priority: 780,
    },
  };

  const exactRule = exactRules[key];

  if (exactRule) {
    return known(
      path,
      exactRule.ruleId ?? "EXACT_RULE",
      exactRule.title,
      exactRule.description,
      exactRule.priority,
      exactRule.aliases,
    );
  }

  if (key === "father>brother") {
    return ambiguous(
      path,
      "PATERNAL_UNCLE_SENIORITY_REQUIRED",
      "Father's brother",
      "Seniority is required to determine the exact Shona title.",
      ["Bamkuru", "Bamnini"],
      850,
    );
  }

  if (key === "mother>sister") {
    return ambiguous(
      path,
      "MATERNAL_AUNT_SENIORITY_REQUIRED",
      "Mother's sister",
      "Seniority is required to determine the exact Shona title.",
      ["Maiguru", "Mainini"],
      850,
    );
  }

  if (steps.length === 2 && steps.every((step) => childSteps.has(step))) {
    return known(
      path,
      "GRANDCHILD",
      "Muzukuru",
      "Your grandchild.",
      780,
    );
  }

  if (steps.length === 3 && steps.every((step) => childSteps.has(step))) {
    return known(
      path,
      "GREAT_GRANDCHILD",
      "Chizukuruchibvi",
      "Your great-grandchild.",
      780,
    );
  }

  // The guide calls Tateguru a distant male ancestor. Three or more upward
  // generations is the explicit project threshold until regional rules refine it.
  if (
    steps.length >= 3 &&
    steps.every((step) => parentSteps.has(step)) &&
    target.sex === "male"
  ) {
    return known(
      path,
      "DISTANT_MALE_ANCESTOR",
      "Tateguru",
      "Your male ancestor at least three generations above you.",
      760,
    );
  }

  return {
    priority: 0,
    result: {
      status: "unmapped",
      title: steps.map((step) => readableStep[step]).join(" → "),
      description:
        "The genealogical path is known, but the supplied guide does not define a Shona title for it.",
      path,
    },
  };
}

export function resolveKinship(
  egoId: string,
  targetId: string,
  people: Person[],
  relationships: Relationship[],
): KinshipResult {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const ego = peopleById.get(egoId);
  const target = peopleById.get(targetId);

  if (!ego || !target) {
    return {
      status: "unrelated",
      title: "Unknown person",
      description: "The ego or target person does not exist in the family data.",
    };
  }

  const paths = findRelationshipPaths(
    egoId,
    targetId,
    people,
    relationships,
  );

  if (paths.length === 0) {
    return {
      status: "unrelated",
      title: "Unknown relation",
      description: "No relationship path could be found.",
    };
  }

  const ranked = paths
    .map((path) => resolvePath(path, ego, target))
    .sort((a, b) => b.priority - a.priority);

  const bestPriority = ranked[0].priority;
  const bestMatches = ranked.filter((match) => match.priority === bestPriority);
  const distinctTitles = [...
    new Set(bestMatches.map((match) => match.result.title)),
  ];

  if (distinctTitles.length > 1) {
    return {
      status: "contextual",
      title: "Multiple valid relationships",
      description:
        "Equally short family paths produce different culturally valid titles.",
      possibilities: distinctTitles,
      path: bestMatches[0].result.path,
      ruleId: "MULTIPLE_EQUAL_PATHS",
    };
  }

  return bestMatches[0].result;
}
