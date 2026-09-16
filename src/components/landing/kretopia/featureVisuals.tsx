/**
 * Large, step-reactive visual previews for the landing feature tutorials
 * (Verified Credits and Kreto keep their own bespoke command-surface /
 * evidence mockups instead — these six cover the ChapterSection-driven
 * features plus Search). Each one is an honest, illustrative mockup,
 * clearly labeled where the content is an example, never presented as
 * live data pulled from a real account. Each step shows a complete,
 * information-dense snapshot of that moment in the flow — not a single
 * sparse line — so the preview reads as a real product screen.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, UserCheck, Rocket, Clock, HandHeart,
  ListChecks, FileEdit, Sparkles, Radar, Target, Bookmark,
  FolderKanban, Users, MessageCircle, Handshake,
  ClipboardList, Milestone, Banknote, DoorOpen, Video,
  UploadCloud, Share2, MapPin, CheckCircle2, Mic, FileVideo,
} from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { VisualCardShell } from "./visualShell";

const ACCENT = "#FF2DA1";

const fade = (reducedMotion: boolean) => ({
  initial: reducedMotion ? false : { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: reducedMotion ? undefined : { opacity: 0, y: -8 },
  transition: { duration: 0.32 },
});

// Same stagger pattern as TutorialStepper's row reveal: each card's
// persistent top-level elements cascade in top-to-bottom, one after
// another, the first time the card scrolls into view — e.g. the search
// bar ("Maya Solano") reveals first, then the step content below it,
// rather than the whole card popping in as one block. The AnimatePresence
// step-swap animation inside each card is separate and untouched — this
// only governs the card's *first* reveal.
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14 } },
};
const rowVariants = {
  hidden: { opacity: 0, y: -12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.65, 0.3, 0.95] } },
};

// Driven by the panel's already-computed `inView` (set via a real,
// properly-boxed element's own whileInView/onViewportEnter in
// FeatureTutorialPanel) rather than attaching a second IntersectionObserver
// here — this wrapper uses `display: contents` so it doesn't add a flex
// item to VisualCardShell's `gap-5` content column, and an element with no
// box of its own can't reliably drive its own IntersectionObserver anyway.
// It has no opacity/transform of its own (empty hidden/show objects,
// just stagger timing) — only orchestrates variant propagation down to
// the Row children, which do the actual visible animating.
function Cascade({ reducedMotion, inView, children }: { reducedMotion: boolean; inView: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      className="contents"
      initial="hidden"
      animate={reducedMotion ? "show" : inView ? "show" : "hidden"}
      variants={reducedMotion ? undefined : listVariants}
    >
      {children}
    </motion.div>
  );
}

function Row({ reducedMotion, className, children }: { reducedMotion: boolean; className?: string; children: React.ReactNode }) {
  return (
    <motion.div className={className} variants={reducedMotion ? undefined : rowVariants}>
      {children}
    </motion.div>
  );
}

/* ─── Search ─── */
export const SearchVisual = ({ activeStep, inView }: { activeStep: number; inView: boolean }) => {
  const reducedMotion = useReducedMotion();
  return (
    <VisualCardShell icon={Search} label="Search preview" tag="Illustrative — not live data">
      <Cascade reducedMotion={reducedMotion} inView={inView}>
        <Row reducedMotion={reducedMotion}>
          <div
            className="rounded-full px-5 py-3.5 flex items-center gap-2.5 text-[15px]"
            style={{ border: "1px solid rgba(255,45,161,0.3)", color: "rgba(255,255,255,0.85)" }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: ACCENT }} aria-hidden />
            <span>Maya Solano</span>
          </div>
        </Row>
        <Row reducedMotion={reducedMotion}>
          <AnimatePresence mode="wait">
            {activeStep === 0 && (
              <motion.div key="s0" {...fade(reducedMotion)} className="space-y-2">
                <p className="text-sm text-white/45">Type a name, stage name, or project.</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Event Producer", "Bali", "Beach Festival"].map((t) => (
                    <span key={t} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/40">{t}</span>
                  ))}
                </div>
              </motion.div>
            )}
            {activeStep === 1 && (
              <motion.div key="s1" {...fade(reducedMotion)} className="space-y-2.5">
                <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white shrink-0">MS</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-white truncate">Maya Solano</p>
                    <p className="text-xs text-white/45 truncate">Event Producer · Bali</p>
                  </div>
                  <span className="text-[10px] text-white/35 shrink-0">3 credits</span>
                </div>
                <p className="text-xs text-white/35">Matched on name + role — public record, no login needed to view.</p>
              </motion.div>
            )}
            {activeStep === 2 && (
              <motion.div key="s2" {...fade(reducedMotion)} className="space-y-2.5">
                <div className="flex items-center justify-between rounded-xl bg-white/[0.04] p-3.5">
                  <div>
                    <p className="text-[15px] font-medium text-white">Unclaimed record found</p>
                    <p className="text-xs text-white/45">3 credits, 0 confirmed</p>
                  </div>
                  <span className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shrink-0" style={{ backgroundColor: ACCENT }}>Claim</span>
                </div>
                <div className="space-y-1">
                  {["Beach Festival — Production", "Sunset Sessions EP", "Coastal Runway Show"].map((c) => (
                    <p key={c} className="text-xs text-white/40 truncate">· {c}</p>
                  ))}
                </div>
              </motion.div>
            )}
            {activeStep === 3 && (
              <motion.div key="s3" {...fade(reducedMotion)} className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Rocket className="h-4 w-4" style={{ color: ACCENT }} aria-hidden />
                  Continue to your Passport →
                </div>
                <p className="text-xs text-white/35">One link now holds every credit, co-sign, and opportunity.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Row>
      </Cascade>
    </VisualCardShell>
  );
};

