import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("Stages wiring", () => {
  const app = read("src/App.tsx");

  it("every live-room route mounts the one Stages component, and none was dropped", () => {
    for (const path of ["/circle", "/circle/speed", "/circle/speed/:id", "/circle/speed/:id/recap", "/circle/stage/:id", "/events/backstage", "/soundstages"]) {
      expect(app).toMatch(new RegExp(`<Route path="${path.replace(/[/:]/g, (c) => `\\${c}`)}" element=\\{<Stages />\\}\\s*/>`));
    }
    expect(app).toContain('<Route path="/sound-stages" element={<Navigate to="/soundstages" replace />} />');
    // the routes that still point elsewhere keep doing so
    expect(app).toContain('<Route path="/circle/:circleId" element={<ProtectedRoute><CircleToCrewRedirect /></ProtectedRoute>} />');
    expect(app).toContain('<Route path="/match" element={<Match />} />');
  });

  it("the two pages Stages replaced are gone and nothing imports them", () => {
    expect(existsSync(resolve(root, "src/pages/Circle.tsx"))).toBe(false);
    expect(existsSync(resolve(root, "src/pages/SoundStages.tsx"))).toBe(false);
    expect(read("src/lib/routePrefetch.ts")).not.toMatch(/pages\/(Circle|SoundStages)"/);
    expect(app).not.toMatch(/pages\/(Circle|SoundStages)"/);
  });

  it("the parasite copy is gone from the Stages surface and its gate", () => {
    const files = ["src/pages/Stages.tsx", "src/components/ProfileActivationGate.tsx", "src/components/passport/PassportDraftCard.tsx", "src/components/agent/KretoTip.tsx", "src/components/circle/LiveCallsPanel.tsx"];
    for (const f of files) {
      const src = read(f);
      for (const gone of ["At least 1 Work Item", "Fast track", "import from a link", "Complete profile manually", "worth adding to your circle", "Suggest people"]) {
        expect(src, `${f} still has "${gone}"`).not.toContain(gone);
      }
    }
    expect(read("src/pages/Stages.tsx")).not.toMatch(/StudioSectionTabs|KretoTip|role="tablist"/);
  });

  it("the titles match the wireframes exactly", () => {
    const stages = read("src/pages/Stages.tsx");
    expect(stages).toContain('title="Stages."');
    expect(stages).toContain('accentTitle="Where creators meet, live."');
    expect(stages).toContain('label: "How this works"');
    const circle = read("src/pages/CreativeCircle.tsx");
    expect(circle).toContain('title="Creative Circle."');
    expect(circle).toContain('accentTitle="Invite with purpose."');
    expect(circle).toContain('subtitle="Track attributable invitations separately from your professional network. Benefits remain subject to verified eligibility and approval."');
    expect(circle).toContain('label: "How this works"');
  });

  it("the accent phrase uses the brand gradient the wireframes were drawn with (135deg, #4012F8 / #A516C5 35% / #F62489 65% / #FFA722)", () => {
    const css = read("src/index.css");
    expect(css).toMatch(/--k-g-1:\s*#4012F8;/i);
    expect(css).toMatch(/--k-g-2:\s*#A516C5;/i);
    expect(css).toMatch(/--k-g-3:\s*#F62489;/i);
    expect(css).toMatch(/--k-g-4:\s*#FFA722;/i);
    expect(css).toMatch(/--k-text-gradient:\s*linear-gradient\(\s*135deg,\s*var\(--k-g-1\) 0%,\s*var\(--k-g-2\) 35%,\s*var\(--k-g-3\) 65%,\s*var\(--k-g-4\) 100%\s*\)/);
    expect(css).toMatch(/\.k-gradient-text,[\s\S]*?box-decoration-break:\s*clone/);
  });

  it("Match owns discovery and the accepted-connections list, and Incoming's Browse button goes to Match Browse", () => {
    const match = read("src/pages/Match.tsx");
    expect(match).toContain('"connected"');
    expect(match).toContain("ConnectedCollaborators");
    expect(read("src/components/swipe/LikesYouGrid.tsx")).toContain('navigate("/match?tab=browse")');
    expect(read("src/components/swipe/LikesYouGrid.tsx")).not.toContain('navigate("/circle")');
  });
});
