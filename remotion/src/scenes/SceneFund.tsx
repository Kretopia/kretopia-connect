import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

export const SceneFund = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  const progress = interpolate(frame, [40, 200], [0, 0.78], { extrapolateRight: "clamp" });
  const raised = Math.floor(interpolate(frame, [40, 200], [0, 23400], { extrapolateRight: "clamp" }));
  const backers = Math.floor(interpolate(frame, [40, 200], [0, 142], { extrapolateRight: "clamp" }));

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: phoneIn }}>
          <PhoneShell>
            <div style={{ height: 60 }} />
            <div style={{ padding: "12px 18px" }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.lime, fontWeight: 700 }}>
                ThriveFund · Live campaign
              </div>

              {/* Hero image */}
              <div style={{
                marginTop: 12, height: 160, borderRadius: 14,
                background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.lime})`,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background: `radial-gradient(circle at 60% 40%, rgba(255,255,255,0.3), transparent 60%)`,
                }} />
                <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
                  <div style={{ color: "#fff", fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 22, lineHeight: 1.1 }}>
                    Caribbean Lens
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.85)", fontFamily: FONTS.display, fontSize: 11 }}>A short film by Michelene</div>
                </div>
              </div>

              {/* Progress */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 800, fontSize: 24 }}>
                    ${raised.toLocaleString()}
                  </div>
                  <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 11 }}>of $30,000 goal</div>
                </div>
                <div style={{ marginTop: 8, height: 8, background: COLORS.surface, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${progress * 100}%`, height: "100%",
                    background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.lime})`,
                  }} />
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 14 }}>
                  <div>
                    <div style={{ color: COLORS.lime, fontFamily: FONTS.display, fontWeight: 800, fontSize: 16 }}>{backers}</div>
                    <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 10 }}>backers</div>
                  </div>
                  <div>
                    <div style={{ color: COLORS.lime, fontFamily: FONTS.display, fontWeight: 800, fontSize: 16 }}>14</div>
                    <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 10 }}>days left</div>
                  </div>
                </div>
              </div>

              {/* Back button */}
              {frame > 220 && (
                <div style={{
                  marginTop: 14, padding: "14px 16px",
                  background: `linear-gradient(135deg, ${COLORS.lime}, ${COLORS.primary})`,
                  borderRadius: 12, color: COLORS.bg, fontFamily: FONTS.display, fontWeight: 800, fontSize: 14,
                  textAlign: "center",
                  opacity: interpolate(frame, [220, 240], [0, 1], { extrapolateRight: "clamp" }),
                }}>
                  Back this project
                </div>
              )}
            </div>
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="ThriveFund" title="Audiences fund the work. You keep the rights." />
    </AbsoluteFill>
  );
};
