// Static discovery catalog for the hero search: roles, skills, locations and
// types of work. Public vocabulary only — no user data. Selecting an entry
// leads to real search results (auth required for guests).

export type CatalogKind = "role" | "skill" | "location" | "work";

export interface CatalogEntry {
  kind: CatalogKind;
  label: string;
  description: string;
}

const r = (label: string, description: string): CatalogEntry => ({ kind: "role", label, description });
const s = (label: string, description: string): CatalogEntry => ({ kind: "skill", label, description });
const l = (label: string, description: string): CatalogEntry => ({ kind: "location", label, description });
const w = (label: string, description: string): CatalogEntry => ({ kind: "work", label, description });

export const SEARCH_CATALOG: CatalogEntry[] = [
  // Roles
  r("Actor", "Screen, stage and voice performance"),
  r("Animator", "2D and 3D motion for film, ads and games"),
  r("Art Director", "Leads the visual direction of a project"),
  r("Beatmaker", "Builds instrumentals and rhythm tracks"),
  r("Brand Strategist", "Positioning, identity and campaign thinking"),
  r("Casting Director", "Finds and books the right talent"),
  r("Choreographer", "Designs movement for stage, video and events"),
  r("Cinematographer", "Director of photography, shapes the image"),
  r("Colorist", "Grades footage for mood and consistency"),
  r("Composer", "Original scores for film, games and media"),
  r("Content Creator", "Short-form, long-form and social storytelling"),
  r("Copywriter", "Words that sell: ads, scripts, web"),
  r("Costume Designer", "Wardrobe for characters and productions"),
  r("Creative Director", "Owns the creative vision end to end"),
  r("Dancer", "Performance for stage, video and live shows"),
  r("Director", "Leads film, commercial and music video sets"),
  r("DJ", "Live sets for clubs, festivals and brands"),
  r("Editor", "Cuts footage into a story"),
  r("Event Producer", "Plans and runs live experiences"),
  r("Fashion Designer", "Collections, garments and capsules"),
  r("Fashion Stylist", "Looks for shoots, talent and campaigns"),
  r("Gaffer", "Head of lighting on set"),
  r("Graphic Designer", "Visual identity, layout and print"),
  r("Hair Stylist", "Hair for shoots, shows and screen"),
  r("Illustrator", "Drawn and digital artwork on commission"),
  r("Influencer", "Audience-led brand partnerships"),
  r("Journalist", "Reporting, interviews and features"),
  r("Makeup Artist", "Beauty, editorial and SFX makeup"),
  r("Mixing Engineer", "Balances and polishes recorded tracks"),
  r("Mastering Engineer", "Final sonic finish before release"),
  r("Model", "Editorial, commercial and runway work"),
  r("Motion Designer", "Animated graphics and titles"),
  r("Music Producer", "Shapes songs from idea to master"),
  r("Musician", "Session and live instrument performance"),
  r("Painter", "Original works and commissions"),
  r("Photographer", "Editorial, fashion, commercial and documentary"),
  r("Podcaster", "Hosts and produces audio shows"),
  r("Producer", "Makes productions happen: budget, team, delivery"),
  r("Production Designer", "Builds the visual world of a set"),
  r("Rapper", "Writes and performs rap"),
  r("Screenwriter", "Scripts for film, TV and digital"),
  r("Set Designer", "Designs and dresses sets"),
  r("Singer", "Lead and session vocals"),
  r("Songwriter", "Lyrics and melodies for artists"),
  r("Sound Designer", "Effects and soundscapes for media"),
  r("Sound Engineer", "Records and runs live sound"),
  r("Tattoo Artist", "Custom tattoo design and work"),
  r("UX Designer", "Product experiences for apps and web"),
  r("Videographer", "Shoots video for brands and events"),
  r("VFX Artist", "Visual effects and compositing"),
  r("Voice Actor", "Voice for ads, animation and games"),
  r("Web Designer", "Websites for creatives and brands"),
  r("Writer", "Copy, journalism, fiction and screen"),
  // Skills
  s("3D Modeling", "Blender, Cinema 4D, Maya"),
  s("Ableton Live", "Production and live performance"),
  s("Adobe Premiere", "Professional video editing"),
  s("After Effects", "Motion graphics and compositing"),
  s("Brand Identity", "Logos, systems and guidelines"),
  s("Color Grading", "DaVinci Resolve look and finish"),
  s("Community Management", "Grows and engages audiences"),
  s("DaVinci Resolve", "Editing, color and audio finishing"),
  s("Drone Piloting", "Aerial photo and video"),
  s("Figma", "Interface and product design"),
  s("FL Studio", "Beat production and arrangement"),
  s("Final Cut Pro", "Video editing on Mac"),
  s("Lighting", "Studio and on-set lighting"),
  s("Logic Pro", "Recording, mixing and production"),
  s("Photoshop", "Retouching and compositing"),
  s("Pro Tools", "Studio recording and mixing"),
  s("Public Speaking", "Hosting, panels and keynotes"),
  s("Retouching", "High-end photo cleanup"),
  s("Scriptwriting", "Story structure and dialogue"),
  s("SEO", "Search visibility for content"),
  s("Social Media Strategy", "Plans content that performs"),
  s("Storyboarding", "Visual planning before the shoot"),
  s("Typography", "Type selection and layout"),
  s("Unreal Engine", "Real-time 3D and virtual production"),
  s("Vocal Coaching", "Technique and performance training"),
  // Locations
  l("Amsterdam", "Creative hub, Netherlands"),
  l("Atlanta", "Music and film hub, USA"),
  l("Bali", "Indonesia, creators and retreats"),
  l("Bangkok", "Thailand, production and content"),
  l("Barcelona", "Spain, design and fashion"),
  l("Berlin", "Germany, music and art scene"),
  l("Dubai", "UAE, brands and events"),
  l("Lagos", "Nigeria, music and fashion"),
  l("Lisbon", "Portugal, creative nomads"),
  l("London", "UK, fashion, music and film"),
  l("Los Angeles", "USA, film, TV and music"),
  l("Lyon", "France, events and design"),
  l("Marseille", "France, film and street culture"),
  l("Mexico City", "Mexico, art and production"),
  l("Miami", "USA, music, fashion and nightlife"),
  l("Milan", "Italy, fashion capital"),
  l("Montreal", "Canada, games, VFX and music"),
  l("New York", "USA, every creative industry"),
  l("Paris", "France, fashion, film and art"),
  l("Remote", "Work from anywhere"),
  l("São Paulo", "Brazil, advertising and music"),
  l("Seoul", "South Korea, music and beauty"),
  l("Singapore", "Asia hub for brands and media"),
  l("Sydney", "Australia, production and content"),
  l("Tokyo", "Japan, design, music and animation"),
  l("Toronto", "Canada, film and music"),
  // Types of work
  w("Album Release", "Recording, mixing and rollout"),
  w("Brand Campaign", "Paid creative for a brand"),
  w("Brand Collaboration", "Sponsored partnership with a creator"),
  w("Commercial", "Advertising spot for TV or web"),
  w("Commission", "Custom artwork for a client"),
  w("Documentary", "Non-fiction film and series"),
  w("Editorial Shoot", "Magazine and press photography"),
  w("Event", "Launches, parties and activations"),
  w("Exhibition", "Gallery and art shows"),
  w("Fashion Show", "Runway production and casting"),
  w("Feature Film", "Long-form narrative film"),
  w("Festival", "Music and arts festivals"),
  w("Freelance Gig", "Short paid creative mission"),
  w("Full-time Role", "Permanent creative position"),
  w("Live Gig", "DJ sets and live performance"),
  w("Lookbook", "Product and collection imagery"),
  w("Music Video", "Visuals for a track"),
  w("Podcast", "Audio and video show production"),
  w("Post-production", "Edit, color, sound and VFX"),
  w("Short Film", "Narrative shorts and festival films"),
  w("Social Content", "Reels, TikToks and posts"),
  w("Studio Session", "Recording and production time"),
  w("TV Series", "Episodic production"),
  w("UGC", "User-generated content for brands"),
  w("Workshop", "Teaching and masterclasses"),
];

export const CATALOG_KIND_LABEL: Record<CatalogKind, string> = {
  role: "Roles",
  skill: "Skills",
  location: "Locations",
  work: "Type of work",
};

/** Matches from one letter: prefix matches first, then word / substring. */
export function searchCatalog(query: string, perKind = 4): CatalogEntry[] {
  const q = query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!q) return [];
  const norm = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const scored = SEARCH_CATALOG.map((e) => {
    const label = norm(e.label);
    let score = 0;
    if (label.startsWith(q)) score = 3;
    else if (label.split(/[\s-]/).some((p) => p.startsWith(q))) score = 2;
    else if (q.length >= 2 && (label.includes(q) || norm(e.description).includes(q))) score = 1;
    return { e, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || a.e.label.localeCompare(b.e.label));
  const counts: Record<string, number> = {};
  const out: CatalogEntry[] = [];
  for (const { e } of scored) {
    counts[e.kind] = (counts[e.kind] || 0) + 1;
    if (counts[e.kind] <= perKind) out.push(e);
  }
  return out;
}
