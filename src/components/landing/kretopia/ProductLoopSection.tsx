import { motion } from "framer-motion";
import { KretopiaIcon } from "@/components/pricing/KretopiaIcon";

const STEPS = [
  {
    key: "passport",
    label: "Passport",
    destination: "/profile",
    icon: "passport",
    description: "Your professional identity",
  },
  {
    key: "scout",
    label: "Scout",
    destination: "/scout",
    icon: "scout",
    description: "Discover opportunities",
  },
  {
    key: "match",
    label: "Match",
    destination: "/match",
    icon: "match",
    description: "Connect with people",
  },
  {
    key: "studio",
    label: "Studio",
    destination: "/desk",
    icon: "studio",
    description: "Build and deliver projects",
  },
  {
    key: "completed-work",
    label: "Completed Work",
    destination: "/credits",
    icon: "success",
    description: "Turn work into proof",
  },
  {
    key: "stronger-passport",
    label: "Stronger Passport",
    destination: "/profile",
    icon: "generate",
    description: "Grow your professional record",
  },
] as const;

export const ProductLoopSection = () => {
  return (
    <section
      id="chapter-loop"
      className="landing-section relative overflow-hidden"
      aria-labelledby="product-loop-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-12 h-[420px] w-[420px] rounded-full blur-[120px]"
        style={{ background: "hsl(var(--foreground) / 0.035)" }}
      />

      <div className="relative mx-auto max-w-[1320px]">
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7 }}
          className="grid items-end gap-6 lg:grid-cols-12 lg:gap-16"
        >
          <div className="lg:col-span-7">
            <p className="landing-eyebrow mb-4">One connected ecosystem</p>
            <h2
              id="product-loop-title"
              data-kreto-backflip
              className="landing-h2 landing-glow"
            >
              Your work creates
              <br />
              <span className="landing-accent">what comes next</span>
            </h2>
          </div>

          <p className="landing-sub max-w-xl lg:col-span-5 lg:pb-1">
            Kretopia connects your professional identity, the opportunities
            and people you discover, the projects you build and the outcomes
            you can prove. Each part gives the next one more meaning.
          </p>
        </motion.div>

        <motion.div
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-12"
        >
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 xl:gap-4"
            aria-label="The Kretopia product journey"
          >
            {STEPS.map((step, index) => (
              <div key={step.key} className="relative min-w-0">
                <motion.div
                  initial={false}
                  whileHover="hover"
                  className="group relative flex min-h-[132px] w-full flex-col items-center justify-center overflow-hidden rounded-[16px] border border-white/[0.12] bg-[linear-gradient(150deg,#1A1B20_7.74%,#0B0C10_92.26%)] px-3 py-5 text-center transition-colors duration-300 ease-out hover:border-white/25 hover:bg-[linear-gradient(150deg,#22232A_7.74%,#101116_92.26%)] hover:shadow-[0_16px_38px_-22px_rgba(180,38,220,0.4)]"
                  variants={{
                    rest: { y: 0 },
                    hover: { y: -3 },
                  }}
                  animate="rest"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-5 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ backgroundImage: "var(--k-text-gradient)" }}
                  />

                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] transition-all duration-300 group-hover:border-white/[0.14] group-hover:bg-white/[0.07]">
                    <KretopiaIcon
                      name={step.icon}
                      size={25}
                      paint="gradient"
                      className="transition-transform duration-300 group-hover:scale-110"
                    />
                  </span>

                  <span className="relative grid min-h-[32px] w-full place-items-center">
                    <motion.span
                      variants={{
                        rest: { opacity: 1, y: 0, filter: "blur(0px)" },
                        hover: { opacity: 0, y: -7, filter: "blur(3px)" },
                      }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="col-start-1 row-start-1 text-[10px] font-semibold uppercase leading-4 tracking-[1.15px] text-[#E0E0E8] sm:text-[11px]"
                      style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                    >
                      {step.label}
                    </motion.span>

                    <motion.span
                      variants={{
                        rest: { opacity: 0, y: 7, filter: "blur(3px)" },
                        hover: { opacity: 1, y: 0, filter: "blur(0px)" },
                      }}
                      transition={{ duration: 0.28, delay: 0.04, ease: "easeOut" }}
                      className="col-start-1 row-start-1 text-[10px] font-semibold leading-4 text-white sm:text-[11px]"
                      style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                    >
                      {step.description}
                    </motion.span>
                  </span>

                  <motion.span
                    variants={{
                      rest: { opacity: 1, y: 0 },
                      hover: { opacity: 0, y: 5 },
                    }}
                    transition={{ duration: 0.2 }}
                    className="mt-1.5 text-[10px] leading-4 text-[#858591]"
                    style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                  >
                    {step.description}
                  </motion.span>
                </motion.div>

                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-[11px] top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.09] bg-[#0A0A0D] text-white/45 xl:flex"
                  >
                    <KretopiaIcon name="arrow-right" size={11} />
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-center justify-center gap-2 text-center">
            <div className="flex items-center gap-2">
              <KretopiaIcon
                name="refresh"
                size={15}
                paint="gradient"
                aria-hidden="true"
              />
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
                Every completed project strengthens your Passport.
              </p>
            </div>
            <div
              aria-hidden="true"
              className="h-px w-24 opacity-50"
              style={{ backgroundImage: "var(--k-text-gradient)" }}
            />
          </div>
        </motion.div>

        <p className="mt-7 text-center text-xs text-muted-foreground/60">
          Kreto accompanies the journey — from the first connection to the
          completed work.
        </p>
      </div>
    </section>
  );
};

export default ProductLoopSection;
