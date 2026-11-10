import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RedirectKeepingSearch } from "@/components/RedirectKeepingSearch";
import { SCOUT_PATH } from "@/lib/opportunityRoutes";
import { FOUNDING_STATUS_PATH } from "@/lib/foundingMember";

/**
 * The consolidation: Scout inside Opportunities, Perks and the Founding status inside Creative Circle, one entry point each.
 * What is checked here is that nothing that used to work stops working (old addresses redirect, they do not 404), that the gates did not
 * move, and that Passport and Match were left alone.
 */
const SRC = resolve(__dirname, "../..");
const read = (file: string) => readFileSync(join(SRC, file), "utf8");
const app = read("App.tsx");

const Where = () => {
  const { pathname, search, hash } = useLocation();
  return <output data-testid="where">{pathname + search + hash}</output>;
};
const landsOn = (from: string) => {
  const { unmount } = render(
    <MemoryRouter initialEntries={[from]}>
      <Routes>
        <Route path="/scout" element={<RedirectKeepingSearch to={SCOUT_PATH} />} />
        <Route path="/founding-member" element={<RedirectKeepingSearch to={FOUNDING_STATUS_PATH} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  const where = screen.getByTestId("where").textContent;
  unmount();
  return where;
};

describe("the old addresses redirect, with what they carried", () => {
  it("/scout lands on Scout inside Opportunities, keeping its tab, its search and its hash", () => {
    expect(landsOn("/scout")).toBe("/opportunities/scout");
    expect(landsOn("/scout?tab=all&q=film%20score#results")).toBe("/opportunities/scout?tab=all&q=film+score#results");
  });

  it("/founding-member lands on the Founding status in Creative Circle", () => {
    expect(landsOn("/founding-member")).toBe("/creative-circle#founding");
    expect(landsOn("/founding-member?ref=email")).toBe("/creative-circle?ref=email#founding");
  });
});

describe("App.tsx: every moved surface keeps its route and its gate", () => {
  it("declares the redirects, so an old link, bookmark or email is never a 404", () => {
    expect(app).toMatch(/<Route path="\/scout" element=\{<RedirectKeepingSearch to=\{SCOUT_PATH\} \/>\} \/>/);
    expect(app).toMatch(/<Route path="\/founding-member" element=\{<RedirectKeepingSearch to=\{FOUNDING_STATUS_PATH\} \/>\} \/>/);
  });

  it("keeps Scout, Perks and Creative Circle behind the same sign-in gate as before", () => {
    expect(app).toMatch(/<Route path=\{SCOUT_PATH\} element=\{<ProtectedRoute><Scout \/><\/ProtectedRoute>\} \/>/);
    expect(app).toMatch(/<Route path="\/perks" element=\{<ProtectedRoute><PerksTab \/><\/ProtectedRoute>\} \/>/);
    expect(app).toMatch(/<Route path="\/creative-circle" element=\{<ProtectedRoute><CreativeCircle \/><\/ProtectedRoute>\} \/>/);
  });

  it("keeps the Perks deep link and the public Opportunities feed where they were", () => {
    expect(app).toMatch(/<Route path="\/perks" /);
    expect(app).toMatch(/<Route path="\/opportunities" element=\{<Opportunities \/>\} \/>/);
  });

  it("leaves Passport and Match alone: neither is merged, redirected or renamed", () => {
    expect(app).toMatch(/<Route path="\/match" element=\{<Match \/>\} \/>/);
    expect(app).toMatch(/<Route path="\/passport" element=\{<PassportDirectory \/>\} \/>/);
  });
});

describe("navigation has one entry per role, and none of the retired ones", () => {
  const navbar = read("components/Navbar.tsx");
  const bottomNav = read("components/nav/KretopiaBottomNav.tsx");
  const footer = read("components/landing/kretopia/EditorialFooter.tsx");

  it("no nav, menu, bottom bar or footer entry points at Scout's old address, Perks or the Founding page", () => {
    for (const [name, source] of [["Navbar", navbar], ["KretopiaBottomNav", bottomNav], ["EditorialFooter", footer]] as const) {
      expect(source, `${name}: /scout`).not.toMatch(/["'`]\/scout["'`?]/);
      expect(source, `${name}: /perks`).not.toMatch(/["'`]\/perks["'`]/);
      expect(source, `${name}: /founding-member`).not.toMatch(/["'`]\/founding-member["'`]/);
    }
  });

  it("the desktop bar for a member is Today, Match, Studio, Opportunities, Passport: Match right after Today", () => {
    expect(navbar).toMatch(
      /\{ path: "\/", icon: Sun, label: "Today" \},\s*(\/\/[^\n]*\n\s*)*\{ path: "\/match", icon: Heart, label: "Match" \},\s*\{ path: "\/desk", icon: LayoutGrid, label: "Studio" \},\s*\{ path: OPPORTUNITIES_PATH, icon: Compass, label: "Opportunities" \},\s*\{ path: "\/profile", icon: BadgeCheck, label: "Passport" \}/,
    );
  });

  it("the landing chapter CTA with the hero's label lands in the same place as the hero's button", () => {
    expect(read("components/landing/kretopia/LandingBelowFold.tsx")).toMatch(/href=\{SCOUT_PATH\}\s+ctaLabel="Explore Opportunities"/);
    expect(read("components/landing/KretopiaHero.tsx")).toMatch(/to=\{SCOUT_PATH\}/);
    expect(read("components/landing/KretopiaHero.tsx")).toMatch(/to="\/match"/);
  });

  it("Perks is reached from Creative Circle, as its Member benefits", () => {
    expect(read("pages/CreativeCircle.tsx")).toMatch(/to="\/perks"/);
  });
});
