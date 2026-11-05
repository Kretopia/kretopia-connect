/**
 * Kretopia EditorialFooter — public navigation.
 *
 * Four columns: Product, For, Explore, Legal.
 * Contact: /contact
 * Pricing: /subscription (protected)
 * Events: /meetup
 * SoundStages: /soundstages
 * Logo: /landing
 *
 * Established design and gradient preserved.
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
      { label: "Scout", to: "/opportunities" },
      { label: "Studio", to: "/landing#chapter-studio" },
      { label: "Kreto", to: "/landing#chapter-kreto" },
      { label: "KrePay", to: "/landing#chapter-studio" },
    ],
  },
  {
    heading: "For",
    links: [
      { label: "For creatives", to: "/landing#chapter-passport" },
      { label: "For companies", to: "/post-opportunity" },
      { label: "Pricing enquiries", to: "/contact" },
    ],
  },
  {
    heading: "Explore",
    links: [
      { label: "Talent Search", to: "/search" },
      { label: "Match", to: "/match" },
      { label: "Events", to: "/meetup" },
      { label: "SoundStages", to: "/soundstages" },
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

export const EditorialFooter = () => {
  return (
    <footer
      className="relative border-t border-white/[0.08]"
    >
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12 pt-16 sm:pt-20 pb-8">
        <div className="grid gap-10 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,auto))] lg:gap-x-16">
          <div className="max-w-xs">
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

          {COLUMNS.map((col) => (
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