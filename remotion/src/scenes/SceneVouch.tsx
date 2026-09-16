import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

const VOUCHES = [
  { name: "Renée Joseph", role: "Model", note: "Most prepared set I've ever shot." },
  { name: "Aaliyah Khan", role: "Stylist", note: "Ships on time. Pays on time." },
  { name: "Vogue Caribbean", role: "Producer", note: "Booking her again next quarter." },
];

export const SceneVouch = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  const badgePop = spring({ frame: frame - 100, fps, config: { damping: 10, stiffness: 180 } });
  const glow = 0.4 + 0.3 * Math.sin(frame / 8);

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: phoneIn }}>
          <PhoneShell>
            <div style={{ height: 60 }} />
            <div style={{ padding: "12px 18px" }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.lime, fontWeight: 700 }}>
                Vouches · Trust signal
              </div>

              {VOUCHES.map((v, i) => {
                const start = 20 + i * 24;
                const o = interpolate(frame, [start, start + 16], [0, 1], { extrapolateRight: "clamp" });
                const y = interpolate(frame, [start, start + 18], [20, 0], { extrapolateRight: "clamp" });
                return (
                  <div key={i} style={{
                    opacity: o, transform: `translateY(${y}px)`,
                    marginTop: 12, padding: 14, background: COLORS.bgCard, borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.lime})` }} />
                      <div>
                        <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 700, fontSize: 13 }}>{v.name}</div>
                        <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 11 }}>{v.role}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, color: COLORS.text, fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 14, lineHeight: 1.4 }}>
                      "{v.note}"
                    </div>
                  </div>
                );
              })}

              {/* Trust badge */}
              {frame > 100 && (
                <div style={{
                  marginTop: 16, padding: "14px 16px",
                  background: `linear-gradient(135deg, #FFD700, #F59E0B)`,
                  borderRadius: 14, display: "flex", alignItems: "center", gap: 12,
                  transform: `scale(${badgePop})`,
                  boxShadow: `0 0 ${20 + glow * 30}px rgba(255,215,0,${glow})`,
                }}>
                  <div style={{ fontSize: 28 }}>🛡️</div>
                  <div>
                    <div style={{ color: "#1A1300", fontFamily: FONTS.display, fontWeight: 800, fontSize: 14 }}>Gold Vouched</div>
                    <div style={{ color: "#3A2D00", fontFamily: FONTS.display, fontSize: 11 }}>3 verified peer endorsements</div>
                  </div>
                </div>
              )}
            </div>
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="Vouches" title="Reputation you can't fake. Earned, not bought." />
    </AbsoluteFill>
  );
};