/* ─── Passport ─── */
export const PassportVisual = ({ activeStep, inView }: { activeStep: number; inView: boolean }) => {
  const reducedMotion = useReducedMotion();
  const ring = (i: number) => (activeStep === i ? { border: "1px solid rgba(255,45,161,0.5)", boxShadow: "0 0 0 3px rgba(255,45,161,0.1)" } : { border: "1px solid rgba(255,255,255,0.08)" });
  return (
    <VisualCardShell icon={UserCheck} label="Passport preview" tag="Illustrative — not live data">
      <Cascade reducedMotion={reducedMotion} inView={inView}>
        <Row reducedMotion={reducedMotion}>
          <div className="rounded-xl p-4 flex items-center gap-3.5" style={ring(0)}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white shrink-0">MS</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">Maya Solano</p>
              <p className="text-xs text-white/45">Event Producer · Bali</p>
            </div>
            {activeStep === 0 && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: ACCENT }} aria-hidden />}
          </div>
        </Row>
        <Row reducedMotion={reducedMotion}>
          <div className="rounded-xl p-4" style={ring(1)}>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Credits</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="h-3.5 w-3.5" style={{ color: ACCENT }} aria-hidden />
                <span className="text-sm text-white/70">3 of 5 confirmed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <HandHeart className="h-3 w-3 text-white/35" aria-hidden />
                <span className="text-[10px] text-white/35">2 co-signed</span>
              </div>
            </div>
          </div>
        </Row>
        <Row reducedMotion={reducedMotion}>
          <div className="rounded-xl p-4" style={ring(2)}>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Bio</p>
            <p className="text-sm text-white/60 leading-relaxed">
              "Producer focused on large-scale beach festivals across Southeast Asia..."
              <FileEdit className="h-3.5 w-3.5 inline ml-2" style={{ color: ACCENT }} aria-hidden />
            </p>
            {activeStep === 2 && (
              <p className="text-[10px] text-white/35 mt-2">AI-drafted from your credits — fully editable before publish.</p>
            )}
          </div>
        </Row>
        <Row reducedMotion={reducedMotion}>
          <AnimatePresence mode="wait">
            {activeStep === 3 && (
              <motion.div key="publish" {...fade(reducedMotion)} className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ACCENT }}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Ready to publish
                </div>
                <p className="text-xs text-white/35">kretopia.com/maya-solano — your one shareable link.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Row>
      </Cascade>
    </VisualCardShell>
  );
};

