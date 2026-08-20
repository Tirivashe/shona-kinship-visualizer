import type {
  Person,
  PersonSex,
  Relationship,
  SiblingSeniority,
} from "@/types/family";

export type CharacterConnectionKind = "parent" | "child" | "spouse" | "sibling";

export type CharacterSiblingSeniority =
  | "new_older"
  | "existing_older"
  | "unknown";

export interface NewCharacterConnection {
  kind: CharacterConnectionKind;
  personId: string;
  seniority?: CharacterSiblingSeniority;
  biological?: boolean;
  married?: boolean;
}

export interface NewCharacterInput {
  firstName: string;
  surname: string;
  sex: PersonSex;
  dateOfBirth?: string;
  dateOfDeath?: string;
  deceased?: boolean;
  bio?: string;
  photoUrl?: string;
  connections: NewCharacterConnection[];
}

export interface FamilySnapshot {
  people: Person[];
  relationships: Relationship[];
  revision: number;
}

const INITIAL_PEOPLE: readonly Person[] = [
  // { id: "tiri", firstName: "Tiri", surname: "Shamhu", sex: "male" },
  // { id: "taku", firstName: "Taku", surname: "Shamhu", sex: "male" },
  // { id: "tina", firstName: "Tina", surname: "Shamhu", sex: "male" },
  // { id: "gladys", firstName: "Gladys", surname: "Mudereri", sex: "female" },
  // { id: "simba", firstName: "Simba", surname: "Mudereri", sex: "male" },
  // { id: "rudo", firstName: "Rudo", surname: "Mudereri", sex: "female" },
  // { id: "charles", firstName: "Charles", surname: "Ngwerume", sex: "male" },
  // { id: "tom", firstName: "Tomutenda", surname: "Ngwerume", sex: "male" },
  // { id: "fadzi", firstName: "Fadzai", surname: "Ngwerume", sex: "female" },
  // { id: "ebba", firstName: "Ebba", surname: "Shamhu", sex: "female" },
  // { id: "johnson", firstName: "Johnson", surname: "Shamhu", sex: "male" },
  // { id: "tawanda", firstName: "Tawanda", surname: "Shamhu", sex: "male" },
  // { id: "anita", firstName: "Anita", surname: "Shamhu", sex: "female" },
  // { id: "munya", firstName: "Munya", surname: "Shamhu", sex: "male" },
  // { id: "keretina", firstName: "Keretina", surname: "Shamhu", sex: "female" },
  // { id: "madala", firstName: "Madala", surname: "?", sex: "male" },
  // { id: "faith", firstName: "Faith", surname: "Gweru", sex: "female" },
  // { id: "lucy", firstName: "Lucy", surname: "Shamhu", sex: "female" },
];

