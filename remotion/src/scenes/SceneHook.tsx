import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, Eyebrow } from "../components/UI";
import { COLORS, FONTS } from "../theme";

export const SceneHook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleSpring = spring({ frame: frame - 10, fps, config: { damping: 18 } });
  const subO = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const lineW = interpolate(frame, [55, 90], [0, 100], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 }}>
        <Eyebrow delay={0}>Day in the life · Creative</Eyebrow>
        <h1
          style={{
            fontFamily: FONTS.display,
            fontSize: 180,
            fontWeight: 800,
            color: COLORS.text,
            letterSpacing: -6,
            lineHeight: 0.95,
            textAlign: "center",
            margin: "32px 0 0",
            transform: `translateY(${interpolate(titleSpring, [0, 1], [60, 0])}px) scale(${interpolate(
              titleSpring,
              [0, 1],
              [0.92, 1]
            )})`,
            opacity: titleSpring,
          }}
        >
          The work is{" "}
          <span style={{ fontFamily: FONTS.serif, fontStyle: "italic", color: COLORS.lime, fontWeight: 400 }}>
            real.
          </span>
          <br />
          The proof should be too.
        </h1>
        <div style={{ marginTop: 40, height: 2, width: 600, background: `${COLORS.border}` }}>
          <div style={{ height: "100%", width: `${lineW}%`, background: COLORS.lime }} />
        </div>
        <p
          style={{
            marginTop: 28,
            fontFamily: FONTS.display,
            fontSize: 24,
            color: COLORS.textMuted,
            opacity: subO,
            letterSpacing: 1,
          }}
        >
          Kretopia — the operating system for creatives
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
