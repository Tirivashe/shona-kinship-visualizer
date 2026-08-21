import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { PersonNode, type PersonNodeData } from "./PersonNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Bottom: "bottom", Left: "left", Right: "right", Top: "top" },
}));

describe("PersonNode asynchronous actions", () => {
  it("disables actions and shows deletion progress on the triggering button", () => {
    const data: PersonNodeData = {
      name: "Test Person",
      relationship: "You",
      isEgo: true,
      actionsDisabled: true,
      isDeleting: true,
      onDelete: () => undefined,
      onEdit: () => undefined,
    };

    const html = renderToStaticMarkup(
      <PersonNode
        {...({ data } as unknown as ComponentProps<typeof PersonNode>)}
      />,
    );

    expect(html).toContain('aria-label="Deleting Test Person"');
    expect(html).toContain("Deleting…");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
