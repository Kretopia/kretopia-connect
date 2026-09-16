// Categories for ThriveFund campaigns — inspired by Kickstarter / Indiegogo,
// curated for the creator economy.
export const FUND_CATEGORIES = [
  // Screen & sound
  "Film",
  "Web Series",
  "Animation",
  "Documentary",
  "Music",
  "Album / EP",
  "Music Video",
  "Podcast",
  "Audio Drama",

  // Visual & design
  "Photography",
  "Art & Design",
  "Illustration",
  "Comics & Graphic Novels",
  "Fashion",
  "Product Design",

  // Writing & publishing
  "Writing",
  "Publishing",
  "Journalism",
  "Zines",

  // Performance & live
  "Theater",
  "Dance",
  "Live Events & Tours",
  "Festivals",

  // Games & interactive
  "Video Games",
  "Tabletop Games",
  "Interactive / XR",

  // Tech for creators
  "Creator Tech & Tools",
  "Hardware",
  "Apps & Software",

  // Food, craft, lifestyle
  "Food & Beverage",
  "Crafts",
  "Lifestyle Brand",

  // Community & impact
  "Community",
  "Education",
  "Social Impact",

  "Other",
] as const;

export type FundCategory = (typeof FUND_CATEGORIES)[number];
