import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { editEPKDocument, epkPassportPath } from "../epkDocument";

describe("original EPK preservation", () => {
  it("retains every original page, page dimensions and embedded content", async () => {
    const source = await PDFDocument.create();
    source.addPage([400, 600]).drawText("Original creator biography");
    source.addPage([800, 400]).drawText("Original portfolio artwork");
    const bytes = await source.save();
    const result = await PDFDocument.load(await editEPKDocument(bytes, [{ index: 0, rotation: 0 }, { index: 1, rotation: 0 }]));
    expect(result.getPageCount()).toBe(2);
    expect(result.getPages().map(p => p.getSize())).toEqual([{ width: 400, height: 600 }, { width: 800, height: 400 }]);
    expect(result.getPage(0).node.Contents()).toBeDefined();
  });
  it("only reorders, rotates or removes pages on explicit edits", async () => {
    const source = await PDFDocument.create();
    source.addPage([400, 600]); source.addPage([800, 400]); source.addPage([200, 300]);
    const result = await PDFDocument.load(await editEPKDocument(await source.save(), [{ index: 1, rotation: 90 }, { index: 0, rotation: 0 }]));
    expect(result.getPageCount()).toBe(2);
    expect(result.getPage(0).getSize()).toEqual({ width: 800, height: 400 });
    expect(result.getPage(0).getRotation().angle).toBe(90);
  });
  it("scopes each published EPK to its own Passport owner", () => {
    expect(epkPassportPath("creator-a")).toBe("creator-a/epk/passport.pdf");
    expect(epkPassportPath("creator-b")).toBe("creator-b/epk/passport.pdf");
  });
});