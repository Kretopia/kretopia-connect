import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

const ROLES = [
  { role: "Photographer", name: "Michelene Auguste", verified: true },
  { role: "Stylist", name: "Aaliyah Khan", verified: true },
  { role: "MUA", name: "Jordan Pierre", verified: true },
  { role: "Model", name: "Renée Joseph", verified: true },
  { role: "Producer", name: "Vogue Caribbean", verified: true },
];

export const SceneRollCall = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: phoneIn }}>
          <PhoneShell>
            <div style={{ height: 60 }} />
            <div style={{ padding: "12px 18px" }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.lime, fontWeight: 700 }}>
                Production · Roll Call
              </div>
              <div style={{ color: COLORS.text, fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 26, marginTop: 4 }}>
                Vogue Caribbean — Spring '26
              </div>
              <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 12, marginTop: 2 }}>
                Editorial · Port of Spain · 5 credits
              </div>

              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {ROLES.map((r, i) => {
                  const start = 20 + i * 22;
                  const o = interpolate(frame, [start, start + 14], [0, 1], { extrapolateRight: "clamp" });
                  const x = interpolate(frame, [start, start + 16], [-20, 0], { extrapolateRight: "clamp" });
                  return (
                    <div key={i} style={{
                      opacity: o, transform: `translateX(${x}px)`,
                      background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12,
                      padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.lime})` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>{r.role}</div>
                        <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                      </div>
                      <div style={{ color: COLORS.lime, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>✓ VERIFIED</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="Kretopia Verified" title="IMDb for the creative industry. Every credit, attested." />
    </AbsoluteFill>
  );
};
