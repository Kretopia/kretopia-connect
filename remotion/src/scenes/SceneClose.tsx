import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Backdrop, Eyebrow } from "../components/UI";
import { COLORS, FONTS } from "../theme";

export const SceneClose = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleSpring = spring({ frame: frame - 8, fps, config: { damping: 18 } });
  const wordmarkO = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });
  const tagO = interpolate(frame, [85, 110], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 }}>
        <Eyebrow delay={0}>The Creative OS</Eyebrow>
        <div
          style={{
            marginTop: 32,
            fontFamily: FONTS.display,
            fontWeight: 800,
            fontSize: 200,
            color: COLORS.text,
            letterSpacing: -8,
            lineHeight: 0.95,
            textAlign: "center",
            opacity: titleSpring,
            transform: `scale(${interpolate(titleSpring, [0, 1], [0.9, 1])})`,
          }}
        >
          Thrive
          <span style={{ color: COLORS.lime }}>IN</span>
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: FONTS.serif,
            fontStyle: "italic",
            fontSize: 38,
            color: COLORS.textMuted,
            opacity: wordmarkO,
          }}
        >
          Search · Claim · Match · Make · Get paid.
        </div>
        <div
          style={{
            marginTop: 80,
            fontFamily: FONTS.display,
            fontSize: 20,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: COLORS.lime,
            opacity: tagO,
          }}
        >
          kretopia.com
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
