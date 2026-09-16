import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

export const SceneInvoice = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  const sentPop = spring({ frame: frame - 180, fps, config: { damping: 12 } });
  const counter = Math.floor(interpolate(frame, [200, 280], [0, 5240], { extrapolateRight: "clamp" }));

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: phoneIn }}>
          <PhoneShell>
            <div style={{ height: 60 }} />
            <div style={{ padding: "12px 18px" }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.lime, fontWeight: 700 }}>
                ThrivePay · Invoice Copilot
              </div>
              <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 800, fontSize: 22, marginTop: 4 }}>
                Invoice INV-2041
              </div>

              {/* Invoice card */}
              <div style={{ marginTop: 14, background: "#fff", borderRadius: 16, padding: 16, color: "#1a1a1a", fontFamily: FONTS.display }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: "#666", textTransform: "uppercase", fontWeight: 700 }}>From</div>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>Michelene Auguste</div>
                  </div>
                  <div style={{ padding: "4px 8px", background: "#E6FBF8", color: "#20D3C2", fontSize: 9, fontWeight: 800, borderRadius: 6, letterSpacing: 1 }}>USD</div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: "#666", textTransform: "uppercase", fontWeight: 700 }}>Bill to</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Vogue Caribbean</div>
                </div>
                <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 10 }}>
                  {[
                    { l: "Editorial shoot · Spring '26", v: "$4,000.00" },
                    { l: "Studio rental (3 days)", v: "$1,240.00" },
                  ].map((row, i) => {
                    const o = interpolate(frame, [40 + i * 20, 60 + i * 20], [0, 1], { extrapolateRight: "clamp" });
                    return (
                      <div key={i} style={{ opacity: o, display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0" }}>
                        <span>{row.l}</span><span style={{ fontWeight: 700 }}>{row.v}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10, borderTop: "2px solid #1a1a1a", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, letterSpacing: 1, color: "#666", fontWeight: 700 }}>TOTAL</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "#20D3C2" }}>${counter.toLocaleString()}.00</span>
                </div>
              </div>

              {/* Sent confirmation */}
              {frame > 180 && (
                <div style={{
                  marginTop: 14, padding: "12px 14px",
                  background: `linear-gradient(135deg, ${COLORS.lime}, ${COLORS.primary})`,
                  borderRadius: 12, transform: `scale(${sentPop})`,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{ fontSize: 22 }}>✉️</div>
                  <div>
                    <div style={{ color: COLORS.bg, fontFamily: FONTS.display, fontWeight: 800, fontSize: 13 }}>Sent · Stripe + PowerTranz</div>
                    <div style={{ color: COLORS.bg, fontFamily: FONTS.display, fontSize: 10, opacity: 0.7 }}>Pay in USD or TTD · auto-reconciled</div>
                  </div>
                </div>
              )}

              {/* Money streak chip */}
              {frame > 240 && (
                <div style={{
                  marginTop: 10, padding: "10px 12px", background: COLORS.surface,
                  borderRadius: 10, display: "flex", alignItems: "center", gap: 8,
                  opacity: interpolate(frame, [240, 260], [0, 1], { extrapolateRight: "clamp" }),
                }}>
                  <span style={{ fontSize: 16 }}>🔥</span>
                  <span style={{ color: COLORS.text, fontFamily: FONTS.display, fontSize: 12, fontWeight: 700 }}>7-day money streak · keep going</span>
                </div>
              )}
            </div>
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="Invoice Copilot" title="From shoot to sent invoice in one prompt." />
    </AbsoluteFill>
  );
};