const INITIAL_RELATIONSHIPS: readonly Relationship[] = [
  //   { id: "ebba-tiri", type: "PARENT_OF", personAId: "ebba", personBId: "tiri" },
  //   { id: "ebba-taku", type: "PARENT_OF", personAId: "ebba", personBId: "taku" },
  //   { id: "ebba-tina", type: "PARENT_OF", personAId: "ebba", personBId: "tina" },
  //   {
  //     id: "gladys-simba",
  //     type: "PARENT_OF",
  //     personAId: "gladys",
  //     personBId: "simba",
  //   },
  //   {
  //     id: "gladys-rudo",
  //     type: "PARENT_OF",
  //     personAId: "gladys",
  //     personBId: "rudo",
  //   },
  //   {
  //     id: "charles-fadzi",
  //     type: "PARENT_OF",
  //     personAId: "charles",
  //     personBId: "fadzi",
  //   },
  //   {
  //     id: "charles-tom",
  //     type: "PARENT_OF",
  //     personAId: "charles",
  //     personBId: "tom",
  //   },
  //   {
  //     id: "keretina-faith",
  //     type: "PARENT_OF",
  //     personAId: "keretina",
  //     personBId: "faith",
  //   },
  //   {
  //     id: "keretina-madala",
  //     type: "PARENT_OF",
  //     personAId: "keretina",
  //     personBId: "madala",
  //   },
  //   {
  //     id: "tawanda-munya",
  //     type: "PARENT_OF",
  //     personAId: "tawanda",
  //     personBId: "munya",
  //   },
  //   {
  //     id: "tawanda-anita",
  //     type: "PARENT_OF",
  //     personAId: "tawanda",
  //     personBId: "anita",
  //   },
  //   {
  //     id: "gladys-charles",
  //     type: "SIBLING_OF",
  //     personAId: "gladys",
  //     personBId: "charles",
  //     seniority: "A_OLDER",
  //   },
  //   {
  //     id: "tawanda-keretina",
  //     type: "SIBLING_OF",
  //     personAId: "tawanda",
  //     personBId: "keretina",
  //     seniority: "B_OLDER",
  //   },
  //   {
  //     id: "ebba-gladys",
  //     type: "SIBLING_OF",
  //     personAId: "ebba",
  //     personBId: "gladys",
  //     seniority: "B_OLDER",
  //   },
  //   {
  //     id: "ebba-charles",
  //     type: "SIBLING_OF",
  //     personAId: "ebba",
  //     personBId: "charles",
  //     seniority: "A_OLDER",
  //   },
  //   {
  //     id: "johnson-tawanda",
  //     type: "SIBLING_OF",
  //     personAId: "johnson",
  //     personBId: "tawanda",
  //     seniority: "A_OLDER",
  //   },
  //   {
  //     id: "johnson-keretina",
  //     type: "SIBLING_OF",
  //     personAId: "johnson",
  //     personBId: "keretina",
  //     seniority: "A_OLDER",
  //   },
  //   {
  //     id: "anita-munya",
  //     type: "SIBLING_OF",
  //     personAId: "anita",
  //     personBId: "munya",
  //     seniority: "A_OLDER",
  //   },
  //   {
  //     id: "tina-tiri",
  //     type: "SIBLING_OF",
  //     personAId: "tina",
  //     personBId: "tiri",
  //     seniority: "A_OLDER",
  //   },
  //   {
  //     id: "tina-taku",
  //     type: "SIBLING_OF",
  //     personAId: "tina",
  //     personBId: "taku",
  //     seniority: "A_OLDER",
  //   },
  //   {
  //     id: "taku-tiri",
  //     type: "SIBLING_OF",
  //     personAId: "taku",
  //     personBId: "tiri",
  //     seniority: "A_OLDER",
  //   },
  //   {
  //     id: "ebba-johnson",
  //     type: "SPOUSE_OF",
  //     personAId: "johnson",
  //     personBId: "ebba",
  //   },
  //   {
  //     id: "lucy-tawanda",
  //     type: "SPOUSE_OF",
  //     personAId: "tawanda",
  //     personBId: "lucy",
  //   },
];

function clonePerson(person: Person): Person {
  return { ...person };
}

function cloneRelationship(relationship: Relationship): Relationship {
  return { ...relationship };
}

function optionalValue(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function slugify(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "person"
  );
}

export class InMemoryFamilyDatabase {
  private readonly people = new Map<string, Person>();
  private readonly relationships = new Map<string, Relationship>();
  private revision = 0;
  private relationshipSequence = 1;

  constructor(
    people: readonly Person[] = [],
    relationships: readonly Relationship[] = [],
  ) {
    for (const person of people)
      this.people.set(person.id, clonePerson(person));
    for (const relationship of relationships) {
      this.relationships.set(relationship.id, cloneRelationship(relationship));
    }
    this.relationshipSequence = relationships.length + 1;
    this.reconcileBiologicalUnionIds();
  }

  snapshot(): FamilySnapshot {
    return {
      people: [...this.people.values()].map(clonePerson),
      relationships: [...this.relationships.values()].map(cloneRelationship),
      revision: this.revision,
    };
  }

  connectionsFor(personId: string): NewCharacterConnection[] {
    if (!this.people.has(personId)) {
      throw new Error("The selected character no longer exists.");
    }

    const connections: NewCharacterConnection[] = [];

    for (const relationship of this.relationships.values()) {
      const isPersonA = relationship.personAId === personId;
      const isPersonB = relationship.personBId === personId;
      if (!isPersonA && !isPersonB) continue;

      const otherPersonId = isPersonA
        ? relationship.personBId
        : relationship.personAId;

      if (relationship.type === "PARENT_OF") {
        connections.push({
          kind: isPersonA ? "child" : "parent",
          personId: otherPersonId,
          biological: relationship.biological === true,
        });
        continue;
      }

      if (relationship.type === "SPOUSE_OF") {
        connections.push({
          kind: "spouse",
          personId: otherPersonId,
          married: relationship.married === true,
        });
        continue;
      }

      let seniority: CharacterSiblingSeniority = "unknown";
      if (relationship.seniority !== "UNKNOWN") {
        const personIsOlder =
          (isPersonA && relationship.seniority === "A_OLDER") ||
          (isPersonB && relationship.seniority === "B_OLDER");
        seniority = personIsOlder ? "new_older" : "existing_older";
      }

      connections.push({
        kind: "sibling",
        personId: otherPersonId,
        seniority,
      });
    }

    return connections;
  }

