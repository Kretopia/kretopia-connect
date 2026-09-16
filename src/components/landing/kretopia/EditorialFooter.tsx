/**
 * EditorialFooter — masthead-style closing line for Kretopia.
 * Monocle-coded: thin rules, all caps micro-type, generous whitespace.
 */
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND } from "@/lib/brandLexicon";

export const EditorialFooter = () => {
  return (
    <footer
      className="relative border-t border-white/[0.08]"
      style={{ backgroundColor: "#05070D" }}
    >
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12 pt-16 sm:pt-20 pb-6 sm:pb-8">
        <div className="grid sm:grid-cols-3 gap-10 sm:gap-6 items-start">
          <div>
            <BrandLogo size="md" showBeta linkToHome />
            <p
              className="mt-3 text-[10px] font-medium uppercase tracking-[0.32em] text-white/50"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              {BRAND.parentLine}
            </p>
          </div>

          <div
            className="text-[11px] sm:text-center text-white/55 leading-relaxed"
            style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
          >
            <span className="text-white">Kretopia</span> — the platform.{" "}
            <span className="block mt-1">
              <span className="text-white">Kretopia</span> — community, events, magazine.
            </span>
            <span className="block mt-1">
              <span className="text-white">Kreto</span> — Executive Producer.
            </span>
          </div>

          <nav
            className="flex flex-wrap sm:justify-end gap-x-5 gap-y-2 text-[11px] text-white/50"
            style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
          >
            <Link to="/about" className="hover:text-white transition-colors">About</Link>
            <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/community-guidelines" className="hover:text-white transition-colors">Guidelines</Link>
          </nav>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.05] flex flex-wrap items-center justify-between gap-3">
          <p
            className="text-[10px] uppercase tracking-[0.28em] text-white/50"
            style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
          >
            © {new Date().getFullYear()} Thrive Collective · All rights reserved
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
