import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

export const SceneMatch = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  // swipe right at frame 80
  const swipeX = interpolate(frame, [80, 110], [0, 400], { extrapolateRight: "clamp" });
  const swipeRot = interpolate(frame, [80, 110], [0, 18], { extrapolateRight: "clamp" });
  const swipeO = interpolate(frame, [80, 110], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: phoneIn }}>
          <PhoneShell>
            <div style={{ height: 60 }} />
            <div style={{ padding: "12px 18px" }}>
              <div
                style={{
                  fontFamily: FONTS.display,
                  color: COLORS.text,
                  fontWeight: 800,
                  fontSize: 22,
                }}
              >
                Match
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: 12, fontFamily: FONTS.display, marginTop: 2 }}>
                Smart picks · for your next collab
              </div>

              {/* Card stack */}
              <div style={{ position: "relative", marginTop: 16, height: 480 }}>
                {/* back card */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: COLORS.surface,
                    borderRadius: 20,
                    transform: "translateY(10px) scale(0.96)",
                    opacity: 0.7,
                  }}
                />
                {/* front card */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 20,
                    overflow: "hidden",
                    background: `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.bg})`,
                    transform: `translateX(${swipeX}px) rotate(${swipeRot}deg)`,
                    opacity: swipeO,
                    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                  }}
                >
                  {/* fake portrait gradient */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: `radial-gradient(circle at 50% 30%, ${COLORS.primaryGlow}, transparent 60%), radial-gradient(circle at 50% 80%, #000, transparent 70%)`,
                    }}
                  />
                  {/* Match score chip */}
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      right: 14,
                      background: "rgba(0,0,0,0.6)",
                      border: `1px solid ${COLORS.lime}`,
                      borderRadius: 12,
                      padding: "8px 12px",
                      color: COLORS.lime,
                      fontFamily: FONTS.display,
                      fontWeight: 800,
                      fontSize: 18,
                    }}
                  >
                    94%
                    <div style={{ fontSize: 9, color: COLORS.text, letterSpacing: 1 }}>SMART MATCH</div>
                  </div>
                  <div style={{ position: "absolute", bottom: 70, left: 16, right: 16, color: "#fff" }}>
                    <div style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 800 }}>Aaliyah Khan</div>
                    <div style={{ fontFamily: FONTS.display, fontSize: 13, opacity: 0.9 }}>
                      Music Producer · 2.3km away
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      {["Afrobeats", "Soca", "RnB"].map((t) => (
                        <span
                          key={t}
                          style={{
                            background: "rgba(255,255,255,0.15)",
                            border: "1px solid rgba(255,255,255,0.25)",
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontFamily: FONTS.display,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* action btns */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 14,
                      left: 16,
                      right: 16,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.6)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                      }}
                    >
                      ✕
                    </div>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: COLORS.lime,
                        color: COLORS.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                        fontWeight: 800,
                        boxShadow: `0 0 20px ${COLORS.lime}80`,
                      }}
                    >
                      ✓
                    </div>
                  </div>
                  {frame > 70 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 30,
                        left: 30,
                        padding: "8px 16px",
                        border: `3px solid ${COLORS.lime}`,
                        color: COLORS.lime,
                        fontFamily: FONTS.display,
                        fontWeight: 800,
                        fontSize: 22,
                        borderRadius: 8,
                        transform: "rotate(-15deg)",
                        opacity: interpolate(frame, [70, 85], [0, 1], { extrapolateRight: "clamp" }),
                      }}
                    >
                      MATCH
                    </div>
                  )}
                </div>
              </div>
            </div>
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="Smart Match" title="Hinge for hires. One swipe to a real collaborator." />
    </AbsoluteFill>
  );
};
