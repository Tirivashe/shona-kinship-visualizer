export type Sex = "M" | "F";
export type RelativeAge = "older" | "younger" | "same" | "unknown";

/** Graph-native person used by the kinship engine. */
export interface Person {
  id: string;
  sex: Sex;
  fatherId?: string;
  motherId?: string;
  spouseIds: string[];
  /** Optional ordinal used to infer relative age without requiring dates. */
  birthOrder?: number;
  /** Optional parsed birth date; kept distinct from the ordinal birth order. */
  birthTimestamp?: number;
}

export type KStep = "F" | "M" | "S" | "D" | "H" | "W" | "B" | "Z";
export type KPath = KStep[];

export interface SiblingSenioritySegment {
  /** Inclusive indexes in the raw K-path occupied by this sibling move. */
  rawStartIndex: number;
  rawEndIndex: number;
  referenceId: string;
  relativeId: string;
  relativeAge: RelativeAge;
  source: "explicit-sibling-edge" | "shared-parent-collapse";
}

/** A canonical K-step aligned to the raw graph edges and endpoint people. */
export interface CanonicalTraversalSegment {
  step: KStep;
  rawStartIndex: number;
  rawEndIndex: number;
  fromPersonId: string;
  toPersonId: string;
}

export interface Context {
  egoId: string;
  targetId: string;
  egoSex: Sex;
  targetSex: Sex;
  relativeAge: RelativeAge;
  /** Every sibling comparison in traversal order, rather than one global age. */
  siblingSeniorities: readonly SiblingSenioritySegment[];
  generationDistance: number;
}

export interface KinQuery {
  egoId: string;
  targetId: string;
  egoSex?: Sex;
  targetSex?: Sex;
  relativeAge?: RelativeAge;
}

export interface TraversalResult {
  personIds: string[];
  rawPath: KPath;
  canonicalPath: KPath;
  /** Canonical steps with enough provenance for progressive reduction. */
  canonicalSegments?: CanonicalTraversalSegment[];
  /** Positive is above ego; negative is below ego. */
  generationDistance: number;
  siblingSeniorities: SiblingSenioritySegment[];
  /**
   * Query-local classifications accumulated for the semantic nodes visited
   * from Ego to this target. These are never intrinsic Person properties: the
   * same person occupies different classes for different Egos.
   */
  nodeClassifications?: EgoRelativeNodeClassification[];
}

/** Seniority nearest the target is the ranking relevant to a terminal class. */
export function terminalSiblingSeniority(context: Context): RelativeAge {
  return context.siblingSeniorities.at(-1)?.relativeAge ?? "unknown";
}

export type KinshipStatus =
  | "known"
  | "ambiguous"
  | "broad"
  | "invalid"
  | "unrelated";

/**
 * The primary Shona hierarchy. Titles and exceptional roles are represented
 * separately by KinClass; these ten values describe the structural rank and
 * lineage axis which participate in the core reciprocal algebra.
 */
export const CORE_KIN_CLASSES = [
  "PATRILINEAL_GRANDPARENT",
  "PATRILINEAL_FATHER",
  "PATRILINEAL_SIBLING",
  "PATRILINEAL_CHILD",
  "PATRILINEAL_GRANDCHILD",
  "MATRILINEAL_GRANDPARENT",
  "MATRILINEAL_MOTHER",
  "MATRILINEAL_SIBLING",
  "MATRILINEAL_CHILD",
  "MATRILINEAL_GRANDCHILD",
] as const;
export type CoreKinClass = (typeof CORE_KIN_CLASSES)[number];

export const CORE_KIN_RECIPROCALS: Readonly<Record<CoreKinClass, CoreKinClass>> = {
  PATRILINEAL_GRANDPARENT: "PATRILINEAL_GRANDCHILD",
  PATRILINEAL_FATHER: "PATRILINEAL_CHILD",
  PATRILINEAL_SIBLING: "PATRILINEAL_SIBLING",
  PATRILINEAL_CHILD: "PATRILINEAL_FATHER",
  PATRILINEAL_GRANDCHILD: "PATRILINEAL_GRANDPARENT",
  MATRILINEAL_GRANDPARENT: "MATRILINEAL_GRANDCHILD",
  MATRILINEAL_MOTHER: "MATRILINEAL_CHILD",
  MATRILINEAL_SIBLING: "MATRILINEAL_SIBLING",
  MATRILINEAL_CHILD: "MATRILINEAL_MOTHER",
  MATRILINEAL_GRANDCHILD: "MATRILINEAL_GRANDPARENT",
};

/** Distinguishes homonymous terms whose algebraic behavior is different. */
export const KIN_CLASSES = [
  "SELF",
  "CLASSIFICATORY_FATHER",
  "CLASSIFICATORY_MOTHER",
  "CLASSIFICATORY_CHILD",
  "SAME_SEX_SIBLING",
  "CROSS_SEX_SIBLING",
  "GRANDFATHER",
  "GRANDMOTHER",
  "MUZUKURU",
  "PATERNAL_AUNT",
  "HUSBAND",
  "WIFE",
  "MOTHER_IN_LAW",
  "WIFE_RECEIVER_MALE_PEER",
  "WIFE_GIVING_MALE_PEER",
  "WIFES_BROTHERS_WIFE",
] as const;
export type KinClass = (typeof KIN_CLASSES)[number];

