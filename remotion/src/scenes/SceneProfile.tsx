import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

// The Profile / EPK home — Instagram-style portfolio grid + tabs (Credits / Work With Me / Skills / Reviews).
export const SceneProfile = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 4, fps, config: { damping: 20 } });

  const tabs = ["Credits", "Hire", "Skills", "Reviews", "More"];
  const activeTab = frame < 120 ? 0 : frame < 200 ? 1 : 0;

  // Portfolio grid tiles — staggered reveal
  const tiles = [
    { g: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryGlow})`, label: "Vogue CB" },
    { g: `linear-gradient(135deg, #FF6B9D, #C44569)`, label: "Carnival" },
    { g: `linear-gradient(135deg, ${COLORS.lime}, #8FCB3A)`, label: "Soca '24" },
    { g: `linear-gradient(135deg, #F59E0B, #DC2626)`, label: "Editorial" },
    { g: `linear-gradient(135deg, #06B6D4, #6366F1)`, label: "TT Film" },
    { g: `linear-gradient(135deg, #8B5CF6, #EC4899)`, label: "Brand" },
    { g: `linear-gradient(135deg, #10B981, #059669)`, label: "Doc" },
    { g: `linear-gradient(135deg, #F472B6, #FB7185)`, label: "Lookbook" },
    { g: `linear-gradient(135deg, #FBBF24, #F59E0B)`, label: "Cover" },
  ];

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: phoneIn, transform: `scale(${interpolate(phoneIn, [0, 1], [0.95, 1])})` }}>
          <PhoneShell>
            <div style={{ height: 50 }} />
            {/* Header */}
            <div style={{ padding: "12px 16px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Avatar */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.lime})`,
                    padding: 2,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      background: COLORS.bgCard,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: FONTS.display,
                      fontWeight: 800,
                      color: COLORS.text,
                      fontSize: 22,
                    }}
                  >
                    MA
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 800, fontSize: 18 }}>
                      Michelene Auguste
                    </div>
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: COLORS.lime,
                        color: COLORS.bg,
                        fontSize: 10,
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✓
                    </div>
                  </div>
                  <div style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 12, marginTop: 2 }}>
                    Photographer · Producer · Port of Spain
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                    {[
                      { n: "47", l: "Credits" },
                      { n: "312", l: "Circle" },
                      { n: "4.9", l: "Rating" },
                    ].map((s, i) => (
                      <div key={i}>
                        <span style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 700, fontSize: 13 }}>
                          {s.n}
                        </span>
                        <span style={{ color: COLORS.textMuted, fontFamily: FONTS.display, fontSize: 11, marginLeft: 4 }}>
                          {s.l}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trust row */}
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {["✓ Verified", "★ Gold Vouched", "Founding Member"].map((b, i) => {
                  const o = interpolate(frame, [20 + i * 6, 32 + i * 6], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div
                      key={i}
                      style={{
                        opacity: o,
                        fontFamily: FONTS.display,
                        fontSize: 10,
                        fontWeight: 700,
                        color: COLORS.lime,
                        background: `${COLORS.lime}14`,
                        border: `1px solid ${COLORS.lime}40`,
                        padding: "4px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {b}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 6,
                padding: "8px 16px 10px",
                borderBottom: `1px solid ${COLORS.border}`,
                overflow: "hidden",
              }}
            >
              {tabs.map((t, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: i === activeTab ? COLORS.primary : `${COLORS.surface}`,
                    color: i === activeTab ? "#fff" : COLORS.textMuted,
                  }}
                >
                  {t}
                </div>
              ))}
            </div>

            {/* Portfolio grid (Credits view) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 3,
                padding: "10px 14px",
              }}
            >
              {tiles.map((tile, i) => {
                const start = 30 + i * 5;
                const o = interpolate(frame, [start, start + 14], [0, 1], { extrapolateRight: "clamp" });
                const s = interpolate(frame, [start, start + 18], [0.85, 1], { extrapolateRight: "clamp" });
                return (
                  <div
                    key={i}
                    style={{
                      opacity: o,
                      transform: `scale(${s})`,
                      aspectRatio: "1",
                      borderRadius: 6,
                      background: tile.g,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: 6,
                        fontFamily: FONTS.display,
                        fontSize: 9,
                        fontWeight: 700,
                        color: "#fff",
                        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                      }}
                    >
                      {tile.label}
                    </div>
                    {/* verified dot */}
                    <div
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: COLORS.lime,
                        color: COLORS.bg,
                        fontSize: 8,
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✓
                    </div>
                  </div>
                );
              })}
            </div>
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="Your profile" title="One link. Every credit. Verified by the people you worked with." />
    </AbsoluteFill>
  );
};
