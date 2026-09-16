import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

export const SceneClaim = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  // verification badges populate
  const badges = ["✓ Vogue Caribbean", "✓ Carnival 2024", "✓ Soca Monarch", "✓ TT Film Festival"];
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: phoneIn, transform: `scale(${interpolate(phoneIn, [0, 1], [0.95, 1])})` }}>
          <PhoneShell>
            <div style={{ height: 60 }} />
            <div style={{ padding: "16px 18px" }}>
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: COLORS.lime,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                Profile claimed
              </div>
              <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 800, fontSize: 26 }}>
                Michelene Auguste
              </div>
              <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 13, marginTop: 2 }}>
                Photographer · Producer
              </div>

              {/* hero card */}
              <div
                style={{
                  marginTop: 14,
                  height: 180,
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.lime}99)`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(circle at ${30 + Math.sin(frame / 30) * 20}% 50%, rgba(255,255,255,0.3), transparent 60%)`,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: 12,
                    left: 14,
                    fontFamily: FONTS.serif,
                    color: "#fff",
                    fontSize: 22,
                    fontStyle: "italic",
                  }}
                >
                  Verified Creative Resume
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {badges.map((b, i) => {
                  const start = 30 + i * 18;
                  const o = interpolate(frame, [start, start + 12], [0, 1], { extrapolateRight: "clamp" });
                  const x = interpolate(frame, [start, start + 14], [-30, 0], { extrapolateRight: "clamp" });
                  return (
                    <div
                      key={i}
                      style={{
                        opacity: o,
                        transform: `translateX(${x}px)`,
                        background: COLORS.bgCard,
                        border: `1px solid ${COLORS.lime}40`,
                        borderRadius: 10,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontFamily: FONTS.display,
                        color: COLORS.text,
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: COLORS.lime, fontWeight: 800 }}>{b.slice(0, 1)}</span>
                      <span>{b.slice(2)}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: COLORS.lime, letterSpacing: 1 }}>
                        VERIFIED
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="Verified credits" title="Your work, attested. Your reputation, portable." />
    </AbsoluteFill>
  );
};
