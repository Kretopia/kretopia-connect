import { describe, expect, it } from "vitest";
import { colorTokenToHex, dailyThemeFromTokens } from "../callTheme";

describe("colorTokenToHex", () => {
  it("converts the app's bare H S% L% tokens", () => {
    expect(colorTokenToHex("0 0% 100%")).toBe("#ffffff");
    expect(colorTokenToHex("0 0% 0%")).toBe("#000000");
    expect(colorTokenToHex("0 0% 50%")).toBe("#808080");
    expect(colorTokenToHex("0 100% 50%")).toBe("#ff0000");
    expect(colorTokenToHex("60 100% 50%")).toBe("#ffff00");
    expect(colorTokenToHex("120 100% 50%")).toBe("#00ff00");
    expect(colorTokenToHex("180 100% 50%")).toBe("#00ffff");
    expect(colorTokenToHex("240 100% 50%")).toBe("#0000ff");
    expect(colorTokenToHex("300 100% 50%")).toBe("#ff00ff");
  });

  it("round-trips the Midnight background that index.css documents as exactly #05070D", () => {
    expect(colorTokenToHex("225 44.4444% 3.5294%")).toBe("#05070d");
  });

  it("reads the whitespace a computed custom property carries, and the hsl() notation", () => {
    expect(colorTokenToHex("  36 27% 97%\n")).toBe(colorTokenToHex("36 27% 97%"));
    expect(colorTokenToHex("hsl(36 27% 97%)")).toBe(colorTokenToHex("36 27% 97%"));
    expect(colorTokenToHex("hsl(36, 27%, 97%)")).toBe(colorTokenToHex("36 27% 97%"));
    expect(colorTokenToHex("hsl(36 27% 97% / 0.5)")).toBe(colorTokenToHex("36 27% 97%"));
  });

  it("passes a hex colour through, expanding the short form", () => {
    expect(colorTokenToHex("#05070D")).toBe("#05070d");
    expect(colorTokenToHex("#fff")).toBe("#ffffff");
  });

  it("wraps hues around and clamps out-of-range channels", () => {
    expect(colorTokenToHex("360 100% 50%")).toBe("#ff0000");
    expect(colorTokenToHex("-120 100% 50%")).toBe("#0000ff");
    expect(colorTokenToHex("0 150% 50%")).toBe("#ff0000");
  });

  it("returns null for anything else rather than sending Daily a value it rejects", () => {
    for (const value of ["", "   ", null, undefined, "red", "rgb(1 2 3)", "var(--primary)", "10 20 30", "#12", "#12345g"]) expect(colorTokenToHex(value as string)).toBeNull();
  });
});

describe("dailyThemeFromTokens", () => {
  const tokens: Record<string, string> = {
    "--primary": "0 0% 100%", "--primary-foreground": "225 44% 4%", "--background": "225 44.4444% 3.5294%", "--secondary": "222 22% 13%",
    "--foreground": "0 0% 100%", "--border": "222 22% 13%", "--card": "222 24% 9%", "--muted-foreground": "222 16% 71%",
  };

  it("gives Daily hex colours only, so its tray follows the theme", () => {
    const theme = dailyThemeFromTokens((token) => tokens[token] ?? "");
    expect(theme).not.toBeNull();
    const colors = Object.values(theme!.colors);
    expect(colors).toHaveLength(10);
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(theme!.colors.background).toBe("#05070d");
    expect(theme!.colors.mainAreaBg).toBe("#05070d");
    expect(theme!.colors.baseText).toBe("#ffffff");
    expect(theme!.colors.accent).toBe("#ffffff");
  });

  it("leaves out a colour whose token cannot be read, so Daily keeps its own for that one", () => {
    const theme = dailyThemeFromTokens((token) => (token === "--card" ? "" : tokens[token] ?? ""));
    expect(theme!.colors).not.toHaveProperty("mainAreaBgAccent");
    expect(theme!.colors.background).toBe("#05070d");
  });

  it("sends nothing when no token can be read (a document with no stylesheet)", () => {
    expect(dailyThemeFromTokens(() => "")).toBeNull();
  });
});
