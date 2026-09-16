import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

export const ScenePay = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  // Scan flash
  const scanY = interpolate(frame, [50, 110], [0, 200], { extrapolateRight: "clamp" });
  const showExtracted = frame > 120;
  const lineW = interpolate(frame, [180, 230], [0, 100], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 30, flexDirection: "row" }}>
        {/* Receipt scan phone */}
        <div style={{ opacity: phoneIn, transform: `scale(0.85) translateX(${interpolate(phoneIn, [0, 1], [-50, 0])}px)` }}>
          <PhoneShell>
            <div style={{ height: 60 }} />
            <div style={{ padding: "12px 18px" }}>
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: COLORS.lime,
                  fontWeight: 700,
                }}
              >
                ThrivePay · Scan receipt
              </div>
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 16,
                  background: "#fff",
                  height: 380,
                  position: "relative",
                  overflow: "hidden",
                  padding: 18,
                  fontFamily: "'Courier New', monospace",
                  color: "#222",
                  fontSize: 12,
                }}
              >
                <div style={{ textAlign: "center", fontWeight: 800, fontSize: 16 }}>STUDIO 17</div>
                <div style={{ textAlign: "center", fontSize: 10, color: "#666" }}>Port of Spain · Trinidad</div>
                <div style={{ borderTop: "1px dashed #999", margin: "12px 0" }} />
                <div>Studio rental — 3 days</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span>3 × $1,500</span>
                  <span>$4,500.00</span>
                </div>
                <div>Lighting kit</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span>1 × $480</span>
                  <span>$480.00</span>
                </div>
                <div>Backdrop fee</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span>1 × $260</span>
                  <span>$260.00</span>
                </div>
                <div style={{ borderTop: "1px dashed #999", margin: "12px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                  <span>TOTAL</span>
                  <span>$5,240.00</span>
                </div>
                {/* scan line */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: scanY,
                    height: 4,
                    background: COLORS.lime,
                    boxShadow: `0 0 20px ${COLORS.lime}`,
                    opacity: frame < 115 ? 1 : 0,
                  }}
                />
                {/* corner brackets */}
                {[
                  { top: 8, left: 8, br: { borderTop: `3px solid ${COLORS.lime}`, borderLeft: `3px solid ${COLORS.lime}` } },
                  { top: 8, right: 8, br: { borderTop: `3px solid ${COLORS.lime}`, borderRight: `3px solid ${COLORS.lime}` } },
                  { bottom: 8, left: 8, br: { borderBottom: `3px solid ${COLORS.lime}`, borderLeft: `3px solid ${COLORS.lime}` } },
                  { bottom: 8, right: 8, br: { borderBottom: `3px solid ${COLORS.lime}`, borderRight: `3px solid ${COLORS.lime}` } },
                ].map((c, i) => (
                  <div key={i} style={{ position: "absolute", width: 24, height: 24, ...c, ...c.br }} />
                ))}
              </div>
            </div>
          </PhoneShell>
        </div>

        {showExtracted && (
          <div
            style={{
              opacity: interpolate(frame, [120, 145], [0, 1], { extrapolateRight: "clamp" }),
              transform: `translateX(${interpolate(frame, [120, 145], [40, 0], { extrapolateRight: "clamp" })}px)`,
            }}
          >
            <PhoneShell scale={0.85}>
              <div style={{ height: 60 }} />
              <div style={{ padding: "12px 18px" }}>
                <div
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: COLORS.lime,
                    fontWeight: 700,
                  }}
                >
                  Extracted in 1.2s
                </div>
                <div
                  style={{
                    color: COLORS.text,
                    fontFamily: FONTS.display,
                    fontWeight: 800,
                    fontSize: 36,
                    marginTop: 6,
                  }}
                >
                  $5,240.00
                </div>
                <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 13 }}>
                  Studio 17 · Studio rental · Mar 12
                </div>

                {[
                  { l: "Vendor", v: "Studio 17" },
                  { l: "Category", v: "Studio rental" },
                  { l: "Project", v: "Vogue Caribbean" },
                  { l: "Tax", v: "VAT 12.5%" },
                ].map((row, i) => {
                  const start = 130 + i * 12;
                  const o = interpolate(frame, [start, start + 14], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div
                      key={i}
                      style={{
                        opacity: o,
                        marginTop: 10,
                        padding: "10px 12px",
                        background: COLORS.surface,
                        borderRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        fontFamily: FONTS.display,
                      }}
                    >
                      <span style={{ color: COLORS.textMuted, fontSize: 12 }}>{row.l}</span>
                      <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{row.v}</span>
                    </div>
                  );
                })}

                {/* Money streak chip */}
                <div
                  style={{
                    marginTop: 16,
                    background: `linear-gradient(135deg, ${COLORS.lime}, ${COLORS.primary})`,
                    color: COLORS.bg,
                    padding: "10px 14px",
                    borderRadius: 12,
                    fontFamily: FONTS.display,
                    fontWeight: 800,
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  🔥 7-day money streak
                  <div style={{ flex: 1, height: 4, background: "rgba(0,0,0,0.2)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${lineW}%`, height: "100%", background: COLORS.bg }} />
                  </div>
                </div>
              </div>
            </PhoneShell>
          </div>
        )}
      </AbsoluteFill>
      <LowerThird kicker="ThrivePay · Expenses" title="Snap a receipt. Run the business side of your craft." />
    </AbsoluteFill>
  );
};
