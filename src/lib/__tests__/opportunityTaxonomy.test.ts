import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_IDS, categoryOf, classifyFamilies, classifyLevel, classifyOpportunity, classifyWorkMode, cleanTitle, detectLanguage, fixMojibake, type CategoryId } from "../opportunityTaxonomy";

// Titles as the job boards publish them: the first block is real (Jobicy and Remote OK postings read on 2026-10-29), the second covers the
// creative crafts the boards carry less of. One table, so a rule change shows exactly which title moved.
const FAMILIES: [string, CategoryId][] = [
  // real postings
  ["Creative Director - Brand Narrative", "creative-direction"],
  ["Art Director", "creative-direction"],
  ["Director of Brand and Creative", "creative-direction"],
  ["Product Design Director", "product-ux"],
  ["Director of Product Design", "product-ux"],
  ["Manager, Product Design, Growth (Upper Funnel)", "product-ux"],
  ["Senior Product Designer - Compute, Nebius Console", "product-ux"],
  ["Content Designer II (Remote Eligible - Costa Rica)", "product-ux"],
  ["Lead Product Designer", "product-ux"],
  ["Brand Experience Designer, Consumer", "design-brand"],
  ["Graphic Designer (Permanent work from home)", "design-brand"],
  ["Senior Manager, Visual Design", "design-brand"],
  ["Sr. Marketing Designer", "design-brand"],
  ["Lead Brand Designer", "design-brand"],
  ["Creative (Graphic Designer)", "design-brand"],
  ["Video Editor", "video-motion"],
  ["Creative (Motion Design)", "video-motion"],
  ["Post-Production Lead", "video-motion"],
  ["UI Artist for Games", "games-3d"],
  ["Audio Engineering (Freelance)", "audio-music"],
  ["Content Creator", "social-community"],
  ["Generative Content Creator", "social-community"],
  ["Senior Software Engineer", "engineering"],
  ["Senior DevOps Engineer", "engineering"],
  ["Sr React Native", "engineering"],
  ["Solutions Engineer", "engineering"],
  ["Software Engineer AI Coding Tasks", "engineering"],
  ["Associate Data Scientist", "data-ai"],
  ["AI Trainer", "data-ai"],
  ["Principal Product Manager Strategic Initiatives", "product-program"],
  ["Project Manager", "product-program"],
  ["Senior Growth Product Manager AI Native", "product-program"],
  ["Account Executive", "sales-accounts"],
  ["Technical Account Manager", "sales-accounts"],
  ["Sales Development Representative German Speaking", "sales-accounts"],
  ["Senior Finance Manager Management Accountant", "ops-finance-people"],
  ["People Operations Coordinator", "ops-finance-people"],
  ["Customer Support Specialist", "ops-finance-people"],
  ["Marketing Student Assistant", "marketing"],
  ["VP Pricing & Packaging", "other"],
  ["Senior Specialist Global QMS", "other"],
  // the crafts
  ["Freelance Photographer (Lifestyle)", "photo"],
  ["Photo Retoucher", "photo"],
  ["Character Animator", "video-motion"],
  ["Motion Graphics Artist", "video-motion"],
  ["Videographer", "video-motion"],
  ["Colorist", "video-motion"],
  ["Podcast Producer", "audio-music"],
  ["Sound Designer", "audio-music"],
  ["Music Composer for Games", "audio-music"],
  ["Voice Over Artist", "audio-music"],
  ["Social Media Manager", "social-community"],
  ["UGC Creator", "social-community"],
  ["Community Manager (Discord)", "social-community"],
  ["Copywriter", "writing-content"],
  ["Senior Content Writer", "writing-content"],
  ["Technical Writer", "writing-content"],
  ["Editorial Assistant", "writing-content"],
  ["Illustrator", "illustration-art"],
  ["Concept Artist", "illustration-art"],
  ["Storyboard Artist", "illustration-art"],
  ["Technical Artist (Unreal Engine)", "games-3d"],
  ["Game Designer", "games-3d"],
  ["Environment Artist", "games-3d"],
  ["Associate Creative Director", "creative-direction"],
  ["Brand Strategist", "creative-direction"],
  ["Packaging Designer", "design-brand"],
  ["Fashion Designer", "design-brand"],
  ["UX Researcher", "product-ux"],
  ["UI Designer", "product-ux"],
  ["Design Engineer", "product-ux"],
  ["Performance Marketing Manager", "marketing"],
  ["SEO Specialist", "marketing"],
  ["Machine Learning Engineer", "data-ai"],
  ["Werkstudent Grafikdesign (m/w/d)", "design-brand"],
  ["Texter / Redakteur (m/w/d)", "writing-content"],
  ["Fotograf (m/w/d)", "photo"],
  // other languages: accents do not matter
  ["Fotógrafo en España", "photo"],
  ["Designer Júnior - Geração de Demanda", "design-brand"],
  ["Diretor de Arte Sênior", "creative-direction"],
  ["Redator Publicitário", "writing-content"],
  ["Freelance: Photographie, Vidéo et Drone", "video-motion"],
];

