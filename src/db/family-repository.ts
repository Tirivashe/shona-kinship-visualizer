import "server-only";

import { eq, inArray, sql } from "drizzle-orm";

import {
  InMemoryFamilyDatabase,
  type FamilySnapshot,
  type NewCharacterInput,
} from "@/data/in-memory-family-database";
import type { Person, Relationship } from "@/types/family";

import { db } from "./index";
import { familyState, people, relationships } from "./schema";

type PersonInsert = typeof people.$inferInsert;
type RelationshipInsert = typeof relationships.$inferInsert;
type FamilyQueryExecutor = Pick<typeof db, "select">;

export interface FamilyMutationResult {
  person: Person;
  family: FamilySnapshot;
}

function optional<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

function personFromRow(row: typeof people.$inferSelect): Person {
  return {
    id: row.id,
    firstName: row.firstName,
    surname: row.surname,
    sex: row.sex,
    dateOfBirth: optional(row.dateOfBirth),
    dateOfDeath: optional(row.dateOfDeath),
    deceased: row.deceased || undefined,
    bio: optional(row.bio),
    photoUrl: optional(row.photoUrl),
  };
}

function relationshipFromRow(
  row: typeof relationships.$inferSelect,
): Relationship {
  if (row.type === "PARENT_OF") {
    return {
      id: row.id,
      type: row.type,
      personAId: row.personAId,
      personBId: row.personBId,
      biological: row.biological,
      biologicalUnionId: optional(row.biologicalUnionId),
    };
  }
  if (row.type === "SPOUSE_OF") {
    return {
      id: row.id,
      type: row.type,
      personAId: row.personAId,
      personBId: row.personBId,
      married: row.married,
    };
  }
  return {
    id: row.id,
    type: row.type,
    personAId: row.personAId,
    personBId: row.personBId,
    seniority: row.seniority,
  };
}

function personToRow(person: Person): PersonInsert {
  return {
    id: person.id,
    firstName: person.firstName,
    surname: person.surname,
    sex: person.sex,
    dateOfBirth: person.dateOfBirth ?? null,
    dateOfDeath: person.dateOfDeath ?? null,
    deceased: person.deceased === true,
    bio: person.bio ?? null,
    photoUrl: person.photoUrl ?? null,
  };
}

function relationshipToRow(
  relationship: Relationship,
): RelationshipInsert {
  return {
    id: relationship.id,
    type: relationship.type,
    personAId: relationship.personAId,
    personBId: relationship.personBId,
    biological:
      relationship.type === "PARENT_OF" && relationship.biological === true,
    biologicalUnionId:
      relationship.type === "PARENT_OF"
        ? (relationship.biologicalUnionId ?? null)
        : null,
    married:
      relationship.type === "SPOUSE_OF" && relationship.married === true,
    seniority:
      relationship.type === "SIBLING_OF"
        ? relationship.seniority
        : "UNKNOWN",
  };
}

async function readSnapshot(
  executor: FamilyQueryExecutor,
): Promise<FamilySnapshot> {
  const personRows = await executor.select().from(people).orderBy(people.id);
  const relationshipRows = await executor
    .select()
    .from(relationships)
    .orderBy(relationships.id);
  const [state] = await executor
    .select()
    .from(familyState)
    .where(eq(familyState.id, 1));

  return {
    people: personRows.map(personFromRow),
    relationships: relationshipRows.map(relationshipFromRow),
    revision: state?.revision ?? 0,
  };
}

function changed<T>(before: T | undefined, after: T) {
  return !before || JSON.stringify(before) !== JSON.stringify(after);
}

export class PostgresFamilyRepository {
  snapshot(): Promise<FamilySnapshot> {
    return db.transaction((transaction) => readSnapshot(transaction), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
  }

  addCharacter(input: NewCharacterInput): Promise<FamilyMutationResult> {
    return this.mutate((database) => database.addCharacter(input));
  }

  updateCharacter(
    personId: string,
    input: NewCharacterInput,
  ): Promise<FamilyMutationResult> {
    return this.mutate((database) => database.updateCharacter(personId, input));
  }

  deleteCharacter(personId: string): Promise<FamilyMutationResult> {
    return this.mutate((database) => database.deleteCharacter(personId));
  }

  private mutate(
    operation: (database: InMemoryFamilyDatabase) => Person,
  ): Promise<FamilyMutationResult> {
    return db.transaction(async (transaction) => {
      await transaction
        .insert(familyState)
        .values({ id: 1, revision: 0 })
        .onConflictDoNothing();
      await transaction.execute(
        sql`select ${familyState.id} from ${familyState} where ${familyState.id} = 1 for update`,
      );

      const current = await readSnapshot(transaction);
      const domainDatabase = new InMemoryFamilyDatabase(
        current.people,
        current.relationships,
      );
      const person = operation(domainDatabase);
      const next = domainDatabase.snapshot();

      const currentPeople = new Map(
        current.people.map((candidate) => [candidate.id, candidate]),
      );
      const nextPeople = new Map(
        next.people.map((candidate) => [candidate.id, candidate]),
      );
      const currentRelationships = new Map(
        current.relationships.map((relationship) => [
          relationship.id,
          relationship,
        ]),
      );
      const nextRelationships = new Map(
        next.relationships.map((relationship) => [
          relationship.id,
          relationship,
        ]),
      );

      for (const candidate of next.people) {
        if (!changed(currentPeople.get(candidate.id), candidate)) continue;
        const values = personToRow(candidate);
        await transaction
          .insert(people)
          .values(values)
          .onConflictDoUpdate({
            target: people.id,
            set: {
              firstName: values.firstName,
              surname: values.surname,
              sex: values.sex,
              dateOfBirth: values.dateOfBirth,
              dateOfDeath: values.dateOfDeath,
              deceased: values.deceased,
              bio: values.bio,
              photoUrl: values.photoUrl,
              updatedAt: new Date(),
            },
          });
      }

      const removedRelationshipIds = current.relationships
        .filter((relationship) => !nextRelationships.has(relationship.id))
        .map((relationship) => relationship.id);
      if (removedRelationshipIds.length > 0) {
        await transaction
          .delete(relationships)
          .where(inArray(relationships.id, removedRelationshipIds));
      }

      const removedPersonIds = current.people
        .filter((candidate) => !nextPeople.has(candidate.id))
        .map((candidate) => candidate.id);
      if (removedPersonIds.length > 0) {
        await transaction
          .delete(people)
          .where(inArray(people.id, removedPersonIds));
      }

      for (const relationship of next.relationships) {
        if (
          !changed(currentRelationships.get(relationship.id), relationship)
        ) {
          continue;
        }
        const values = relationshipToRow(relationship);
        await transaction
          .insert(relationships)
          .values(values)
          .onConflictDoUpdate({
            target: relationships.id,
            set: {
              type: values.type,
              personAId: values.personAId,
              personBId: values.personBId,
              biological: values.biological,
              biologicalUnionId: values.biologicalUnionId,
              married: values.married,
              seniority: values.seniority,
              updatedAt: new Date(),
            },
          });
      }

      const revision = current.revision + 1;
      await transaction
        .update(familyState)
        .set({ revision, updatedAt: new Date() })
        .where(eq(familyState.id, 1));

      return {
        person,
        family: {
          people: next.people,
          relationships: next.relationships,
          revision,
        },
      };
    });
  }
}

export const familyRepository = new PostgresFamilyRepository();
