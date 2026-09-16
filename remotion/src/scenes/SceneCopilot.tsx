import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

const PROMPT = "Draft an invoice for studio rental, $5,240, send to Vogue Caribbean";
const TOOLS = [
  { name: "draft_invoice", status: "✓", detail: "$5,240 · Vogue Caribbean" },
  { name: "attach_receipt", status: "✓", detail: "Studio rental · Mar 12" },
  { name: "send_invoice", status: "●", detail: "queued for send" },
];

export const SceneCopilot = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  const chars = Math.min(PROMPT.length, Math.floor(interpolate(frame, [25, 95], [0, PROMPT.length])));
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
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: FONTS.display,
                  color: COLORS.lime,
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.lime, boxShadow: `0 0 8px ${COLORS.lime}` }} />
                Thrive Copilot · agent
              </div>

              {/* user message */}
              <div
                style={{
                  marginTop: 14,
                  background: COLORS.primary,
                  color: "#fff",
                  borderRadius: 14,
                  padding: "12px 14px",
                  fontFamily: FONTS.display,
                  fontSize: 14,
                  marginLeft: 40,
                  lineHeight: 1.4,
                }}
              >
                {PROMPT.slice(0, chars)}
                {chars < PROMPT.length && (
                  <span style={{ borderRight: "2px solid #fff", marginLeft: 1 }}>&nbsp;</span>
                )}
              </div>

              {frame > 100 && (
                <div
                  style={{
                    marginTop: 14,
                    background: COLORS.bgCard,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 14,
                    padding: 14,
                    opacity: interpolate(frame, [100, 120], [0, 1], { extrapolateRight: "clamp" }),
                  }}
                >
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
                    Tool calls
                  </div>
                  {TOOLS.map((tool, i) => {
                    const start = 110 + i * 22;
                    const o = interpolate(frame, [start, start + 18], [0, 1], { extrapolateRight: "clamp" });
                    const isPending = tool.status === "●";
                    const pulse = 0.5 + 0.5 * Math.sin(frame / 5);
                    return (
                      <div
                        key={i}
                        style={{
                          opacity: o,
                          marginBottom: 8,
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: COLORS.surface,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: isPending ? COLORS.warn : COLORS.lime,
                            color: COLORS.bg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 800,
                            opacity: isPending ? pulse : 1,
                          }}
                        >
                          {isPending ? "…" : "✓"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: COLORS.lime, fontSize: 12, fontWeight: 700 }}>{tool.name}()</div>
                          <div style={{ color: COLORS.textMuted, fontSize: 11, fontFamily: FONTS.display }}>
                            {tool.detail}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {frame > 200 && (
                <div
                  style={{
                    marginTop: 14,
                    background: `${COLORS.lime}15`,
                    border: `1px solid ${COLORS.lime}80`,
                    borderRadius: 12,
                    padding: 14,
                    opacity: interpolate(frame, [200, 220], [0, 1], { extrapolateRight: "clamp" }),
                    transform: `scale(${interpolate(frame, [200, 220], [0.95, 1], { extrapolateRight: "clamp" })})`,
                  }}
                >
                  <div style={{ color: COLORS.lime, fontFamily: FONTS.display, fontWeight: 700, fontSize: 13 }}>
                    Invoice INV-2041 sent
                  </div>
                  <div style={{ color: COLORS.text, fontSize: 22, fontFamily: FONTS.display, fontWeight: 800, marginTop: 2 }}>
                    $5,240.00
                  </div>
                  <div style={{ color: COLORS.textMuted, fontSize: 11, fontFamily: FONTS.display }}>
                    to Vogue Caribbean · due in 14 days
                  </div>
                </div>
              )}
            </div>
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="Thrive Copilot" title="An agent that ships. Not a chatbot that talks." />
    </AbsoluteFill>
  );
};