/* ─── Scout ─── */
export const ScoutVisual = ({ activeStep, inView }: { activeStep: number; inView: boolean }) => {
  const reducedMotion = useReducedMotion();
  return (
    <VisualCardShell icon={Radar} label="Opportunity preview" tag="Illustrative — not live data">
      <Cascade reducedMotion={reducedMotion} inView={inView}>
        <Row reducedMotion={reducedMotion}>
          <div className="rounded-xl bg-white/[0.04] p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-semibold text-white">Stage Manager — Beach Festival</p>
              <span className="flex items-center gap-1 text-[10px] text-white/35 shrink-0"><Clock className="h-3 w-3" aria-hidden />2h ago</span>
            </div>
            <p className="text-xs text-white/45 mt-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />Bali · 3-day contract · $800–1,200</p>
          </div>
        </Row>
        <Row reducedMotion={reducedMotion}>
          <AnimatePresence mode="wait">
            {activeStep === 1 && (
              <motion.div key="s1" {...fade(reducedMotion)} className="space-y-2">
                <p className="text-xs text-white/45">Matches because:</p>
                <div className="flex flex-wrap gap-2">
                  {["Event Production", "Bali-based", "Team lead"].map((t) => (
                    <span key={t} className="rounded-full px-3 py-1.5 text-[11px] font-medium" style={{ backgroundColor: "rgba(255,45,161,0.12)", color: ACCENT, border: "1px solid rgba(255,45,161,0.25)" }}>
                      <Target className="h-3 w-3 inline mr-1" aria-hidden />{t}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
            {activeStep === 2 && (
              <motion.div key="s2" {...fade(reducedMotion)} className="space-y-2.5">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1">Kreto's draft pitch</p>
                  <p className="text-xs text-white/55 leading-snug line-clamp-2">"Hi — I produced three beach festivals in Bali last year, most recently..."</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>Apply</span>
                  <span className="flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/70"><Bookmark className="h-3.5 w-3.5" aria-hidden />Save</span>
                </div>
              </motion.div>
            )}
            {activeStep === 3 && (
              <motion.div key="s3" {...fade(reducedMotion)} className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <FolderKanban className="h-4 w-4" style={{ color: ACCENT }} aria-hidden />
                  Becomes a Studio project once confirmed
                </div>
                <p className="text-xs text-white/35">Brief, files, and payment stay in the same room from here.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Row>
      </Cascade>
    </VisualCardShell>
  );
};

/* ─── Match ─── */
export const MatchVisual = ({ activeStep, inView }: { activeStep: number; inView: boolean }) => {
  const reducedMotion = useReducedMotion();
  return (
    <VisualCardShell icon={Users} label="Collaborator preview" tag="Illustrative — not live data">
      <Cascade reducedMotion={reducedMotion} inView={inView}>
        <Row reducedMotion={reducedMotion}>
          <AnimatePresence mode="wait">
            {activeStep === 0 && (
              <motion.div key="s0" {...fade(reducedMotion)} className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {["Music Video", "Bali", "Editing"].map((t) => (
                    <span key={t} className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-white/60">{t}</span>
                  ))}
                </div>
                <p className="text-xs text-white/35">Narrowing to 6 real fits — not a cold list.</p>
              </motion.div>
            )}
            {activeStep >= 1 && (
              <motion.div key="s1" {...fade(reducedMotion)} className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white shrink-0">RK</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-white truncate">Riri Kusuma</p>
                  <p className="text-xs text-white/45 truncate">Shared: 2 credits, same city</p>
                </div>
                <span className="text-[10px] text-white/35 shrink-0">Editor</span>
              </motion.div>
            )}
          </AnimatePresence>
        </Row>
        <Row reducedMotion={reducedMotion}>
          <AnimatePresence mode="wait">
            {activeStep === 2 && (
              <motion.div key="s2" {...fade(reducedMotion)} className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <MessageCircle className="h-4 w-4" style={{ color: ACCENT }} aria-hidden />
                  Reach out
                </div>
                <p className="text-xs text-white/45 italic">"Loved your edit on Sunset Sessions — reaching out about a music video shoot..."</p>
              </motion.div>
            )}
            {activeStep === 3 && (
              <motion.div key="s3" {...fade(reducedMotion)} className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ACCENT }}>
                  <Handshake className="h-4 w-4" aria-hidden />
                  Bring them into a Studio project
                </div>
                <p className="text-xs text-white/35">Brief, files, and payment — no separate thread to manage.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Row>
      </Cascade>
    </VisualCardShell>
  );
};

/* ─── Studio ─── */
export const StudioVisual = ({ activeStep, inView }: { activeStep: number; inView: boolean }) => {
  const reducedMotion = useReducedMotion();
  const steps = ["Brief", "Collaborators", "Milestones", "Payment"];
  return (
    <VisualCardShell icon={ClipboardList} label="Studio preview" tag="Illustrative — not live data">
      <Cascade reducedMotion={reducedMotion} inView={inView}>
        <Row reducedMotion={reducedMotion}>
          <div className="rounded-xl bg-white/[0.04] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[15px] font-semibold text-white">Beach Festival — Production</p>
                <p className="text-xs text-white/45 mt-1">Event Production room</p>
              </div>
              <span className="text-[10px] text-white/35 shrink-0">3 collaborators</span>
            </div>
          </div>
        </Row>
        <Row reducedMotion={reducedMotion}>
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className="h-2 w-full rounded-full transition-colors duration-300"
                  style={{ backgroundColor: i <= activeStep ? ACCENT : "rgba(255,255,255,0.15)" }}
                />
                <span className="text-[10px] text-white/40">{s}</span>
              </div>
            ))}
          </div>
        </Row>
        <Row reducedMotion={reducedMotion}>
          <AnimatePresence mode="wait">
            {activeStep === 1 && (
              <motion.div key="s1" {...fade(reducedMotion)} className="space-y-2">
                <div className="flex -space-x-2.5">
                  {["MS", "RK", "MP"].map((i) => (
                    <span key={i} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white border-2" style={{ borderColor: "#0b0e16" }}>{i}</span>
                  ))}
                </div>
                <p className="text-xs text-white/35">Producer, Editor, Stage Manager — each with role-scoped access.</p>
              </motion.div>
            )}
            {activeStep === 2 && (
              <motion.div key="s2" {...fade(reducedMotion)} className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Milestone className="h-4 w-4" style={{ color: ACCENT }} aria-hidden />
                  2 of 4 milestones complete
                </div>
                <div className="space-y-1">
                  {[{ n: "Pre-production", done: true }, { n: "On-site setup", done: true }, { n: "Live show day", done: false }].map((m) => (
                    <p key={m.n} className="text-xs text-white/40 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3" style={{ color: m.done ? ACCENT : "rgba(255,255,255,0.2)" }} aria-hidden />
                      {m.n}
                    </p>
                  ))}
                </div>
              </motion.div>
            )}
            {activeStep === 3 && (
              <motion.div key="s3" {...fade(reducedMotion)} className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ACCENT }}>
                  <Banknote className="h-4 w-4" aria-hidden />
                  Invoice sent — awaiting payment
                </div>
                <p className="text-xs text-white/35">$1,100 · Invoice #0042 · Due in 5 days</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Row>
      </Cascade>
    </VisualCardShell>
  );
};

/* ─── SoundStages — Speed Session and Audition stay explicitly separate ─── */
export const SoundStagesVisual = ({ activeStep, inView }: { activeStep: number; inView: boolean }) => {
  const reducedMotion = useReducedMotion();
  return (
    <VisualCardShell icon={DoorOpen} label="SoundStages preview" tag="Illustrative — not live data">
      <Cascade reducedMotion={reducedMotion} inView={inView}>
        <Row reducedMotion={reducedMotion}>
          <AnimatePresence mode="wait">
            {activeStep === 0 && (
              <motion.div key="s0" {...fade(reducedMotion)} className="space-y-2.5">
                <div className="flex gap-2.5">
                  <span className="flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-semibold" style={{ backgroundColor: ACCENT, color: "#05070D" }}>Speed Session</span>
                  <span className="flex-1 rounded-xl border border-white/15 px-4 py-2.5 text-center text-sm text-white/70">Audition</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-[10px] text-white/40">
                  <p className="text-center">Live, rotating — show up</p>
                  <p className="text-center">Submit, host reviews</p>
                </div>
              </motion.div>
            )}
            {activeStep === 1 && (
              <motion.div key="s1" {...fade(reducedMotion)} className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Video className="h-4 w-4" style={{ color: ACCENT }} aria-hidden />
                  Speed Session — live now
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {["MS", "RK", "MP", "JL"].map((i) => (
                      <span key={i} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-white border-2" style={{ borderColor: "#0b0e16" }}>{i}</span>
                    ))}
                  </div>
                  <span className="text-[10px] text-white/35">new face every 4 minutes</span>
                </div>
              </motion.div>
            )}
            {activeStep === 2 && (
              <motion.div key="s2" {...fade(reducedMotion)} className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <UploadCloud className="h-4 w-4" style={{ color: ACCENT }} aria-hidden />
                  Audition — submission received
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/35">
                  <span className="flex items-center gap-1"><FileVideo className="h-3 w-3" aria-hidden />Video reel</span>
                  <span className="flex items-center gap-1"><Mic className="h-3 w-3" aria-hidden />Voice sample</span>
                </div>
                <p className="text-xs text-white/35">Host reviewing — shortlist invites go out within 48h.</p>
              </motion.div>
            )}
            {activeStep === 3 && (
              <motion.div key="s3" {...fade(reducedMotion)} className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ACCENT }}>
                  <Share2 className="h-4 w-4" aria-hidden />
                  Follow up via their Passport
                </div>
                <p className="text-xs text-white/35">Whoever you met stays reachable — no lost contact after the room closes.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Row>
      </Cascade>
    </VisualCardShell>
  );
};
