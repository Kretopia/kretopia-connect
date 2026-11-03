import { describe, expect, it } from "vitest";
import { entryChoiceKey, signInHref } from "@/lib/entryChoice";
import { isInAppPath } from "@/lib/inAppPath";

describe("signInHref", () => {
  it("asks the sign-in page to bring the person back to the same link, query string included", () => {
    expect(signInHref("/meet/abc?t=xyz")).toBe("/auth?redirect=%2Fmeet%2Fabc%3Ft%3Dxyz");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", "meet/abc"])("falls back to the home page for %s", (bad) => {
    expect(signInHref(bad)).toBe("/auth?redirect=%2F");
  });
});

describe("entryChoiceKey", () => {
  it("is scoped to the entry, so a choice for one invitation is never reused for another", () => {
    expect(entryChoiceKey("meet:a")).not.toBe(entryChoiceKey("meet:b"));
    expect(entryChoiceKey("meet:a")).toBe(entryChoiceKey("meet:a"));
  });
});

describe("isInAppPath", () => {
  it.each(["/", "/meet/abc?t=1", "/passport/x?tab=stamps&filter=verified"])("accepts %s", (ok) => expect(isInAppPath(ok)).toBe(true));
  it.each(["//host", "/\\host", "https://host", "/x?next=https://host", "http:/host", "javascript:alert(1)", "", null, undefined, 42])("rejects %s", (bad) =>
    expect(isInAppPath(bad)).toBe(false),
  );
});
