import { describe, expect, it } from "vitest";

import { errorMessage } from "./error-message";

describe("errorMessage", () => {
  it("uses a useful message from an Error", () => {
    expect(errorMessage(new Error("Database unavailable"), "Fallback")).toBe(
      "Database unavailable",
    );
  });

  it("uses the fallback for non-errors and empty messages", () => {
    expect(errorMessage("Database unavailable", "Fallback")).toBe("Fallback");
    expect(errorMessage(new Error("   "), "Fallback")).toBe("Fallback");
  });
});
