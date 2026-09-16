import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Crawlable, text-based FAQ for AI-search citation (ChatGPT, Perplexity, Claude)
 * and Google FAQ-rich results. Mirrors the FAQPage JSON-LD in index.html.
 *
 * Every claim here must match what's actually live — escrow/milestone-hold
 * payment protection is a real KrePay capability but is currently behind the
 * `krePayAdvanced` V1 flag (off, see src/config/kretopiaV1.ts), so the KrePay
 * answer below describes what's live today (invoices, payment links, direct
 * bank payout) rather than that gated feature set.
 */
const ACCENT = "#FF2DA1";

const FAQS = [
  {
    q: "What is Kretopia?",
    intro:
      "Kretopia is the Creative Economy OS — an all-in-one professional network, portfolio builder, and workspace for artists, musicians, filmmakers, producers, and models.",
    points: [
      "A verified credit registry for every creative industry (film, music, fashion, events, design)",
      "An auto-generated Industry EPK you can share with a link",
      "Studio — a collaborative project workspace with tasks, files, chat, and calls",
      "KrePay — send invoices and payment links, and get paid directly",
    ],
  },
  {
    q: "How does the creative credit tracking system work?",
    intro:
      "Kretopia's credit system gives creatives a verifiable record of every project they've worked on:",
    points: [
      "Search any production, album, campaign, event, or release in the registry",
      "Claim your role on it (director, producer, photographer, musician, model, designer, etc.)",
      "Collaborators co-sign your credit, which verifies authorship peer-to-peer",
      "Kretopia cross-references public records and platform data to issue a verified badge",
      "The result is a portable work history backed by real evidence, not just claims — like IMDb, but for every creative industry",
    ],
  },
  {
    q: "What is an Industry EPK on Kretopia?",
    intro:
      "An Industry EPK (Electronic Press Kit) is a professional, link-ready profile that Kretopia generates automatically from your account:",
    points: [
      "A shareable link, ready to send to clients, agents, labels, festivals, or casting directors",
      "Pulls in your verified credits, portfolio media, and reviews",
      "Always up to date — when you add a new credit or project, your EPK updates instantly",
      "Mobile-first design that looks professional whether opened on phone, desktop, or shared in DMs",
    ],
  },
  {
    q: "How does KrePay help me get paid?",
    intro:
      "KrePay is Kretopia's built-in payments tool, so freelance creatives don't have to chase invoices through a separate app:",
    points: [
      "Share a payment link or send an invoice — no waiting on a bank transfer to clear",
      "Track every invoice and expense in one place, so nothing falls through at tax time",
      "Get paid directly to your bank — Kretopia handles the processing, so you never manage a separate payments dashboard",
    ],
  },
];

export const FAQSection = () => {
  const reducedMotion = useReducedMotion();

  return (
    <section
      id="faq"
      className="landing-section relative border-t border-white/[0.05]"
      style={{ backgroundColor: "#05070D" }}
      aria-labelledby="faq-heading"
    >
      <div className="relative mx-auto max-w-[820px]">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <p className="landing-eyebrow mb-4">Frequently asked</p>
          <h2 id="faq-heading" className="landing-h2 landing-glow">
            Everything about <span className="landing-accent">Kretopia</span>
          </h2>
          <p className="landing-sub mt-4 mx-auto max-w-lg">
            Straight answers about credits, EPKs, and getting paid.
          </p>
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-12"
        >
          <Accordion
            type="single"
            collapsible
            className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/10 overflow-hidden"
          >
            {FAQS.map(({ q, intro, points }, i) => (
              <AccordionItem
                key={q}
                value={`item-${i}`}
                className="border-b-0 px-5 sm:px-6"
              >
                <AccordionTrigger
                  className="text-left text-base sm:text-lg font-semibold text-white hover:no-underline py-5"
                  style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                >
                  {q}
                </AccordionTrigger>
                <AccordionContent
                  className="text-sm sm:text-base text-white/55 leading-relaxed pb-6"
                  style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                >
                  <p className="mb-3">{intro}</p>
                  <ul className="space-y-2">
                    {points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span
                          aria-hidden="true"
                          className="mt-2 h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: ACCENT }}
                        />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};
