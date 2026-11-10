import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A guard against the same mistake coming back: a QR code that encodes an identifier instead of a link. The Event pass encoded its check-in
 * token alone, so a phone that scanned it offered "255ec752…" to copy and send. Every QR in the app encodes a link now.
 */
const SRC = resolve(__dirname, "../..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const production = walk(SRC).filter((file) => /\.tsx?$/.test(file) && !/__tests__|\.test\./.test(file));
const source = (file: string) => readFileSync(join(SRC, file), "utf8");

describe("no QR code encodes a bare identifier", () => {
  const qrFiles = production.filter((file) => /QRCodeStyling\(|<QRCodeSVG|<KretopiaQRCode/.test(readFileSync(file, "utf8")));

  it("finds the QR surfaces, so the check below is not vacuous", () => {
    expect(qrFiles.length).toBeGreaterThanOrEqual(10);
    expect(qrFiles.map((f) => relative(SRC, f))).toEqual(expect.arrayContaining(["components/sessions/EventPassCard.tsx", "components/sessions/EventShareKit.tsx", "components/brand/KretopiaQRCode.tsx"]));
  });

  it("none of them is handed a token, an id or a hash as its payload", () => {
    for (const file of qrFiles) {
      const text = readFileSync(file, "utf8");
      // data: token / data={token} / value={token} / value={userId} / data={id}: an identifier as the whole payload
      expect(text, relative(SRC, file)).not.toMatch(/\bdata:\s*(token|id|userId|eventId|code|hash)\b\s*[,}]/);
      expect(text, relative(SRC, file)).not.toMatch(/<(QRCodeSVG|KretopiaQRCode)[^>]*\b(value|data)=\{(token|id|userId|eventId|code|hash)\}/);
    }
  });

  it("the Event pass encodes its public link, and the shared branded code refuses anything that is not one", () => {
    expect(source("components/sessions/EventPassCard.tsx")).toMatch(/publicUrl\(buildPassUrl\(eventId, token\)\)/);
    expect(source("components/sessions/EventPassCard.tsx")).toMatch(/data:\s*passLink/);
    expect(source("components/brand/KretopiaQRCode.tsx")).toMatch(/publicUrl\(data\)/);
    expect(source("components/sessions/EventShareKit.tsx")).toMatch(/publicUrl\(eventUrl\)/);
  });

  it("the check-in desk reads a link or a token through one function", () => {
    expect(source("components/sessions/EventCheckInDialog.tsx")).toMatch(/parsePassToken\(rawToken\)/);
  });
});
