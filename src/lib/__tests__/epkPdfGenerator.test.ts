import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The press kit PDF keeps the conversation on Kretopia: whatever social,
 * personal-site or booking URLs sit on the profile row, the document links to
 * the Passport on Kretopia and to the press pieces, and nowhere else.
 */

const links: string[] = [];
const texts: string[] = [];

vi.mock("jspdf", () => {
  class FakeDoc {
    internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 }, getNumberOfPages: () => 1 };
    GState = class { constructor(public opts: unknown) {} };
    constructor() {
      return new Proxy(this, {
        get(target, prop: string) {
          if (prop in target) return (target as unknown as Record<string, unknown>)[prop];
          if (prop === "link") return (_x: number, _y: number, _w: number, _h: number, o: { url: string }) => { links.push(o.url); };
          if (prop === "text") return (t: string | string[]) => { texts.push(Array.isArray(t) ? t.join(" ") : String(t)); return target; };
          if (prop === "getTextWidth") return () => 10;
          if (prop === "splitTextToSize") return (t: string) => [String(t)];
          if (prop === "getNumberOfPages") return () => 1;
          if (prop === "output") return () => new Blob();
          return () => target;
        },
      });
    }
  }
  return { default: FakeDoc };
});

import { generateEPKPdf } from "../epkPdfGenerator";

const USER_ID = "11111111-2222-3333-4444-555555555555";

const input = () => ({
  profile: {
    full_name: "Maya Laurent",
    user_id: USER_ID,
    role: "Motion Designer",
    bio: "I make things move.",
    location: "Paris, France",
    professional_skills: ["After Effects", "Cinema 4D"],
    // none of these may reach the document
    website: "https://maya.example.com",
    calendly_url: "https://calendly.com/maya/intro",
    linkedin_url: "https://linkedin.com/in/maya",
    instagram_url: "https://instagram.com/maya",
    twitter_url: "https://x.com/maya",
    youtube_url: "https://youtube.com/@maya",
    spotify_url: "https://open.spotify.com/artist/maya",
    behance_url: "https://behance.net/maya",
    imdb_url: "https://imdb.com/name/nm1",
    soundcloud_url: "https://soundcloud.com/maya",
  },
  credits: [{ project_name: "Nord", role: "Motion lead", year: 2025 }],
  awards: [],
  pressLinks: [{ id: "p1", title: "Profile in Variety", publication: "Variety", url: "https://variety.com/maya-profile" }],
  industryStats: [],
  reviews: [],
});

beforeEach(() => {
  links.length = 0;
  texts.length = 0;
});

describe("generateEPKPdf", () => {
  it("links to no social network, personal site or booking page", async () => {
    // the profile type no longer carries those fields; the data does, as it does at runtime
    await generateEPKPdf(input() as never);
    const bad = ["linkedin", "instagram", "x.com", "twitter", "youtube", "spotify", "behance", "imdb", "soundcloud", "maya.example.com", "calendly"];
    for (const host of bad) expect(links.some((l) => l.includes(host))).toBe(false);
    for (const word of ["LinkedIn", "Instagram", "YouTube", "Spotify", "Website", "Book a Call", "X (Twitter)"]) {
      expect(texts.some((t) => t.includes(word))).toBe(false);
    }
  });

  it("links to the Passport by user id, which is what /epk/:id resolves", async () => {
    await generateEPKPdf(input() as never);
    expect(links.some((l) => l.endsWith(`/epk/${USER_ID}`))).toBe(true);
    expect(links.some((l) => /\/epk\/maya-laurent$/.test(l))).toBe(false);
  });

  it("keeps the press pieces, which are credentials rather than a link out of Kretopia's context", async () => {
    await generateEPKPdf(input() as never);
    expect(links).toContain("https://variety.com/maya-profile");
  });
});
