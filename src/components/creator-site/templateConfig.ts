/** Centralized template definitions with tier gating */

export type TemplateTier = 'pro' | 'creator_pro';

export interface TemplateOption {
  id: string;
  name: string;
  description: string;
  preview: string;
  accent: string;
  textColor?: string;
  tier: TemplateTier;
}

/**
 * Creator tier: bold-electric, minimal-editorial, portfolio-mosaic (3 templates)
 * Creator+ tier: all 9 templates
 */
export const TEMPLATES: TemplateOption[] = [
  {
    id: 'bold-electric',
    name: 'Bold Electric',
    description: 'High-energy dark mode with vibrant gradients',
    preview: 'bg-gradient-to-br from-[#0a0a0c] to-[#1a1a2e]',
    accent: 'bg-[#ff00ff]',
    textColor: 'text-white',
    tier: 'pro',
  },
  {
    id: 'minimal-editorial',
    name: 'Minimal Editorial',
    description: 'Clean, elegant serif typography on warm white',
    preview: 'bg-[#faf9f7]',
    accent: 'bg-[#1a1a1a]',
    textColor: 'text-[#1a1a1a]',
    tier: 'pro',
  },
  {
    id: 'portfolio-mosaic',
    name: 'Portfolio Mosaic',
    description: 'Image-first masonry layout, modern and rounded',
    preview: 'bg-white',
    accent: 'bg-[#111]',
    textColor: 'text-[#111]',
    tier: 'pro',
  },
  {
    id: 'creative-director',
    name: 'Creative Director',
    description: 'Cinematic dark layout with gold accents',
    preview: 'bg-gradient-to-br from-[#0d0d0d] to-[#1a1510]',
    accent: 'bg-[#b8a080]',
    textColor: 'text-[#e8e4df]',
    tier: 'creator_pro',
  },
  {
    id: 'artist-showcase',
    name: 'Artist Showcase',
    description: 'Immersive full-screen imagery with masonry gallery',
    preview: 'bg-gradient-to-br from-[#1a0a2e] to-[#111]',
    accent: 'bg-white',
    textColor: 'text-white',
    tier: 'creator_pro',
  },
  {
    id: 'producer',
    name: 'Producer',
    description: 'Stats-driven light layout with filmography scroll',
    preview: 'bg-[#fefefe]',
    accent: 'bg-[#111]',
    textColor: 'text-[#111]',
    tier: 'creator_pro',
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'Bold, corporate energy with oversized typography',
    preview: 'bg-white',
    accent: 'bg-[#111]',
    textColor: 'text-[#111]',
    tier: 'creator_pro',
  },
  {
    id: 'minimal-clean',
    name: 'Minimal Clean',
    description: 'Ultra-minimal single-column layout',
    preview: 'bg-[#fcfcfc]',
    accent: 'bg-[#222]',
    textColor: 'text-[#222]',
    tier: 'creator_pro',
  },
  {
    id: 'photographer',
    name: 'Photographer',
    description: 'Image-first dark theme with lightbox',
    preview: 'bg-[#1a1a1a]',
    accent: 'bg-white',
    textColor: 'text-white',
    tier: 'creator_pro',
  },
];

/** Check if a template is accessible at the given tier */
export function isTemplateAccessible(templateId: string, isCreatorPro: boolean): boolean {
  const t = TEMPLATES.find(tpl => tpl.id === templateId);
  if (!t) return false;
  if (t.tier === 'pro') return true; // accessible to all Pro+
  return isCreatorPro; // creator_pro templates need Creator+
}

/** Get accessible templates for a tier */
export function getAccessibleTemplates(isCreatorPro: boolean): TemplateOption[] {
  return TEMPLATES; // return all, let UI show locks
}

export const PRO_TEMPLATE_COUNT = TEMPLATES.filter(t => t.tier === 'pro').length;
export const TOTAL_TEMPLATE_COUNT = TEMPLATES.length;
