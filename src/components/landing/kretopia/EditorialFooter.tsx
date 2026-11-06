/**
 * EditorialFooter — Landing overhaul (24/09/2026), rebuilt to match the
 * "kretopianewfooter" reference: a real 4-column link footer (Product /
 * For / Explore / Legal) instead of the previous 3-column masthead
 * strip. Every link below points at a route that already exists in
 * App.tsx. "Pricing" opens the public /pricing route
 * every other CTA in the app already links to (StorageMeter,
 * QuotaExceededDialog, GroupChatPanel), and "Contact" opens the dedicated /contact page,
 * which also offers the support@kretopia.com direct email address.
 *
 * v2: dropped the small per-column underline accent (the 3px gradient
 * bar under each heading) — that also retired the `accent` field on
 * FooterColumn/COLUMNS entirely, since the underline was its only use.
 * The full-width brand-gradient seam near the bottom is toned down
 * (opacity 0.45) — six fully-saturated stops side by side on a dark
 * background was reading as a bright glowing band rather than a quiet
 * seam; same gradient, just dialed back.
 */
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

interface FooterLink {
  label: string;
  to: string;
  external?: boolean;
}

interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "Creative Passport", to: "/passport" },
      { label: "Scout", to: "/scout" },
      { label: "Studio", to: "/desk" },
      { label: "Kreto", to: "/kreto" },
      { label: "KrePay", to: "/thrivepay" },
    ],
  },
  {
    heading: "For",
    links: [
      { label: "For creatives", to: "/auth?tab=signup&src=footer" },
      { label: "For companies", to: "/post-opportunity" },
      { label: "Pricing", to: "/pricing" },
    ],
  },
  {
    heading: "Explore",
    links: [
      { label: "Match", to: "/match" },
      { label: "Talent Search", to: "/search" },
      { label: "Events", to: "/events" },
      { label: "SoundStages", to: "/circle?tab=live" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "Terms of Service", to: "/terms" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Community", to: "/community-guidelines" },
    ],
  },
];

/**
 * "balanced" regroups the same links (none added or removed) so the four columns hold 4 / 4 / 4 / 5 instead of 5 / 3 / 4 / 5,
 * and lets them sit two by two on a phone. It is opt-in: the default footer is shared with pages owned elsewhere (About,
 * Discover, For Creatives, For Companies) and keeps its layout exactly.
 */
const BALANCED_COLUMNS: FooterColumn[] = [
  { heading: "Product", links: COLUMNS[0].links.filter((l) => l.label !== "KrePay") },
  { heading: "Explore", links: COLUMNS[2].links },
  { heading: "For", links: [...COLUMNS[1].links, COLUMNS[0].links.find((l) => l.label === "KrePay")!] },
  { heading: "Legal", links: COLUMNS[3].links },
];

export const EditorialFooter = ({ variant = "default" }: { variant?: "default" | "balanced" }) => {
  const balanced = variant === "balanced";
  const columns = balanced ? BALANCED_COLUMNS : COLUMNS;
  return (
    <footer
      className="relative border-t border-white/[0.08]"
    >
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12 pt-16 sm:pt-20 pb-8">
        <div
          className={
            balanced
              ? "grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 sm:gap-x-8 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] lg:gap-x-12"
              : "grid gap-10 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,auto))] lg:gap-x-16"
          }
        >
          <div className={balanced ? "col-span-2 max-w-xs sm:col-span-4 lg:col-span-1" : "max-w-xs"}>
            <BrandLogo size="md" showBeta linkToHome="/landing" />
            <p
              className="mt-6 text-xl sm:text-2xl font-semibold text-white leading-snug"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Creative work should lead somewhere.
            </p>
            <p
              className="mt-4 text-sm text-white/50 leading-relaxed"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Kretopia connects creative identity, work, opportunity and professional continuity.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <p
                className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60"
                style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
              >
                {col.heading}
              </p>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.to}
                        className="text-sm text-white/55 hover:text-white transition-colors"
                        style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.to}
                        className="text-sm text-white/55 hover:text-white transition-colors"
                        style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Full-width brand gradient seam — same stops as the logo, opacity
            dialed back so it reads as a quiet seam, not a glowing band. */}
        <div
          aria-hidden
          className="mt-14 h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, #2A0FD9, #4812F5, #9413D2, #E0179C, #FF3D7A, #FEA61A)",
            opacity: 0.45,
          }}
        />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p
            className="text-xs text-white/50"
            style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
          >
            © {new Date().getFullYear()} Kretopia
          </p>
          <p
            className="text-[10px] uppercase tracking-[0.28em] text-white/50"
            style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
          >
            Made for creators · Worldwide
          </p>
        </div>
      </div>
    </footer>
  );
};

export default EditorialFooter;
