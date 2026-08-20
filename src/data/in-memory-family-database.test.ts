import { describe, expect, it } from "vitest";

import type { Person, Relationship } from "@/types/family";

import { InMemoryFamilyDatabase } from "./in-memory-family-database";
import { resolveKinship } from "../kinship/resolve";

describe("InMemoryFamilyDatabase", () => {
  it("adds the first member without requiring a connection", () => {
    const database = new InMemoryFamilyDatabase();

    const person = database.addCharacter({
      firstName: "Rufaro",
      surname: "Moyo",
      sex: "female",
      photoUrl: "data:image/png;base64,cGhvdG8=",
      connections: [],
    });
    const snapshot = database.snapshot();

    expect(person.id).toBe("rufaro-moyo");
    expect(person.photoUrl).toBe("data:image/png;base64,cGhvdG8=");
    expect(snapshot.people).toEqual([person]);
    expect(snapshot.relationships).toEqual([]);
    expect(snapshot.revision).toBe(1);
  });

  it("stores explicit connections and infers sibling seniority from birth dates", () => {
    const ego: Person = {
      id: "ego",
      firstName: "Ego",
      surname: "Moyo",
      sex: "male",
      dateOfBirth: "1990-01-01",
    };
    const database = new InMemoryFamilyDatabase([ego]);

    const brother = database.addCharacter({
      firstName: "Tapiwa",
      surname: "Moyo",
      sex: "male",
      dateOfBirth: "1995-01-01",
      connections: [
        { kind: "sibling", personId: "ego", seniority: "unknown" },
      ],
    });
    const snapshot = database.snapshot();
    const sibling = snapshot.relationships[0];

    expect(sibling).toMatchObject({
      type: "SIBLING_OF",
      personAId: brother.id,
      personBId: "ego",
      seniority: "B_OLDER",
    });
    expect(
      resolveKinship("ego", brother.id, snapshot.people, snapshot.relationships)
        .title,
    ).toBe("Munin'ina");
  });

  it("makes newly added parent links available to classificatory kinship", () => {
    const people: Person[] = [
      { id: "mother", firstName: "Mai", surname: "Moyo", sex: "female" },
      { id: "father", firstName: "Baba", surname: "Moyo", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "parents",
        type: "SPOUSE_OF",
        personAId: "mother",
        personBId: "father",
      },
    ];
    const database = new InMemoryFamilyDatabase(people, relationships);

    const child = database.addCharacter({
      firstName: "Tino",
      surname: "Moyo",
      sex: "male",
      connections: [{ kind: "parent", personId: "mother" }],
    });
    const snapshot = database.snapshot();

    expect(
      resolveKinship(
        child.id,
        "mother",
        snapshot.people,
        snapshot.relationships,
      ).title,
    ).toBe("Mai");
    expect(
      resolveKinship(
        child.id,
        "father",
        snapshot.people,
        snapshot.relationships,
      ).title,
    ).toBe("Baba");
  });

  it("assigns one union id to two biological parents without requiring marriage", () => {
    const people: Person[] = [
      { id: "mother", firstName: "Mai", surname: "Moyo", sex: "female" },
      { id: "father", firstName: "Baba", surname: "Moyo", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "parents",
        type: "SPOUSE_OF",
        personAId: "mother",
        personBId: "father",
      },
    ];
    const database = new InMemoryFamilyDatabase(people, relationships);

    const child = database.addCharacter({
      firstName: "Tino",
      surname: "Moyo",
      sex: "male",
      connections: [
        {
          kind: "parent",
          personId: "mother",
          biological: true,
        },
        {
          kind: "parent",
          personId: "father",
          biological: true,
        },
      ],
    });
    const snapshot = database.snapshot();
    const parentLinks = snapshot.relationships.filter(
      (relationship) => relationship.type === "PARENT_OF",
    );

    expect(parentLinks).toHaveLength(2);
    expect(parentLinks.map((relationship) => relationship.biologicalUnionId)).toEqual([
      "biological-union:father:mother",
      "biological-union:father:mother",
    ]);
    expect(
      resolveKinship(
        child.id,
        "father",
        snapshot.people,
        snapshot.relationships,
      ).title,
    ).toBe("Baba");
  });

  it("stores a normal parent link without assuming it is biological", () => {
    const parent: Person = {
      id: "parent",
      firstName: "Mai",
      surname: "Moyo",
      sex: "female",
    };
    const database = new InMemoryFamilyDatabase([parent]);

    database.addCharacter({
      firstName: "Tino",
      surname: "Moyo",
      sex: "male",
      connections: [
        {
          kind: "parent",
          personId: "parent",
        },
      ],
    });

    expect(database.snapshot().relationships[0]).toMatchObject({
      type: "PARENT_OF",
      biological: false,
    });
    expect(database.snapshot().relationships[0]).not.toHaveProperty(
      "biologicalUnionId",
    );
  });

  it("rejects contradictory duplicate links without changing the database", () => {
    const relative: Person = {
      id: "relative",
      firstName: "Relative",
      surname: "Moyo",
      sex: "female",
    };
    const database = new InMemoryFamilyDatabase([relative]);

    expect(() =>
      database.addCharacter({
        firstName: "New",
        surname: "Person",
        sex: "male",
        connections: [
          { kind: "parent", personId: "relative" },
          { kind: "sibling", personId: "relative" },
        ],
      }),
    ).toThrow("Each existing member can only be connected once.");
    expect(database.snapshot()).toMatchObject({
      people: [relative],
      relationships: [],
      revision: 0,
    });
  });

  it("returns direct connections from the selected character's perspective", () => {
    const people: Person[] = [
      { id: "parent", firstName: "Parent", surname: "Moyo", sex: "female" },
      { id: "older", firstName: "Older", surname: "Moyo", sex: "male" },
      { id: "younger", firstName: "Younger", surname: "Moyo", sex: "male" },
      { id: "spouse", firstName: "Spouse", surname: "Moyo", sex: "female" },
    ];
    const relationships: Relationship[] = [
      {
        id: "parent-older",
        type: "PARENT_OF",
        personAId: "parent",
        personBId: "older",
      },
      {
        id: "older-younger",
        type: "SIBLING_OF",
        personAId: "older",
        personBId: "younger",
        seniority: "A_OLDER",
      },
      {
        id: "older-spouse",
        type: "SPOUSE_OF",
        personAId: "older",
        personBId: "spouse",
      },
    ];
    const database = new InMemoryFamilyDatabase(people, relationships);

    expect(database.connectionsFor("older")).toEqual([
      { kind: "parent", personId: "parent", biological: false },
      { kind: "sibling", personId: "younger", seniority: "new_older" },
      { kind: "spouse", personId: "spouse", married: false },
    ]);
    expect(database.connectionsFor("younger")).toEqual([
      {
        kind: "sibling",
        personId: "older",
        seniority: "existing_older",
      },
    ]);
  });

  it("updates details and direct connections without changing the character id or unrelated links", () => {
    const people: Person[] = [
      { id: "ego", firstName: "Tiri", surname: "Moyo", sex: "male" },
      {
        id: "relative",
        firstName: "Rudo",
        surname: "Moyo",
        sex: "female",
        photoUrl: "/rudo.jpg",
      },
      { id: "a", firstName: "A", surname: "Moyo", sex: "female" },
      { id: "b", firstName: "B", surname: "Moyo", sex: "male" },
    ];
    const relationships: Relationship[] = [
      {
        id: "old-sibling",
        type: "SIBLING_OF",
        personAId: "ego",
        personBId: "relative",
        seniority: "UNKNOWN",
      },
      {
        id: "unrelated-link",
        type: "PARENT_OF",
        personAId: "a",
        personBId: "b",
      },
    ];
    const database = new InMemoryFamilyDatabase(people, relationships);

    const updated = database.updateCharacter("relative", {
      firstName: "Ruramai",
      surname: "Moyo",
      sex: "female",
      bio: "Updated notes",
      connections: [{ kind: "spouse", personId: "ego", married: true }],
    });
    const snapshot = database.snapshot();

    expect(updated).toMatchObject({
      id: "relative",
      firstName: "Ruramai",
      bio: "Updated notes",
      photoUrl: "/rudo.jpg",
    });
    expect(snapshot.relationships).toContainEqual(relationships[1]);
    expect(snapshot.relationships).not.toContainEqual(relationships[0]);
    expect(snapshot.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SPOUSE_OF",
          personAId: "relative",
          personBId: "ego",
          married: true,
        }),
      ]),
    );
    expect(snapshot.revision).toBe(1);
    expect(
      resolveKinship(
        "ego",
        "relative",
        snapshot.people,
        snapshot.relationships,
      ).title,
    ).toBe("Mukadzi");
    expect(database.connectionsFor("ego")).toEqual([
      { kind: "spouse", personId: "relative", married: true },
    ]);
    expect(database.connectionsFor("relative")).toEqual([
      { kind: "spouse", personId: "ego", married: true },
    ]);
  });

  it("rejects a self-connection without mutating the character", () => {
    const person: Person = {
      id: "ego",
      firstName: "Tiri",
      surname: "Moyo",
      sex: "male",
    };
    const database = new InMemoryFamilyDatabase([person]);

    expect(() =>
      database.updateCharacter("ego", {
        firstName: "Changed",
        surname: "Moyo",
        sex: "male",
        connections: [{ kind: "spouse", personId: "ego" }],
      }),
    ).toThrow("A character cannot be connected to themselves.");
    expect(database.snapshot()).toMatchObject({
      people: [person],
      relationships: [],
      revision: 0,
    });
  });

  it("deletes a character and every relationship that references them", () => {
    const people: Person[] = [
      { id: "mother", firstName: "Mai", surname: "Moyo", sex: "female" },
      { id: "father", firstName: "Baba", surname: "Moyo", sex: "male" },
      { id: "child", firstName: "Mwana", surname: "Moyo", sex: "male" },
      { id: "aunt", firstName: "Tete", surname: "Moyo", sex: "female" },
    ];
    const relationships: Relationship[] = [
      {
        id: "mother-child",
        type: "PARENT_OF",
        personAId: "mother",
        personBId: "child",
        biological: true,
      },
      {
        id: "father-child",
        type: "PARENT_OF",
        personAId: "father",
        personBId: "child",
        biological: true,
      },
      {
        id: "parents",
        type: "SPOUSE_OF",
        personAId: "mother",
        personBId: "father",
        married: true,
      },
      {
        id: "mother-aunt",
        type: "SIBLING_OF",
        personAId: "mother",
        personBId: "aunt",
        seniority: "A_OLDER",
      },
    ];
    const database = new InMemoryFamilyDatabase(people, relationships);

    expect(database.deleteCharacter("mother")).toEqual(people[0]);

    const snapshot = database.snapshot();
    expect(snapshot.people.map((person) => person.id)).toEqual([
      "father",
      "child",
      "aunt",
    ]);
    expect(snapshot.relationships).toEqual([
      expect.objectContaining({
        id: "father-child",
        personAId: "father",
        personBId: "child",
      }),
    ]);
    expect(snapshot.relationships[0]).not.toHaveProperty(
      "biologicalUnionId",
    );
    expect(snapshot.revision).toBe(1);
  });

  it("rejects deletion of a missing character without changing the database", () => {
    const person: Person = {
      id: "ego",
      firstName: "Tiri",
      surname: "Moyo",
      sex: "male",
    };
    const database = new InMemoryFamilyDatabase([person]);

    expect(() => database.deleteCharacter("missing")).toThrow(
      "The selected character no longer exists.",
    );
    expect(database.snapshot()).toEqual({
      people: [person],
      relationships: [],
      revision: 0,
    });
  });
});
