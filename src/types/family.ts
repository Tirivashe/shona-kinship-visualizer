export type PersonSex = "male" | "female";

export interface Person {
  id: string;
  firstName: string;
  surname: string;
  sex: PersonSex;

  dateOfBirth?: string;
  dateOfDeath?: string;
  bio?: string;
  photoUrl?: string;
  deceased?: boolean;
}

export type SiblingSeniority = "A_OLDER" | "B_OLDER" | "UNKNOWN";

export type Relationship =
  | {
      id: string;
      type: "PARENT_OF";
      personAId: string; // parent
      personBId: string; // child
      /** Explicit biological evidence used by the genealogy renderer only. */
      biological?: boolean;
      /** Shared by the two biological parent links for children of one couple. */
      biologicalUnionId?: string;
    }
  | {
      id: string;
      type: "SPOUSE_OF";
      personAId: string;
      personBId: string;
      /** Symmetric marriage state used by the family-tree renderer. */
      married?: boolean;
    }
  | {
      id: string;
      type: "SIBLING_OF";
      personAId: string;
      personBId: string;
      seniority: SiblingSeniority;
    };

export type PathStep =
  | "father"
  | "mother"
  | "son"
  | "daughter"
  | "husband"
  | "wife"
  | "older_brother"
  | "younger_brother"
  | "brother"
  | "older_sister"
  | "younger_sister"
  | "sister";

export interface RelationshipPath {
  personIds: string[];
  steps: PathStep[];
}

export type KinshipStatus =
  | "known"
  | "ambiguous"
  | "contextual"
  | "unmapped"
  | "unrelated";

export interface KinshipResult {
  status: KinshipStatus;

  title: string;
  description: string;

  path?: RelationshipPath;

  /** Stable identifier for the cultural rule that produced the result. */
  ruleId?: string;

  /** Alternative spellings or forms which are not the canonical display term. */
  aliases?: string[];

  /** Affinal social protocol shown alongside the principal kinship term. */
  socialTerm?: "Vanyarikani" | "Vasekedzani" | "Vakaroorana";
  socialDescription?: string;

  /** Possible titles when the guide does not supply enough context to choose. */
  possibilities?: string[];

  /** The culturally normalized path used for canonical title matching. */
  canonicalSteps?: PathStep[];

  /** Human-readable record of the equivalence rules used during inference. */
  derivation?: string[];
}
