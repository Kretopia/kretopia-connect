import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

const GIGS = [
  { title: "Lookbook Photographer", brand: "Meiling Inc", pay: "$3,200", tag: "PAID", scout: true },
  { title: "Soca Music Video — DP", brand: "Machel Montano", pay: "$8,500", tag: "PAID" },
  { title: "Carnival Stylist", brand: "Tribe", pay: "Trade", tag: "EXCHANGE" },
];

export const SceneGigs = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  const claimPop = spring({ frame: frame - 200, fps, config: { damping: 10, stiffness: 180 } });

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: phoneIn }}>
          <PhoneShell>
            <div style={{ height: 60 }} />
            <div style={{ padding: "12px 18px" }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.lime, fontWeight: 700 }}>
                Gigs · For you
              </div>
              <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 800, fontSize: 20, marginTop: 4 }}>
                3 new matches today
              </div>

              {GIGS.map((g, i) => {
                const start = 20 + i * 30;
                const o = interpolate(frame, [start, start + 18], [0, 1], { extrapolateRight: "clamp" });
                const y = interpolate(frame, [start, start + 20], [30, 0], { extrapolateRight: "clamp" });
                const isPaid = g.tag === "PAID";
                return (
                  <div key={i} style={{
                    opacity: o, transform: `translateY(${y}px)`,
                    marginTop: 12, padding: 14, background: COLORS.bgCard, borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{
                        padding: "3px 8px", borderRadius: 4,
                        background: isPaid ? COLORS.lime : COLORS.warn,
                        color: COLORS.bg, fontFamily: FONTS.display, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                      }}>{g.tag}</div>
                      {g.scout && (
                        <div style={{ padding: "3px 8px", borderRadius: 4, background: COLORS.surface, color: COLORS.lime, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>SCOUTED</div>
                      )}
                    </div>
                    <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 700, fontSize: 14 }}>{g.title}</div>
                    <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 12 }}>{g.brand}</div>
                    <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ color: COLORS.lime, fontFamily: FONTS.display, fontWeight: 800, fontSize: 16 }}>{g.pay}</div>
                      {i === 0 && frame > 200 && (
                        <div style={{
                          padding: "8px 14px", background: COLORS.lime, color: COLORS.bg,
                          borderRadius: 8, fontFamily: FONTS.display, fontSize: 12, fontWeight: 800,
                          transform: `scale(${claimPop})`,
                        }}>Claim →</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="Gigs · Scout & Claim" title="Real work. From real brands. Brought to you." />
    </AbsoluteFill>
  );
};