describe("families", () => {
  it.each(FAMILIES)("%s -> %s", (title, id) => {
    expect(classifyFamilies(title).primary).toBe(id);
  });

  it("every family has a definition, in display order, creative ones first, 'other' last", () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([...CATEGORY_IDS]);
    expect(CATEGORIES[CATEGORIES.length - 1].id).toBe("other");
    const groups = CATEGORIES.map((c) => c.group);
    expect(groups.indexOf("other")).toBeGreaterThan(groups.lastIndexOf("creative"));
    expect(categoryOf("video-motion").group).toBe("creative");
    expect(categoryOf("engineering").group).toBe("other");
  });

  it("a posting that names two crafts is sorted under the first and found under both", () => {
    const f = classifyFamilies("Graphic Designer & Video Editor");
    expect(f.primary).toBe("design-brand");
    expect(f.secondary).toEqual(["video-motion"]);
    expect(classifyFamilies("3D Animator")).toEqual({ primary: "video-motion", secondary: ["games-3d"] });
    expect(classifyFamilies("Freelance: Photographie, Vidéo et Drone")).toEqual({ primary: "video-motion", secondary: ["photo"] });
    expect(classifyFamilies("Marketing Designer")).toEqual({ primary: "design-brand", secondary: ["marketing"] });
    expect(classifyFamilies("Senior Product Designer").secondary).toEqual([]);
  });

  it("a plain 'designer' is Design & brand, a game or a product around it moves it", () => {
    expect(classifyFamilies("Designer").primary).toBe("design-brand");
    expect(classifyFamilies("Product Designer").primary).toBe("product-ux");
    expect(classifyFamilies("Game UI Designer").primary).toBe("games-3d");
  });

  it("the excerpt only decides when it names the job outright and the title names nothing", () => {
    expect(classifyFamilies("Specialist", "We are hiring a motion designer to join our video team.").primary).toBe("video-motion");
    // a weak word (marketing) in the excerpt is not enough to sort a title that says nothing
    expect(classifyFamilies("Consultant", "Our marketing and growth team is great.").primary).toBe("other");
    // and an excerpt never overrides a title that is clear
    expect(classifyFamilies("Senior Software Engineer", "We design beautiful products and brand experiences.").primary).toBe("engineering");
  });

  it("nothing recognisable is 'Everything else', never a guess", () => {
    expect(classifyFamilies("Renewables Project Scheduler").primary).toBe("other");
    expect(classifyFamilies("").primary).toBe("other");
  });
});

describe("level", () => {
  it.each([
    ["Werkstudent Marketing (m/w/d)", "intern"],
    ["Intern, Social Media", "intern"],
    ["Junior Illustrator", "junior"],
    ["Designer Júnior", "junior"],
    ["Estagiário de Design", "intern"],
    ["Diretor de Arte Sênior", "director"],
    ["Graduate Designer", "junior"],
    ["Senior Product Designer", "senior"],
    ["Staff Engineer", "senior"],
    ["Lead Brand Designer", "lead"],
    ["Principal Designer", "lead"],
    ["Director of Product Design", "director"],
    ["Lead Art Director", "director"],
    ["VP Design", "director"],
    ["Head of Brand", "director"],
    ["Product Designer", null],
  ] as const)("%s -> %s", (title, level) => {
    expect(classifyLevel(title)).toBe(level);
  });

  it("the highest rung named wins: 'Senior Director' is a director", () => {
    expect(classifyLevel("Senior Director, Design")).toBe("director");
  });
});

