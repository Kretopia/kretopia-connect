import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

export const SceneEPK = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  const shareO = interpolate(frame, [120, 145], [0, 1], { extrapolateRight: "clamp" });
  const shareY = interpolate(frame, [120, 150], [40, 0], { extrapolateRight: "clamp" });
  const linkChars = Math.floor(interpolate(frame, [30, 70], [0, 30], { extrapolateRight: "clamp" }));
  const link = "kretopia.com/m/michelene".slice(0, linkChars);

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: phoneIn }}>
          <PhoneShell>
            <div style={{ height: 60 }} />
            <div style={{ padding: "12px 18px" }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.lime, fontWeight: 700 }}>
                Your One-Link EPK
              </div>
              {/* Hero portfolio grid */}
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{
                    aspectRatio: "1",
                    background: `linear-gradient(${135 + i * 30}deg, ${COLORS.primary}, ${COLORS.lime}80)`,
                    borderRadius: 8,
                    opacity: interpolate(frame, [10 + i * 4, 30 + i * 4], [0, 1], { extrapolateRight: "clamp" }),
                  }} />
                ))}
              </div>

              {/* link bar */}
              <div style={{
                marginTop: 14, padding: "12px 14px", background: COLORS.surface, borderRadius: 12,
                fontFamily: "ui-monospace, monospace", color: COLORS.lime, fontSize: 13, display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ color: COLORS.textMuted }}>🔗</span>
                {link}
                {linkChars < 30 && <span style={{ borderRight: `2px solid ${COLORS.lime}` }}>&nbsp;</span>}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                {["Rates", "Reel", "Reviews"].map((t, i) => (
                  <div key={i} style={{
                    flex: 1, padding: "10px 8px", background: COLORS.bgCard, borderRadius: 10,
                    textAlign: "center", fontFamily: FONTS.display, fontSize: 11, fontWeight: 600,
                    color: COLORS.text, border: `1px solid ${COLORS.border}`,
                    opacity: interpolate(frame, [80 + i * 8, 100 + i * 8], [0, 1], { extrapolateRight: "clamp" }),
                  }}>{t}</div>
                ))}
              </div>

              {/* Share sheet pop */}
              {frame > 120 && (
                <div style={{
                  position: "absolute", left: 12, right: 12, bottom: 14,
                  background: "#1F2233", borderRadius: 18, padding: 14,
                  opacity: shareO, transform: `translateY(${shareY}px)`,
                  border: `1px solid ${COLORS.border}`,
                }}>
                  <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 11, marginBottom: 10 }}>Share to</div>
                  <div style={{ display: "flex", gap: 12 }}>
                    {[
                      { c: "#25D366", l: "WhatsApp" },
                      { c: "#E4405F", l: "Instagram" },
                      { c: "#0A66C2", l: "LinkedIn" },
                      { c: COLORS.lime, l: "Copy" },
                    ].map((s, i) => (
                      <div key={i} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: s.c, margin: "0 auto" }} />
                        <div style={{ marginTop: 6, color: COLORS.text, fontFamily: FONTS.display, fontSize: 10 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="EPK · Creative Resume" title="One link. Everywhere. Booking-ready." />
    </AbsoluteFill>
  );
};
