import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyProductFile,
  deliverableProductFiles,
} from "../../../supabase/functions/_shared/productFilePaths";

const SELLER = "0f3c1d6e-7a45-4b1b-9b52-0c1f2a3b4c5d";
const VICTIM = "9a8b7c6d-1111-4222-8333-444455556666";

describe("classifyProductFile: a seller's product may only deliver the seller's own files", () => {
  it("accepts a path inside the seller's own folder", () => {
    expect(classifyProductFile(`${SELLER}/1700000000-ab12.zip`, SELLER)).toBe("owned");
    expect(classifyProductFile(`${SELLER}/nested/folder/file.pdf`, SELLER)).toBe("owned");
  });

  it("refuses another seller's folder (the file-path injection)", () => {
    expect(classifyProductFile(`${VICTIM}/their-paid-pack.zip`, SELLER)).toBe("foreign");
  });

  it("refuses traversal, absolute and malformed paths", () => {
    for (const p of [
      `${SELLER}/../${VICTIM}/x.zip`,
      `../${VICTIM}/x.zip`,
      `/${SELLER}/x.zip`,
      `${SELLER}//x.zip`,
      `${SELLER}/./x.zip`,
      `${SELLER}\\..\\${VICTIM}\\x.zip`,
      `${SELLER}`,
      `${SELLER}/`,
      "",
    ]) {
      expect(classifyProductFile(p, SELLER)).toBe("foreign");
    }
  });

  it("refuses a path when the seller is unknown", () => {
    expect(classifyProductFile(`${SELLER}/x.zip`, null)).toBe("foreign");
    expect(classifyProductFile(`${SELLER}/x.zip`, undefined)).toBe("foreign");
    expect(classifyProductFile(`${SELLER}/x.zip`, "")).toBe("foreign");
  });

  it("refuses a sibling folder that merely starts with the seller id", () => {
    expect(classifyProductFile(`${SELLER}-evil/x.zip`, SELLER)).toBe("foreign");
  });

  it("refuses non-strings", () => {
    for (const p of [null, undefined, 42, {}, ["a"]]) expect(classifyProductFile(p, SELLER)).toBe("foreign");
  });

  it("passes absolute http(s) URLs through as external (legacy data, never signed)", () => {
    expect(classifyProductFile("https://cdn.example.com/a.zip", SELLER)).toBe("external");
    expect(classifyProductFile("http://cdn.example.com/a.zip", SELLER)).toBe("external");
  });
});

describe("deliverableProductFiles", () => {
  it("keeps owned and external entries in their order and drops foreign ones", () => {
    const list = [`${SELLER}/a.zip`, `${VICTIM}/b.zip`, "https://cdn.example.com/c.zip", `${SELLER}/../${VICTIM}/d.zip`];
    expect(deliverableProductFiles(list, SELLER)).toEqual([`${SELLER}/a.zip`, "https://cdn.example.com/c.zip"]);
  });

  it("returns nothing for a missing or non-array column", () => {
    for (const v of [null, undefined, "path", {}]) expect(deliverableProductFiles(v, SELLER)).toEqual([]);
  });
});

describe("signing functions: wiring", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

  it("get-download-urls filters both product reads before anything is signed", () => {
    const source = read("get-download-urls/index.ts");
    expect(source.match(/deliverableProductFiles\(product\?\.file_urls, product\?\.user_id\)/g)?.length).toBe(2);
    expect(source).not.toContain("filePaths = product?.file_urls");
    expect(source.indexOf("deliverableProductFiles(product?.file_urls")).toBeLessThan(source.indexOf(".createSignedUrl("));
  });

  it("complete-product-purchase filters the product files before signing or storing them", () => {
    const source = read("complete-product-purchase/index.ts");
    expect(source).toContain("deliverableProductFiles(product.file_urls, product.user_id)");
    expect(source).not.toContain("= product.file_urls || []");
    expect(source.indexOf("deliverableProductFiles(product.file_urls")).toBeLessThan(source.indexOf(".createSignedUrl("));
  });

  it("stripe-marketplace-webhook signs only the filtered files and never falls back to the raw column", () => {
    const source = read("stripe-marketplace-webhook/index.ts");
    expect(source).toContain("deliverableProductFiles(product.file_urls, product.user_id)");
    expect(source).not.toContain("downloadUrls = product.file_urls");
    expect(source.indexOf("deliverableProductFiles(product.file_urls")).toBeLessThan(source.indexOf(".createSignedUrl(filePath"));
  });
});