  addCharacter(input: NewCharacterInput): Person {
    const personDetails = this.validateCharacterInput(input, this.people.size > 0);
    const { firstName, surname } = personDetails;
    const id = this.nextPersonId(`${firstName}-${surname}`);
    const person: Person = {
      id,
      ...personDetails,
    };

    const relationships = input.connections.map((connection) =>
      this.createRelationship(person, connection),
    );
    this.validateBiologicalParentCounts(relationships);

    this.people.set(person.id, person);
    for (const relationship of relationships) {
      this.relationships.set(relationship.id, relationship);
    }
    this.reconcileBiologicalUnionIds();
    this.revision += 1;

    return clonePerson(person);
  }

  updateCharacter(personId: string, input: NewCharacterInput): Person {
    const existingPerson = this.people.get(personId);
    if (!existingPerson) {
      throw new Error("The selected character no longer exists.");
    }

    const personDetails = this.validateCharacterInput(
      input,
      this.people.size > 1,
      personId,
    );
    const person: Person = {
      id: personId,
      ...personDetails,
      photoUrl:
        input.photoUrl === undefined
          ? existingPerson.photoUrl
          : personDetails.photoUrl,
    };
    const relationships = input.connections.map((connection) =>
      this.createRelationship(person, connection),
    );
    this.validateBiologicalParentCounts(relationships, personId);

    this.people.set(personId, person);
    for (const [relationshipId, relationship] of this.relationships) {
      if (
        relationship.personAId === personId ||
        relationship.personBId === personId
      ) {
        this.relationships.delete(relationshipId);
      }
    }
    for (const relationship of relationships) {
      this.relationships.set(relationship.id, relationship);
    }
    this.reconcileBiologicalUnionIds();
    this.revision += 1;

    return clonePerson(person);
  }

  deleteCharacter(personId: string): Person {
    const person = this.people.get(personId);
    if (!person) {
      throw new Error("The selected character no longer exists.");
    }

    this.people.delete(personId);
    for (const [relationshipId, relationship] of this.relationships) {
      if (
        relationship.personAId === personId ||
        relationship.personBId === personId
      ) {
        this.relationships.delete(relationshipId);
      }
    }
    this.reconcileBiologicalUnionIds();
    this.revision += 1;

    return clonePerson(person);
  }

  private validateCharacterInput(
    input: NewCharacterInput,
    connectionRequired: boolean,
    personId?: string,
  ): Omit<Person, "id"> {
    const firstName = input.firstName.trim();
    const surname = input.surname.trim();
    if (!firstName || !surname) {
      throw new Error("First name and surname are required.");
    }
    if (input.sex !== "male" && input.sex !== "female") {
      throw new Error("Sex must be male or female for kinship calculation.");
    }

    const dateOfBirth = optionalValue(input.dateOfBirth);
    const dateOfDeath = optionalValue(input.dateOfDeath);
    if (
      dateOfBirth &&
      dateOfDeath &&
      Date.parse(dateOfDeath) < Date.parse(dateOfBirth)
    ) {
      throw new Error("Date of death cannot be earlier than date of birth.");
    }

    if (connectionRequired && input.connections.length === 0) {
      throw new Error("Connect this character to at least one family member.");
    }

    const connectedPeople = new Set<string>();
    for (const connection of input.connections) {
      if (connection.personId === personId) {
        throw new Error("A character cannot be connected to themselves.");
      }
      if (!this.people.has(connection.personId)) {
        throw new Error("One of the selected family members no longer exists.");
      }
      if (connectedPeople.has(connection.personId)) {
        throw new Error("Each existing member can only be connected once.");
      }
      connectedPeople.add(connection.personId);
    }

    return {
      firstName,
      surname,
      sex: input.sex,
      dateOfBirth,
      dateOfDeath,
      deceased: input.deceased || Boolean(dateOfDeath) || undefined,
      bio: optionalValue(input.bio),
      photoUrl: optionalValue(input.photoUrl),
    };
  }

