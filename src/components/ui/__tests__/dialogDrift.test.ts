import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Every modal of a signed-in member wears the Passport QR modal's surface (ui/dialogBrand.tokens.ts), through the dialog, alert dialog and
// sheet primitives. A modal that paints its own background, border, shadow or gradient opts out of it, so this fails when one does,
// unless the file is listed below with the reason it is meant to look different. The list is checked both ways: an entry whose modal no
// longer overrides the surface is stale and must go.
const ROOT = process.cwd();
const OPENERS = ["DialogContent", "AlertDialogContent", "SheetContent"];

const ALLOWED: Record<string, string> = {
  "src/components/messages/ImageLightbox.tsx": "a lightbox: the picture is the surface, full-bleed black",
  "src/components/circle/CircleMessageBubble.tsx": "a media viewer, full-bleed black",
  "src/components/project/studio/MoodboardViewer.tsx": "a media viewer, full-bleed black",
  "src/pages/ProjectReview.tsx": "a video review player on black",
  "src/components/sessions/GuestPassDialog.tsx": "the pass card is the surface; the dialog around it is transparent",
  "src/components/sessions/EventHeroCard.tsx": "a destructive confirmation keeps its destructive border and glow as a cue",
  "src/components/NewsletterPopup.tsx": "a visitor's popup, never shown to a signed-in member",
  "src/components/scene/MagazineArticleModal.tsx": "the public magazine reader keeps its own frame",
  "src/components/project/VideoCallSheet.tsx": "the video call surface (k-call-surface) is the call's own frame",
};

/** A class that paints the surface: a background, a border colour (or none), a shadow, or a gradient stop. A border on one side is layout. */
const SURFACE = /(?:^|[\s"'`{])(?:[a-z0-9-]+:)*(?:bg-|border-(?!(?:t|b|l|r|x|y)(?:-\d+)?(?:[\s"'`}]|$))|shadow-|from-|via-|to-)[^\s"'`}]*/;

/** The same thing painted inline. */
const INLINE = /\b(?:backgroundColor|background|boxShadow|borderColor)\s*:/;

/** The opening tags of `<Name ...>` in a source, read to the first `>` outside quotes and braces (a class like `[&>button]:hidden` has one inside). */
function openingTags(source: string, name: string): string[] {
  const tags: string[] = [];
  const pattern = new RegExp(`<${name}(?=[\\s>/])`, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    let depth = 0;
    let quote = "";
    let i = match.index;
    for (; i < source.length; i++) {
      const c = source[i];
      if (quote) { if (c === quote && source[i - 1] !== "\\") quote = ""; continue; }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    tags.push(source.slice(match.index, i + 1));
  }
  return tags;
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "__tests__" || entry === "__preview__" ? [] : walk(path);
    return /\.tsx$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
  });

const files = walk(join(ROOT, "src"))
  .map((path) => relative(ROOT, path))
  .filter((path) => !path.startsWith("src/components/ui/"));

const overriding = (file: string) =>
  OPENERS.flatMap((name) => openingTags(readFileSync(join(ROOT, file), "utf8"), name)).filter((tag) => SURFACE.test(tag) || INLINE.test(tag));

describe("authenticated modals keep the shared surface", () => {
  it("finds the modals it is meant to police", () => {
    const using = files.filter((f) => OPENERS.some((name) => readFileSync(join(ROOT, f), "utf8").includes(`<${name}`)));
    expect(using.length).toBeGreaterThan(100);
  });

  it("no modal paints its own background, border, shadow or gradient, except the listed ones", () => {
    const offenders = files
      .filter((f) => !(f in ALLOWED))
      .map((f) => [f, overriding(f)] as const)
      .filter(([, tags]) => tags.length > 0)
      .map(([f, tags]) => `${f}: ${tags[0].replace(/\s+/g, " ").slice(0, 140)}`);
    expect(offenders, `These modals override the shared surface. Remove the classes, or list the file with its reason:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("every listed exception still overrides it: a fixed modal comes off the list", () => {
    for (const [file, reason] of Object.entries(ALLOWED)) {
      expect(overriding(file).length, `${file} (${reason}) no longer overrides the surface: remove it from ALLOWED`).toBeGreaterThan(0);
    }
  });

  it("and the guard itself can fail: it sees a background, a border colour, none, a shadow and a gradient, and lets layout through", () => {
    const flagged = (className: string) => SURFACE.test(`<DialogContent className="${className}">`);
    for (const bad of ["bg-background", "max-w-md bg-card", "border-0", "border-none", "border-primary/20", "shadow-lg", "from-primary/10", "sm:bg-muted", "p-0 border-border"]) {
      expect(flagged(bad), bad).toBe(true);
    }
    for (const fine of ["max-w-md p-0 overflow-hidden", "sm:max-w-[600px] max-h-[90vh] overflow-y-auto", "h-[100dvh] sm:rounded-lg [&>button:last-child]:hidden", "gap-0 border-t", "z-[90] text-center"]) {
      expect(flagged(fine), fine).toBe(false);
    }
  });

  it("also sees a surface painted inline", () => {
    const tag = openingTags('<DialogContent className="max-w-sm" style={{ backgroundColor: "red" }}>x</DialogContent>', "DialogContent")[0];
    expect(SURFACE.test(tag)).toBe(false);
    expect(INLINE.test(tag)).toBe(true);
  });

  it("reads a tag whose class list contains a '>'", () => {
    const tags = openingTags('<DialogContent className="max-w-sm [&>button]:hidden bg-black">x</DialogContent>', "DialogContent");
    expect(tags).toHaveLength(1);
    expect(SURFACE.test(tags[0])).toBe(true);
  });
});

