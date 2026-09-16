import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

const FULL = "Michelene Auguste";

export const SceneSearch = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  // typewriter
  const charsToShow = Math.min(FULL.length, Math.floor(interpolate(frame, [25, 95], [0, FULL.length])));
  const typed = FULL.slice(0, charsToShow);
  const showResults = frame >= 100;
  const resultsO = interpolate(frame, [100, 130], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            transform: `translateY(${interpolate(phoneIn, [0, 1], [80, 0])}px)`,
            opacity: phoneIn,
          }}
        >
          <PhoneShell>
            {/* status bar */}
            <div style={{ height: 60 }} />
            {/* search header */}
            <div style={{ padding: "20px 18px 12px" }}>
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontWeight: 800,
                  fontSize: 22,
                  color: COLORS.lime,
                  letterSpacing: -0.5,
                }}
              >
                Kretopia
              </div>
              <div
                style={{
                  marginTop: 14,
                  background: COLORS.bgCard,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 14,
                  padding: "14px 16px",
                  fontFamily: FONTS.display,
                  fontSize: 18,
                  color: COLORS.text,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  boxShadow: frame > 90 ? `0 0 0 2px ${COLORS.lime}` : "none",
                }}
              >
                <span style={{ color: COLORS.textMuted, fontSize: 16 }}>⌕</span>
                <span>{typed}</span>
                {!showResults && (
                  <span
                    style={{
                      width: 2,
                      height: 18,
                      background: COLORS.lime,
                      opacity: Math.floor(frame / 5) % 2,
                    }}
                  />
                )}
              </div>
            </div>

            {showResults && (
              <div style={{ padding: "8px 18px", opacity: resultsO }}>
                <div
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: COLORS.textMuted,
                    marginBottom: 10,
                  }}
                >
                  Knowledge card · pulled from the web
                </div>
                <div
                  style={{
                    background: COLORS.bgCard,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 18,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.lime})`,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 700, fontSize: 18 }}>
                        Michelene Auguste
                      </div>
                      <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 13, marginTop: 2 }}>
                        Photographer · Producer · Trinidad
                      </div>
                    </div>
                    <div
                      style={{
                        background: `${COLORS.lime}20`,
                        color: COLORS.lime,
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontFamily: FONTS.display,
                        fontWeight: 700,
                        letterSpacing: 1,
                      }}
                    >
                      UNCLAIMED
                    </div>
                  </div>
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { p: "Vogue Caribbean", t: "Editorial — Cover, Sept '24" },
                      { p: "Carnival 2024", t: "Documentary photo series" },
                      { p: "Soca Monarch", t: "Production — BTS film" },
                    ].map((c, i) => (
                      <div
                        key={i}
                        style={{
                          opacity: interpolate(frame - (140 + i * 12), [0, 14], [0, 1], { extrapolateRight: "clamp" }),
                          transform: `translateX(${interpolate(frame - (140 + i * 12), [0, 14], [-20, 0], {
                            extrapolateRight: "clamp",
                          })}px)`,
                          background: COLORS.surface,
                          borderRadius: 10,
                          padding: "10px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontFamily: FONTS.display,
                        }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: COLORS.lime,
                            color: COLORS.bg,
                            fontSize: 11,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                          }}
                        >
                          ✓
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{c.p}</div>
                          <div style={{ color: COLORS.textMuted, fontSize: 11 }}>{c.t}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {frame > 195 && (
                    <div
                      style={{
                        marginTop: 14,
                        background: COLORS.lime,
                        color: COLORS.bg,
                        textAlign: "center",
                        padding: "12px",
                        borderRadius: 10,
                        fontFamily: FONTS.display,
                        fontWeight: 700,
                        fontSize: 14,
                        opacity: interpolate(frame, [195, 215], [0, 1], { extrapolateRight: "clamp" }),
                        transform: `scale(${interpolate(frame, [195, 215], [0.95, 1], { extrapolateRight: "clamp" })})`,
                      }}
                    >
                      Claim profile · Free
                    </div>
                  )}
                </div>
              </div>
            )}
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="Search · Discover" title="Type a name. We surface the work." />
    </AbsoluteFill>
  );
};
