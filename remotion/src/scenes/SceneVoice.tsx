import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

const TRANSCRIPT = "Three-day shoot in Tobago. Need a producer, MUA, and second shooter. Budget around four grand.";
const TASKS = [
  { t: "Lock location · Tobago", a: "Producer", d: "Mar 12" },
  { t: "Book MUA + 2nd shooter", a: "Michelene", d: "Mar 14" },
  { t: "Send brief + budget", a: "Producer", d: "Mar 15" },
];

export const SceneVoice = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  const chars = Math.min(TRANSCRIPT.length, Math.floor(interpolate(frame, [40, 130], [0, TRANSCRIPT.length])));
  const showTasks = frame >= 140;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: phoneIn }}>
          <PhoneShell>
            <div style={{ height: 60 }} />
            <div style={{ padding: "12px 18px" }}>
              <div style={{ fontFamily: FONTS.display, color: COLORS.text, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.lime, fontWeight: 700 }}>
                Studio Room · Voice Brief
              </div>
              <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 800, fontSize: 22, marginTop: 4 }}>
                Vogue Caribbean — Cover Shoot
              </div>

              {/* mic + waveform */}
              <div
                style={{
                  marginTop: 16,
                  background: COLORS.bgCard,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: "50%",
                      background: COLORS.lime,
                      color: COLORS.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      boxShadow: `0 0 ${20 + pulse * 30}px ${COLORS.lime}80`,
                    }}
                  >
                    ●
                  </div>
                  <div style={{ flex: 1, display: "flex", gap: 3, alignItems: "center", height: 40 }}>
                    {Array.from({ length: 30 }).map((_, i) => {
                      const h = 6 + Math.abs(Math.sin((frame + i * 5) / 6)) * 30;
                      return (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            height: h,
                            background: COLORS.lime,
                            borderRadius: 2,
                            opacity: frame < 130 ? 1 : 0.3,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 14,
                    fontFamily: FONTS.serif,
                    fontStyle: "italic",
                    fontSize: 18,
                    color: COLORS.text,
                    lineHeight: 1.4,
                    minHeight: 90,
                  }}
                >
                  "{TRANSCRIPT.slice(0, chars)}
                  {chars < TRANSCRIPT.length && (
                    <span style={{ borderRight: `2px solid ${COLORS.lime}`, marginLeft: 2 }}>&nbsp;</span>
                  )}
                  {chars >= TRANSCRIPT.length && '"'}
                </div>
              </div>

              {showTasks && (
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 11,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: COLORS.textMuted,
                      marginBottom: 8,
                    }}
                  >
                    Tasks · auto-generated
                  </div>
                  {TASKS.map((task, i) => {
                    const start = 145 + i * 12;
                    const o = interpolate(frame, [start, start + 14], [0, 1], { extrapolateRight: "clamp" });
                    const x = interpolate(frame, [start, start + 14], [30, 0], { extrapolateRight: "clamp" });
                    return (
                      <div
                        key={i}
                        style={{
                          opacity: o,
                          transform: `translateX(${x}px)`,
                          background: COLORS.surface,
                          borderLeft: `3px solid ${COLORS.lime}`,
                          borderRadius: 8,
                          padding: "10px 12px",
                          marginBottom: 8,
                          fontFamily: FONTS.display,
                        }}
                      >
                        <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 600 }}>{task.t}</div>
                        <div style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>
                          {task.a} · due {task.d}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="Voice → Brief" title="Speak the project. Tasks write themselves." />
    </AbsoluteFill>
  );
};
