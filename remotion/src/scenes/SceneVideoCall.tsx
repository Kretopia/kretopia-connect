import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, PhoneShell, LowerThird } from "../components/UI";
import { COLORS, FONTS } from "../theme";

const PEEPS = [
  { c: `linear-gradient(135deg, #20D3C2, #D4FF3E)`, name: "Michelene" },
  { c: `linear-gradient(135deg, #E4405F, #F59E0B)`, name: "Aaliyah" },
  { c: `linear-gradient(135deg, #25D366, #20D3C2)`, name: "Jordan" },
  { c: `linear-gradient(135deg, #D4FF3E, #25D366)`, name: "Renée" },
];

export const SceneVideoCall = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  const ringFlash = frame < 40 ? 0.3 + 0.4 * Math.sin(frame / 3) : 0;
  const callerId = interpolate(frame, [0, 25], [-60, 0], { extrapolateRight: "clamp" });
  const gridIn = spring({ frame: frame - 60, fps, config: { damping: 18 } });
  const liveDot = 0.5 + 0.5 * Math.sin(frame / 6);

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: phoneIn }}>
          <PhoneShell>
            <div style={{ height: 60 }} />
            {/* Incoming call top sheet */}
            {frame < 60 && (
              <div style={{
                position: "absolute", top: 70, left: 14, right: 14,
                background: COLORS.bgCard, border: `1px solid ${COLORS.lime}80`,
                borderRadius: 18, padding: 14, display: "flex", alignItems: "center", gap: 12,
                transform: `translateY(${callerId}px)`,
                boxShadow: `0 0 30px rgba(212,255,62,${ringFlash})`,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: PEEPS[1].c }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: COLORS.lime, fontFamily: FONTS.display, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>Incoming Studio call</div>
                  <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontWeight: 700, fontSize: 14 }}>Vogue Caribbean · Spring '26</div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📞</div>
              </div>
            )}

            {/* Call grid */}
            {frame >= 60 && (
              <div style={{ padding: 14, paddingTop: 70, opacity: gridIn }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", opacity: liveDot }} />
                  <div style={{ color: COLORS.text, fontFamily: FONTS.display, fontSize: 12, fontWeight: 700 }}>LIVE · 4 in studio</div>
                  <div style={{ marginLeft: "auto", color: COLORS.textMuted, fontFamily: "ui-monospace, monospace", fontSize: 11 }}>00:42</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {PEEPS.map((p, i) => (
                    <div key={i} style={{
                      aspectRatio: "1",
                      background: p.c,
                      borderRadius: 14,
                      position: "relative",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        position: "absolute", inset: 0,
                        background: `radial-gradient(circle at ${30 + Math.sin((frame + i * 20) / 20) * 30}% 50%, rgba(255,255,255,0.25), transparent 60%)`,
                      }} />
                      {i === 0 && (
                        <div style={{ position: "absolute", top: 6, right: 6, padding: "3px 6px", background: COLORS.lime, color: COLORS.bg, fontFamily: FONTS.display, fontSize: 9, fontWeight: 800, borderRadius: 4 }}>YOU</div>
                      )}
                      <div style={{ position: "absolute", bottom: 6, left: 8, color: "#fff", fontFamily: FONTS.display, fontSize: 11, fontWeight: 700, textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>{p.name}</div>
                    </div>
                  ))}
                </div>
                {/* Controls */}
                <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 14 }}>
                  {["🎤", "📹", "🖥️", "✕"].map((c, i) => (
                    <div key={i} style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: i === 3 ? "#EF4444" : COLORS.surface,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                    }}>{c}</div>
                  ))}
                </div>
              </div>
            )}
          </PhoneShell>
        </div>
      </AbsoluteFill>
      <LowerThird kicker="Studio Calls" title="One tap. The whole crew on set — virtually." />
    </AbsoluteFill>
  );
};