export type ProgressiveLineageAxis =
  | "PATRILINEAL"
  | "MATRILINEAL"
  | "AFFINAL"
  | "UNDETERMINED";

export type ProgressiveKinshipBranch =
  | "DIRECT"
  | "PARALLEL"
  | "COLLATERAL"
  | "MATRILATERAL_UNCLE_LINE";

/**
 * Semantic accumulator used while a traversal is reduced from left to right.
 * The displayed title is never used as an algebra key: homonymous titles can
 * occupy different classes, axes, and collateral branches.
 */
export interface ProgressiveKinshipState {
  title: string;
  kinClass: KinClass;
  coreClassifications: CoreKinClass[];
  egoSex: Sex;
  targetSex: Sex;
  axis: ProgressiveLineageAxis;
  branch: ProgressiveKinshipBranch;
  establishedBy: string;
  seniority: RelativeAge;
  derivation: string[];
}

/** The class assigned to one visited person from one specific Ego's view. */
export interface EgoRelativeNodeClassification {
  egoId: string;
  personId: string;
  canonicalPath: KPath;
  status: KinshipStatus;
  title: string;
  kinClass?: KinClass;
  coreClassifications: CoreKinClass[];
  seniority: RelativeAge;
  establishedBy: string;
}

/** One graph edge supplied to the progressive semantic algebra. */
export interface ProgressiveTransitionSegment {
  step: KStep;
  fromPersonId: string;
  toPersonId: string;
  targetSex: Sex;
  /** Age of the new node relative to the original Ego, not the prior node. */
  egoRelativeAge: RelativeAge;
  /** Age of the new node relative to the immediately preceding graph node. */
  relativeAge: RelativeAge;
}

export type KinshipSpecificity =
  | "exact"
  | "classificatory"
  | "alliance-side"
  | "broad";
export type AffinalSocialTerm =
  | "Vanyarikani"
  | "Vasekedzani"
  | "Vakaroorana";

export type RuleConfidence = "attested" | "derived" | "extrapolated";
export type SexCondition = "ego-conditioned" | "sex-invariant" | "undetermined";

export interface RuleProvenance {
  sources: string[];
  confidence: RuleConfidence;
  sexCondition?: SexCondition;
  scope?: string;
}

export type GraphValidationSeverity = "error" | "warning";

export interface GraphValidationIssue {
  code:
    | "DUPLICATE_PERSON_ID"
    | "DANGLING_PARENT"
    | "DANGLING_SPOUSE"
    | "DANGLING_SIBLING"
    | "SELF_PARENT"
    | "SELF_SPOUSE"
    | "SELF_SIBLING"
    | "PARENT_CYCLE"
    | "PARENT_SEX_MISMATCH"
    | "CONTRADICTORY_SENIORITY";
  severity: GraphValidationSeverity;
  message: string;
  personIds: string[];
}

export interface GraphValidationReport {
  valid: boolean;
  issues: GraphValidationIssue[];
}

export interface KinshipResolution {
  status: KinshipStatus;
  title: string;
  description: string;
  ruleId?: string;
  /** Cultural specificity, separate from certainty/status. */
  specificity?: KinshipSpecificity;
  /** Semantic class used by algebra when the spoken title is not unique. */
  kinClass?: KinClass;
  /** One or more positions in the primary patrilineal/matrilineal hierarchy. */
  coreClassifications?: CoreKinClass[];
  /** Seniority carried by a ranked semantic relationship. */
  seniority?: RelativeAge;
  provenance?: RuleProvenance;
  validationIssues?: GraphValidationIssue[];
  /** Alternative reference or address forms for the principal title. */
  aliases?: string[];
  /** Social protocol carried by an affinal relationship. */
  socialTerm?: AffinalSocialTerm;
  socialDescription?: string;
  possibilities?: string[];
  traversal?: TraversalResult;
  reducedPath?: KPath;
  derivation?: string[];
  /** Internal semantic state retained so a later edge continues this prefix. */
  progressiveState?: ProgressiveKinshipState;
}

export interface ReductionResult {
  reducedPath: KPath;
  derivation: string[];
}

/** A composable algebraic rewrite or terminal classification rule. */
export interface KinRule {
  id: string;
  axis: "P" | "M" | "A" | "contextual";
  priority: number;
  provenance?: RuleProvenance;
  matches(path: readonly KStep[], context: Context): boolean;
  reduce?: (path: readonly KStep[], context: Context) => KPath;
  resolve?: (
    path: readonly KStep[],
    context: Context,
  ) => Omit<KinshipResolution, "traversal" | "reducedPath" | "derivation">;
  explanation: string;
}

export function formatKPath(path: readonly KStep[]): string {
  return path.join(".");
}
