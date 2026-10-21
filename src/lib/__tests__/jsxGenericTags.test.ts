import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The Lovable dev tagger rewrites every JSX opening tag to add data-lov-* attributes, and it cannot parse a tag that
// carries explicit type arguments, such as `<Showcase<Piece> items={...} />`: the dev server answers 500 for that module
// and the page shows "Something went wrong" in the editor preview, while tsc, vitest and the production build all pass.
// Let inference decide the type, or move the generic into a small typed wrapper.
const JSX_GENERIC_TAG = /(^|[\s(){&|?:>])<[A-Z][\w.]*<[^<>\n]+(<[^<>\n]*>)*>\s+[A-Za-z_{/>]/m;

function* tsxFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== "__tests__" && name !== "node_modules") yield* tsxFiles(path); }
    else if (name.endsWith(".tsx") && !name.endsWith(".test.tsx")) yield path;
  }
}

describe("JSX generic tags", () => {
  it("the check recognises the shape that broke the dev server, and not ordinary generics", () => {
    expect(JSX_GENERIC_TAG.test("  <PassportShowcase<PortfolioItem> pieces={x} />")).toBe(true);
    expect(JSX_GENERIC_TAG.test("<Table<Row>\n  rows={rows}")).toBe(true); // the multi-line form breaks it the same way
    expect(JSX_GENERIC_TAG.test("const [a, setA] = useState<Partial<Client> | null>(null);")).toBe(false);
    expect(JSX_GENERIC_TAG.test("const x: Promise<Array<string>> = load();")).toBe(false);
    expect(JSX_GENERIC_TAG.test("type A = Record<string, Map<Key, Set<Value>>> ;")).toBe(false);
    expect(JSX_GENERIC_TAG.test("<Button variant=\"x\">Save</Button>")).toBe(false);
  });

  it("no component in src puts type arguments on a JSX tag", () => {
    const offenders = [...tsxFiles("src")].filter((file) => JSX_GENERIC_TAG.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
