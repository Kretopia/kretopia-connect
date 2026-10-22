import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../..");

/**
 * `--energy` is white in the dark themes (Midnight is the default), so white text on a solid `--energy` fill is
 * invisible there. The pair that always reads is `--energy-foreground`. Translucent fills (`/15`) are not solid
 * and are left alone.
 */
const SOLID_ENERGY_FILL = /bg-\[hsl\(var\(--energy\)\)\](?!\/)/;
const WHITE_TEXT = /(?<![\w-])text-white(?![\w-])/;

describe("solid --energy fills", () => {
  it("never carry white text: use text-[hsl(var(--energy-foreground))]", () => {
    const offenders: string[] = [];
    for (const entry of readdirSync(SRC, { recursive: true, encoding: "utf8" })) {
      if (!/\.tsx$/.test(entry) || /(^|\/)__tests__\//.test(entry) || /\.test\.tsx$/.test(entry)) continue;
      readFileSync(join(SRC, entry), "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (SOLID_ENERGY_FILL.test(line) && WHITE_TEXT.test(line)) offenders.push(`${entry}:${index + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
