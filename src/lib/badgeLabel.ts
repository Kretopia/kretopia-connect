/**
 * Single source of truth for displaying user_badge values in the UI.
 * Keep these short — used in chips, hero badges, swipe cards, etc.
 */
export type UserBadgeValue =
  | 'og'
  | 'beta'
  | 'official'
  | 'founder'
  | 'odos'
  | 'founding_member'
  | string
  | null
  | undefined;

export function badgeLabel(badge: UserBadgeValue): string {
  switch (badge) {
    case 'founder':
      return '👑 Founder';
    case 'founding_member':
      return '★ Founding';
    case 'og':
      return 'OG';
    case 'odos':
      return '🌿 ODOS';
    case 'official':
      return '✓ Official';
    case 'beta':
      return 'Beta';
    default:
      return badge ? String(badge) : '';
  }
}
