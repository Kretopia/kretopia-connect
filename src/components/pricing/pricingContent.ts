import type { KretopiaIconName } from "./KretopiaIcon";

export interface CreativeCopy {
  name: string;
  tagline: string;
  description: string;
  features: string[];
  ctaLabel: string;
  footnote: string;
  icon: KretopiaIconName;
}

export const CREATIVE_COPY: Record<string, CreativeCopy> = {
  free: {
    name: "Spark", tagline: "Start creating. Free forever.",
    description: "A starting point for creatives ready to explore, connect, and build their presence.",
    features: ["Kreto Talk — 15 minutes per day, combining chat and voice", "Smart Gig Scout — weekly opportunity preview", "Claim credits for your creative work", "20 discovery swipes per day"],
    ctaLabel: "Get Started Free", footnote: "Your creative journey starts here.", icon: "generate",
  },
  pro: {
    name: "Creator", tagline: "Turn opportunities into action.",
    description: "More discovery, more support, and more ways to move your work forward.",
    features: ["Kreto Talk — up to 2 hours per day, with memory", "Smart Gig Scout — daily opportunity discovery", "AI-assisted cover letter drafts for opportunities", "Kreto-assisted project proposals, with your approval before action"],
    ctaLabel: "Choose Creator", footnote: "For creatives ready to take the next step.", icon: "connection-path",
  },
  creator_pro: {
    name: "Creator+", tagline: "Create with greater possibilities.",
    description: "More capacity, advanced assistance, and powerful tools for creatives managing multiple opportunities and projects.",
    features: ["Kreto Talk — up to 10 hours per day, with long-term memory", "Advanced AI-assisted project workflows", "Priority Scout discovery and saved shortlists", "Access to nine premium site templates"],
    ctaLabel: "Choose Creator+", footnote: "For ambitious creatives and growing practices.", icon: "studio",
  },
  founder: {
    name: "Founder", tagline: "Be part of what comes next.",
    description: "A different way to support Kretopia's early journey while securing long-term access to Creator.",
    features: ["Lifetime access to the Creator plan", "Priority access to selected new creator tools", "Special access to eligible events and opportunities", "Founder-specific platform benefits, subject to the applicable terms"],
    ctaLabel: "Explore Founder Access", footnote: "One contribution. A lasting connection.", icon: "creative-circle",
  },
};

export const COMPANY_OPTIONS = [
  {
    name: "Company Access", tagline: "Discover the people behind the work.", price: "Pricing by enquiry",
    description: "For businesses exploring creative talent, project opportunities, and new collaborations.",
    features: ["Discovering creative professionals", "Exploring profiles, portfolios, and relevant work", "Understanding creative experience and contributions", "Identifying potential collaborators for specific needs", "Connecting opportunities with relevant talent"],
    ctaLabel: "Request Company Access", footnote: "Find talent with more context.", icon: "company" as const,
  },
  {
    name: "Team & Organisation Access", tagline: "Bring people, projects, and decisions together.", price: "Pricing by enquiry",
    description: "For companies, agencies, and organisations coordinating more complex creative projects or working with multiple stakeholders.",
    features: ["Discovering talent across creative disciplines", "Organising project and hiring requirements", "Building and reviewing potential collaborator shortlists", "Supporting shared evaluation and decision-making", "Exploring workflows suited to the organisation's needs"],
    ctaLabel: "Discuss Team Requirements", footnote: "Because finding talent is only part of building a great team.", icon: "team" as const,
  },
];

export const CREATIVE_GUIDANCE = [
  ["Starting out?", "Discover new opportunities and begin building your creative presence with Spark."],
  ["Building momentum?", "Explore more opportunities and get additional support with Creator."],
  ["Managing more ambitious work?", "Access advanced tools and greater capacity with Creator+."],
  ["Looking for a long-term commitment?", "Explore the Founder offer."],
];

export const COMPANY_BENEFITS = [
  ["Define your needs.", "Describe the creative expertise and project requirements your organisation is looking for."],
  ["Explore relevant people.", "Review available creative profiles and experience to identify potential collaborators."],
  ["Start a conversation.", "Contact Kretopia to discuss access options and the next steps for your team."],
];

export const COMPANY_NEEDS = [
  ["Independent businesses", "Find creative professionals for specific projects, assignments, and collaborations."],
  ["Creative agencies", "Explore talent across disciplines and identify people who complement your existing capabilities."],
  ["Growing companies", "Discover creative expertise as your projects and requirements evolve."],
  ["Established organisations", "Discuss access and workflows suited to broader teams and more complex requirements."],
];

export const CREATIVE_FAQS = [
  ["Is Spark really free?", "Spark is Kretopia's free starting plan, with access to selected discovery and creative tools subject to the included usage limits."],
  ["What's the difference between Creator and Creator+?", "Creator focuses on more frequent discovery and practical assistance. Creator+ offers higher usage limits and access to more advanced workflows."],
  ["How does yearly billing work?", "Yearly billing offers an alternative to monthly subscriptions. The total annual charge and applicable savings should be displayed before payment."],
  ["Is Founder a monthly subscription?", "No. Founder is a one-time purchase that includes lifetime access to the Creator plan, subject to the Founder offer terms."],
  ["Are there additional platform fees?", "Certain transactions may be subject to platform fees. Applicable rates and conditions should be clearly presented before a transaction is completed."],
  ["Looking for hiring or business tools?", "Explore Kretopia's options for companies and organisations."],
];

export const COMPANY_FAQS = [
  ["Who is Kretopia for?", "Kretopia is designed for creative professionals and the businesses, teams, and organisations that work with them."],
  ["Can companies explore talent across different disciplines?", "Cross-disciplinary creative discovery is a central part of Kretopia's product direction. The available search capabilities will depend on the current product offering."],
  ["What if our organisation has more complex requirements?", "Contact Kretopia to discuss your team structure, creative workflows, and access needs."],
  ["Is pricing available for companies?", "Company access options and commercial terms are provided through direct enquiry until public plans are confirmed."],
  ["Can creative professionals use Kretopia independently?", "Yes. Individual creatives can explore the separate Creator plans."],
];
