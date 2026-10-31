import { describe, it, expect } from "vitest";
import { safeQrPayload } from "@/lib/safeUrl";

describe("safeQrPayload", () => {
  it("accepts absolute https profile URLs", () => {
    expect(safeQrPayload("https://www.kretopia.com/@noe")).toBe("https://www.kretopia.com/@noe");
  });
  it("rejects script and data schemes", () => {
    expect(safeQrPayload("javascript:alert(1)")).toBeUndefined();
    expect(safeQrPayload("data:text/html,<script>x</script>")).toBeUndefined();
  });
  it("rejects relative paths, control chars and oversized payloads", () => {
    expect(safeQrPayload("/@noe")).toBeUndefined();
    expect(safeQrPayload("https://kretopia.com/\u0000x")).toBeUndefined();
    expect(safeQrPayload("https://kretopia.com/" + "a".repeat(2100))).toBeUndefined();
  });
});
