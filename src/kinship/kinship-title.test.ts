import { describe, expect, it } from "vitest";

import { formatKinshipTitle } from "./kinship-title";

describe("formatKinshipTitle", () => {
  it("concatenates the principal and alternative titles", () => {
    expect(formatKinshipTitle("Muroora", ["Maiguru"])).toBe(
      "Muroora / Maiguru",
    );
  });

  it("preserves order while removing repeated slash-delimited titles", () => {
    expect(
      formatKinshipTitle("Tsano / Tezvara", ["Tsano", "Tezvara"]),
    ).toBe("Tsano / Tezvara");
  });

  it("leaves a title without alternatives unchanged", () => {
    expect(formatKinshipTitle("Hanzvadzi")).toBe("Hanzvadzi");
  });
});
