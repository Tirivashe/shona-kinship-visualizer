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
}

export type KStep = "F" | "M" | "S" | "D" | "H" | "W" | "B" | "Z";
export type KPath = KStep[];

export interface Context {
  egoId: string;
  targetId: string;
  egoSex: Sex;
  targetSex: Sex;
  relativeAge: RelativeAge;
  structuralRelativeAge: RelativeAge;
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
  /** Positive is above ego; negative is below ego. */
  generationDistance: number;
}

export type KinshipStatus = "known" | "ambiguous" | "unmapped" | "unrelated";

export interface KinshipResolution {
  status: KinshipStatus;
  title: string;
  description: string;
  ruleId?: string;
  possibilities?: string[];
  traversal?: TraversalResult;
  reducedPath?: KPath;
  derivation?: string[];
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
