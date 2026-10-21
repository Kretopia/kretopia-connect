import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The branded QR is always drawn on white paper, so its ink and accent must stay dark in every theme. The accent used
// to follow --energy, which is white in the dark themes: the end of the gradient disappeared and the code did not scan.
const css = readFileSync("src/index.css", "utf8");

const declaration = (name: string): string[] => [...css.matchAll(new RegExp(`${name}:\\s*([^;]+);`, "g"))].map((m) => m[1].trim());

describe("QR palette tokens", () => {
  it("keeps white paper and dark ink", () => {
    expect(declaration("--qr-paper")).toEqual(["0 0% 100%"]);
    expect(declaration("--qr-ink")).toEqual(["240 11% 8%"]);
  });

  it("never lets the page-wide accent colour into the code", () => {
    for (const value of declaration("--qr-accent")) {
      expect(value).not.toMatch(/--energy|--primary|--foreground|--accent/);
    }
  });

  it("gives the code an accent that is as dark as its ink wherever the root sets it", () => {
    expect(declaration("--qr-accent")[0]).toBe("var(--qr-ink)");
  });
});
