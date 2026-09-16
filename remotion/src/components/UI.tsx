import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";

/** Full-bleed animated dark gradient backdrop with drifting glow blobs. */
export const Backdrop = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 60;
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.primary}40 0%, transparent 60%)`,
          left: 100 + drift,
          top: -200,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.lime}25 0%, transparent 60%)`,
          right: 50 - drift,
          bottom: -200,
          filter: "blur(40px)",
        }}
      />
      {/* subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          opacity: 0.6,
        }}
      />
    </AbsoluteFill>
  );
};

/** Editorial label — small uppercase chip with lime dot. */
export const Eyebrow = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(frame - delay, [0, 14], [10, 0], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        borderRadius: 999,
        background: "rgba(212,255,62,0.08)",
        border: `1px solid ${COLORS.lime}40`,
        color: COLORS.lime,
        fontFamily: "'Inter', sans-serif",
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: 2,
        textTransform: "uppercase",
        opacity: o,
        transform: `translateY(${y}px)`,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.lime }} />
      {children}
    </div>
  );
};

/** Phone shell — iPhone-ish frame, content fills 360x780 inner. */
export const PhoneShell = ({ children, scale = 1 }: { children: React.ReactNode; scale?: number }) => {
  return (
    <div
      style={{
        width: 380 * scale,
        height: 800 * scale,
        background: "#000",
        borderRadius: 50 * scale,
        padding: 10 * scale,
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 2px rgba(255,255,255,0.05)",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 40 * scale,
          background: COLORS.bg,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* notch */}
        <div
          style={{
            position: "absolute",
            top: 12 * scale,
            left: "50%",
            transform: "translateX(-50%)",
            width: 110 * scale,
            height: 28 * scale,
            background: "#000",
            borderRadius: 999,
            zIndex: 10,
          }}
        />
        {children}
      </div>
    </div>
  );
};

/** Lower-third caption (editorial) */
export const LowerThird = ({ kicker, title }: { kicker: string; title: string }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 22], [20, 0], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        bottom: 80,
        opacity: o,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 16,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: COLORS.lime,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 56,
          fontWeight: 700,
          color: COLORS.text,
          lineHeight: 1.05,
          maxWidth: 900,
          letterSpacing: -1,
        }}
      >
        {title}
      </div>
    </div>
  );
};