  private nextPersonId(name: string) {
    const base = slugify(name);
    if (!this.people.has(base)) return base;

    let suffix = 2;
    while (this.people.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  private nextRelationshipId(type: Relationship["type"], a: string, b: string) {
    const base = `${type.toLowerCase()}-${a}-${b}`;
    let id = `${base}-${this.relationshipSequence}`;
    while (this.relationships.has(id)) {
      this.relationshipSequence += 1;
      id = `${base}-${this.relationshipSequence}`;
    }
    this.relationshipSequence += 1;
    return id;
  }

  private createRelationship(
    person: Person,
    connection: NewCharacterConnection,
  ): Relationship {
    const existing = this.people.get(connection.personId);
    if (!existing)
      throw new Error("The selected family member no longer exists.");

    if (connection.kind === "parent") {
      return {
        id: this.nextRelationshipId("PARENT_OF", existing.id, person.id),
        type: "PARENT_OF",
        personAId: existing.id,
        personBId: person.id,
        biological: connection.biological === true,
      };
    }

    if (connection.kind === "child") {
      return {
        id: this.nextRelationshipId("PARENT_OF", person.id, existing.id),
        type: "PARENT_OF",
        personAId: person.id,
        personBId: existing.id,
        biological: connection.biological === true,
      };
    }

    if (connection.kind === "spouse") {
      return {
        id: this.nextRelationshipId("SPOUSE_OF", person.id, existing.id),
        type: "SPOUSE_OF",
        personAId: person.id,
        personBId: existing.id,
        married: connection.married === true,
      };
    }

    return {
      id: this.nextRelationshipId("SIBLING_OF", person.id, existing.id),
      type: "SIBLING_OF",
      personAId: person.id,
      personBId: existing.id,
      seniority: this.siblingSeniority(person, existing, connection.seniority),
    };
  }

  private validateBiologicalParentCounts(
    proposedRelationships: readonly Relationship[],
    replacingPersonId?: string,
  ) {
    const biologicalParentsByChild = new Map<string, Set<string>>();
    const retainedRelationships = [...this.relationships.values()].filter(
      (relationship) =>
        !replacingPersonId ||
        (relationship.personAId !== replacingPersonId &&
          relationship.personBId !== replacingPersonId),
    );

    for (const relationship of [
      ...retainedRelationships,
      ...proposedRelationships,
    ]) {
      if (
        relationship.type !== "PARENT_OF" ||
        relationship.biological !== true
      ) {
        continue;
      }
      const parents =
        biologicalParentsByChild.get(relationship.personBId) ?? new Set();
      parents.add(relationship.personAId);
      biologicalParentsByChild.set(relationship.personBId, parents);
      if (parents.size > 2) {
        throw new Error(
          "A child can have at most two recorded biological parents.",
        );
      }
    }
  }

  /**
   * Assign a stable union identifier whenever two explicitly biological
   * parents share a child. Marriage is independent; React Flow uses the union
   * identifier to consolidate the two parent lines and child branches.
   */
  private reconcileBiologicalUnionIds() {
    const biologicalParentsByChild = new Map<
      string,
      Extract<Relationship, { type: "PARENT_OF" }>[]
    >();

    for (const [relationshipId, relationship] of this.relationships) {
      if (relationship.type !== "PARENT_OF") continue;

      if (relationship.biologicalUnionId) {
        const withoutUnion = { ...relationship };
        delete withoutUnion.biologicalUnionId;
        this.relationships.set(relationshipId, withoutUnion);
      }
      if (relationship.biological !== true) continue;

      const parents = biologicalParentsByChild.get(relationship.personBId) ?? [];
      parents.push(relationship);
      biologicalParentsByChild.set(relationship.personBId, parents);
    }

    for (const parentRelationships of biologicalParentsByChild.values()) {
      if (parentRelationships.length !== 2) continue;
      const [parentA, parentB] = parentRelationships;

      const biologicalUnionId = this.biologicalUnionId(
        parentA.personAId,
        parentB.personAId,
      );
      for (const relationship of parentRelationships) {
        this.relationships.set(relationship.id, {
          ...relationship,
          biologicalUnionId,
        });
      }
    }
  }

  private biologicalUnionId(personAId: string, personBId: string) {
    const [first, second] = [personAId, personBId].sort();
    return `biological-union:${encodeURIComponent(first)}:${encodeURIComponent(second)}`;
  }

  private siblingSeniority(
    person: Person,
    existing: Person,
    seniority: CharacterSiblingSeniority = "unknown",
  ): SiblingSeniority {
    if (seniority === "new_older") return "A_OLDER";
    if (seniority === "existing_older") return "B_OLDER";

    if (person.dateOfBirth && existing.dateOfBirth) {
      const personBirth = Date.parse(person.dateOfBirth);
      const existingBirth = Date.parse(existing.dateOfBirth);
      if (personBirth < existingBirth) return "A_OLDER";
      if (personBirth > existingBirth) return "B_OLDER";
    }

    return "UNKNOWN";
  }
}

export function createInMemoryFamilyDatabase() {
  return new InMemoryFamilyDatabase(INITIAL_PEOPLE, INITIAL_RELATIONSHIPS);
}

/** Backward-compatible immutable seed exports; the UI uses the database. */
export const initialPeople = INITIAL_PEOPLE.map(clonePerson);
export const initialRelationships =
  INITIAL_RELATIONSHIPS.map(cloneRelationship);
