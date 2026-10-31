import { describe, expect, it } from "vitest";
import { installUnsafeLinkGuard, safeHref } from "@/lib/safeUrl";

describe("safeHref", () => {
  it.each(["javascript:alert(1)", " JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "data:text/html,<b>x", "vbscript:x"])(
    "rejects %s",
    (u) => expect(safeHref(u)).toBeUndefined(),
  );
  it.each(["https://kretopia.com", "http://a.b/c", "mailto:a@b.c", "tel:+33", "/passport", "#top"])(
    "allows %s",
    (u) => expect(safeHref(u)).toBe(u),
  );
});

describe("installUnsafeLinkGuard", () => {
  it("cancels clicks on javascript: links and hardens new-tab links", () => {
    const off = installUnsafeLinkGuard(document);
    const bad = document.createElement("a");
    bad.setAttribute("href", "javascript:alert(1)");
    const good = document.createElement("a");
    good.href = "https://example.com";
    good.target = "_blank";
    document.body.append(bad, good);
    const e1 = new MouseEvent("click", { bubbles: true, cancelable: true });
    bad.dispatchEvent(e1);
    expect(e1.defaultPrevented).toBe(true);
    good.addEventListener("click", (e) => e.preventDefault());
    good.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(good.rel).toContain("noopener");
    off();
  });
});
