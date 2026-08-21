import {
  FamilyDataError,
  type CharacterConnectionKind,
  type CharacterSiblingSeniority,
  type NewCharacterConnection,
  type NewCharacterInput,
} from "./in-memory-family-database";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

const CONNECTION_KINDS = new Set<CharacterConnectionKind>([
  "parent",
  "child",
  "spouse",
  "sibling",
]);
const SIBLING_SENIORITIES = new Set<CharacterSiblingSeniority>([
  "new_older",
  "existing_older",
  "unknown",
]);

function parseConnection(value: unknown): NewCharacterConnection {
  if (!isRecord(value)) {
    throw new FamilyDataError("Each family connection must be an object.");
  }

  const kind = value.kind;
  const personId = value.personId;
  if (typeof kind !== "string" || !CONNECTION_KINDS.has(kind as CharacterConnectionKind)) {
    throw new FamilyDataError("A family connection has an invalid type.");
  }
  if (typeof personId !== "string" || !personId.trim()) {
    throw new FamilyDataError("A family connection must identify a person.");
  }

  const parsedKind = kind as CharacterConnectionKind;
  const connection: NewCharacterConnection = {
    kind: parsedKind,
    personId: personId.trim(),
  };

  if (parsedKind === "parent" || parsedKind === "child") {
    connection.biological = value.biological === true;
  } else if (parsedKind === "spouse") {
    connection.married = value.married === true;
  } else {
    const seniority = value.seniority;
    connection.seniority =
      typeof seniority === "string" &&
      SIBLING_SENIORITIES.has(seniority as CharacterSiblingSeniority)
        ? (seniority as CharacterSiblingSeniority)
        : "unknown";
  }

  return connection;
}

export function parseNewCharacterInput(value: unknown): NewCharacterInput {
  if (!isRecord(value)) {
    throw new FamilyDataError("The character payload must be an object.");
  }
  if (!Array.isArray(value.connections)) {
    throw new FamilyDataError("Character connections must be an array.");
  }
  if (value.sex !== "male" && value.sex !== "female") {
    throw new FamilyDataError(
      "Sex must be male or female for kinship calculation.",
    );
  }

  return {
    firstName: typeof value.firstName === "string" ? value.firstName : "",
    surname: typeof value.surname === "string" ? value.surname : "",
    sex: value.sex,
    dateOfBirth: optionalString(value.dateOfBirth),
    dateOfDeath: optionalString(value.dateOfDeath),
    deceased: value.deceased === true,
    bio: optionalString(value.bio),
    photoUrl: optionalString(value.photoUrl),
    connections: value.connections.map(parseConnection),
  };
}
