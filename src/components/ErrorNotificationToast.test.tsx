import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ErrorNotificationToast } from "./ErrorNotificationToast";

describe("ErrorNotificationToast", () => {
  it("renders an accessible bottom-left error notification", () => {
    const html = renderToStaticMarkup(
      <ErrorNotificationToast
        message="The operation failed."
        onDismiss={() => undefined}
      />,
    );

    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("fixed bottom-5 left-5");
    expect(html).toContain("The operation failed.");
    expect(html).toContain('aria-label="Dismiss error notification"');
  });
});