describe("working mode and language", () => {
  it("remote from the source's own flag or the place, hybrid and on-site from the place, otherwise not stated", () => {
    expect(classifyWorkMode({ remote_scope: "remote", location: "Lisbon" })).toBe("remote");
    expect(classifyWorkMode({ location: "Anywhere" })).toBe("remote");
    expect(classifyWorkMode({ location: "Berlin (hybrid)" })).toBe("hybrid");
    expect(classifyWorkMode({ location: "Berlin" })).toBe("onsite");
    expect(classifyWorkMode({ title: "Video Editor (Fully Remote)" })).toBe("remote");
    expect(classifyWorkMode({})).toBe("unknown");
  });

  it("tells German from English by common words, and leaves short or unclear text alone", () => {
    expect(detectLanguage("Werkstudent Grafikdesign (m/w/d) für unser Team in Berlin und München")).toBe("de");
    expect(detectLanguage("We are looking for a designer to join our team and shape the product")).toBe("en");
    expect(detectLanguage("Sr React")).toBe("other");
  });
});

describe("clean titles", () => {
  it("decodes entities, drops emoji and the (remote) / (m/f/d) tags, and keeps the rest", () => {
    expect(cleanTitle("🎨 Senior Product Designer (Remote) (m/f/d)")).toBe("Senior Product Designer");
    expect(cleanTitle("Motion Designer &amp; Editor")).toBe("Motion Designer & Editor");
    expect(cleanTitle("Graphic Designer [Fully Remote]")).toBe("Graphic Designer");
    // a tag that says something else about the job is kept
    expect(cleanTitle("Content Designer II (Smartsheet)")).toBe("Content Designer II (Smartsheet)");
  });

  it("sets a title shouted in capitals in normal case, acronyms kept", () => {
    expect(cleanTitle("UX/UI DESIGNER")).toBe("UX/UI Designer");
    expect(cleanTitle("SENIOR MOTION DESIGNER")).toBe("Senior Motion Designer");
    expect(cleanTitle("VP of Design")).toBe("VP of Design");
  });

  it("takes the company off the end when it is shown next to the title anyway", () => {
    expect(cleanTitle("Brand Designer at Acme", "Acme")).toBe("Brand Designer");
    expect(cleanTitle("Brand Designer | Acme", "Acme")).toBe("Brand Designer");
    expect(cleanTitle("Brand Designer - Acme Studio", "Acme")).toBe("Brand Designer - Acme Studio");
    expect(cleanTitle("Hiring: Copywriter", null)).toBe("Copywriter");
  });

  it("repairs text a feed encoded twice and leaves everything else alone", () => {
    expect(fixMojibake("Telefondienst fÃ¼r Praxis")).toBe("Telefondienst für Praxis");
    expect(fixMojibake("Café designer")).toBe("Café designer");
    expect(fixMojibake("Plain title")).toBe("Plain title");
    expect(cleanTitle("Telefondienst fÃ¼r Praxis")).toBe("Telefondienst für Praxis");
  });

  it("cuts a very long title at 140 characters", () => {
    const out = cleanTitle("Designer ".repeat(40));
    expect(out.length).toBeLessThanOrEqual(140);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("one call", () => {
  it("returns family, second families, group, level, mode and language together", () => {
    const c = classifyOpportunity({ title: "Senior Graphic Designer & Video Editor", excerpt: "Join our team and shape the look of our brand.", location: "Lisbon", remote_scope: "remote" });
    expect(c).toMatchObject({ category: "design-brand", alsoIn: ["video-motion"], group: "creative", level: "senior", workMode: "remote", language: "en" });
  });
});