// An overlay that is a modal but not a Radix dialog (a bottom action sheet, a full-screen create flow) draws its own backdrop and panel, so the
// primitives cannot dress it. It takes the QR modal's backdrop, surface and title from useModalSurfaceClasses instead, and keeps its own
// geometry, animation, focus handling and dismissal. Any file that draws a `role="dialog"` of its own must do that, or be listed here with the
// reason it is not that kind of modal, so a new one cannot quietly paint its own.
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");
/** The attribute in JSX (a querySelector string such as '[role="dialog"]' has no space before it). */
const DRAWS_A_DIALOG = /\srole="dialog"/;

const WEARS_THE_SURFACE = [
  "src/components/QuickActionFab.tsx",
  "src/components/thrivepay/SnapReceiptFAB.tsx",
  "src/components/project/studio/VoiceFirstCreateModal.tsx",
];

const NOT_THAT_KIND_OF_MODAL: Record<string, string> = {
  "src/components/desk/ThriveAgentFab.tsx": "the docked Kreto chat: a widget in the corner with no backdrop, not a modal over the page",
  "src/components/epk/EPKPdfEditor.tsx": "a full-screen document editor: the workspace itself, not a card over the page",
};

describe("overlays that are not Radix dialogs keep the shared surface too", () => {
  const drawing = files.filter((file) => DRAWS_A_DIALOG.test(read(file)));

  it("finds the overlays it is meant to police", () => {
    expect(drawing.length).toBeGreaterThanOrEqual(WEARS_THE_SURFACE.length);
  });

  it("every file that draws a dialog of its own wears the surface or is listed as not that kind of modal", () => {
    const unlisted = drawing.filter((file) => !WEARS_THE_SURFACE.includes(file) && !(file in NOT_THAT_KIND_OF_MODAL));
    expect(unlisted, `These draw their own role="dialog". Take the surface from useModalSurfaceClasses, or list the file with its reason:\n${unlisted.join("\n")}`).toEqual([]);
  });

  it("and the lists are not stale: each file in them still draws a dialog", () => {
    for (const file of [...WEARS_THE_SURFACE, ...Object.keys(NOT_THAT_KIND_OF_MODAL)]) {
      expect(drawing, `${file} no longer draws a role="dialog"; remove it from the list`).toContain(file);
    }
  });

  // What each of them wrote on its backdrop and panel before. It is now handed to the hook as what a visitor sees, and is no longer on the elements.
  const PAINTED_BEFORE: Record<string, string[]> = {
    "src/components/QuickActionFab.tsx": ["lg:hidden bg-background/70", "bg-card border border-border/60 rounded-2xl shadow-2xl"],
    "src/components/thrivepay/SnapReceiptFAB.tsx": ['className="absolute inset-0 bg-background/80"', "rounded-t-2xl border bg-background shadow-2xl"],
    "src/components/project/studio/VoiceFirstCreateModal.tsx": ["overflow-y-auto bg-background/95 backdrop-blur-sm", "border border-primary/10 bg-card shadow-xl shadow-primary/5"],
  };

  it.each(WEARS_THE_SURFACE)("%s takes its backdrop and panel from useModalSurfaceClasses and no longer paints its own", (file) => {
    const source = read(file);
    expect(source).toMatch(/import \{ useModalSurfaceClasses \} from "@\/components\/ui\/modalSurface"/);
    expect(source).toContain("modal.backdrop");
    expect(source).toContain("modal.panel");
    for (const painted of PAINTED_BEFORE[file]) expect(source, `${file} paints "${painted}" itself again`).not.toContain(painted);
  });
});
