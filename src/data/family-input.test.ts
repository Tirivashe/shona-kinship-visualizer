import { describe, expect, it } from "vitest";

import { FamilyDataError } from "./in-memory-family-database";
import { parseNewCharacterInput } from "./family-input";

describe("parseNewCharacterInput", () => {
  it("accepts and normalizes a valid character payload", () => {
    expect(
      parseNewCharacterInput({
        firstName: "Tariro",
        surname: "Moyo",
        sex: "female",
        biological: "ignored",
        connections: [
          {
            kind: "parent",
            personId: " parent-id ",
            biological: true,
            married: true,
          },
        ],
      }),
    ).toEqual({
      firstName: "Tariro",
      surname: "Moyo",
      sex: "female",
      dateOfBirth: undefined,
      dateOfDeath: undefined,
      deceased: false,
      bio: undefined,
      photoUrl: undefined,
      connections: [
        {
          kind: "parent",
          personId: "parent-id",
          biological: true,
        },
      ],
    });
  });

  it("rejects malformed sex and connection values", () => {
    expect(() =>
      parseNewCharacterInput({
        firstName: "Tariro",
        surname: "Moyo",
        sex: "unknown",
        connections: [],
      }),
    ).toThrow(FamilyDataError);

    expect(() =>
      parseNewCharacterInput({
        firstName: "Tariro",
        surname: "Moyo",
        sex: "female",
        connections: [{ kind: "cousin", personId: "relative" }],
      }),
    ).toThrow("invalid type");
  });
});
