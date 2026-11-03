import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(name) && !rel.includes("__tests__")) out.push(rel);
  }
  return out;
}
const SOURCES = walk("src");

describe("every call screen is sized the same way", () => {
  const CALL_SCREENS = [
    "src/components/project/VideoCallSheet.tsx",
    "src/components/project/StartCallSheet.tsx",
    "src/components/calls/PersistentCallWindow.tsx",
    "src/components/calls/GlobalVideoCallHost.tsx",
    "src/components/calls/GuestNameStep.tsx",
    "src/components/calls/CallEntryScreen.tsx",
    "src/pages/CallPage.tsx",
    "src/pages/GuestCall.tsx",
    "src/components/auth/GuestEntryChoice.tsx",
  ];

  it("no call screen sizes itself with a bare dvh class: an engine that does not know dvh would drop the height altogether", () => {
    for (const file of CALL_SCREENS) expect(read(file), file).not.toMatch(/(?:min-|max-)?h-\[\d+dvh\]|\b(?:min-|max-)?h-screen\b/);
  });

  it("the shared height rules give the vh line first and the dvh line after it", () => {
    const css = read("src/index.css");
    for (const rule of [".k-call-vh", ".k-call-min-vh", ".k-call-max-60vh", ".k-call-sheet", ".k-sheet-92"]) {
      const body = css.slice(css.indexOf(`${rule} {`)).split("}")[0];
      expect(body, rule).toMatch(/(?:min-|max-)?height: \d+vh;[^}]*(?:min-|max-)?height: \d+dvh/);
    }
    // the miniature's caps too
    for (const m of css.matchAll(/max-height: calc\(100dvh - (\d+)px\)/g)) expect(css).toContain(`max-height: calc(100vh - ${m[1]}px); max-height: calc(100dvh - ${m[1]}px)`);
  });
});

describe("Messages and Studio start the same call", () => {
  const IMPORT_PATH = "@/components/project/VideoCallSheet";

  it("every entry point imports the call from one path", () => {
    const importers = SOURCES.filter((file) => file !== "src/components/project/VideoCallSheet.tsx").filter((file) => /from\s+["'][^"']*VideoCallSheet["']/.test(read(file)));
    expect(importers.length).toBeGreaterThanOrEqual(17);
    for (const file of importers) {
      const specifiers = [...read(file).matchAll(/from\s+["']([^"']*VideoCallSheet)["']/g)].map((m) => m[1]);
      expect(specifiers, file).toEqual([IMPORT_PATH]);
    }
  });

  it("Messages (the chat header) and Studio (the project header) render that one component", () => {
    for (const file of ["src/pages/messages/ChatHeader.tsx", "src/components/project/SimpleProjectHeader.tsx"]) {
      const source = read(file);
      expect(source, file).toContain(`from "${IMPORT_PATH}"`);
      expect(source, file).toContain("<VideoCallSheet");
    }
  });

  it("the sheet is a facade over the shell's one call: it opens it through the context and renders none of its own", () => {
    const source = read("src/components/project/VideoCallSheet.tsx");
    expect(source).toContain("openStudioCall");
    expect(source).toMatch(/export (?:const|function) PersistentStudioCall\b/);
    expect(read("src/components/calls/GlobalVideoCallHost.tsx")).toContain("<PersistentStudioCall");
  });
});

describe("there is one call", () => {
  // Only two files create a Daily frame or call object: the one call (Studio, Messages, /meet and /call all start it) and the audio-only Sound Stage.
  const KNOWN = ["src/components/circle/SoundStageRoom.tsx", "src/components/project/VideoCallSheet.tsx"];

  it("only the known files create one", () => {
    const creators = SOURCES.filter((file) => file !== "src/lib/dailyFrame.ts").filter((file) => /createDailyFrameAsync\(|createCallObject\(|\.createFrame\(/.test(read(file)));
    expect(creators.sort()).toEqual(KNOWN);
  });

  it("/meet and /call start that call and own no frame, toolbar or controls", () => {
    for (const file of ["src/pages/CallPage.tsx", "src/pages/GuestCall.tsx"]) {
      const source = read(file);
      expect(source, file).toContain("<VideoCallSheet");
      expect(source, file).not.toMatch(/@daily-co|dailyFrame|CallMediaControls|PersistentCallWindow|k-call-header|k-call-footer|k-call-controls/);
    }
  });

  it("the meeting lobby and the meeting's own header, controls and context are gone", () => {
    expect(SOURCES.filter((file) => /from\s+["'][^"']*Greenroom["']/.test(read(file)))).toEqual([]);
    expect(SOURCES.some((file) => file.endsWith("/Greenroom.tsx"))).toBe(false);
    const context = read("src/contexts/VideoCallContext.tsx");
    expect(context).not.toMatch(/openMeeting|joinLive|mint-meeting-token|createDailyFrameAsync|startFrame/);
    expect(read("src/components/calls/GlobalVideoCallHost.tsx")).not.toMatch(/CallMediaControls|AdmitQueue|Copy invite link/);
  });

  it("every call has the same lobby and the same toolbar, because there is one of each", () => {
    expect(SOURCES.filter((file) => /export (?:const|function) PreCallLobby\b/.test(read(file)))).toEqual(["src/components/project/PreCallLobby.tsx"]);
    const toolbars = SOURCES.filter((file) => /<CallMediaControls[^>]*\btoolbar\b/.test(read(file)));
    expect(toolbars).toEqual(["src/components/project/VideoCallSheet.tsx"]);
  });
});
