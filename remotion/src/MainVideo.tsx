import { AbsoluteFill, Sequence, Audio, staticFile } from "remotion";
import { SceneHook } from "./scenes/SceneHook";
import { SceneSearch } from "./scenes/SceneSearch";
import { SceneProfile } from "./scenes/SceneProfile";
import { SceneVoice } from "./scenes/SceneVoice";
import { SceneVideoCall } from "./scenes/SceneVideoCall";
import { SceneInvoice } from "./scenes/SceneInvoice";
import { SceneRollCall } from "./scenes/SceneRollCall";
import { SceneCopilot } from "./scenes/SceneCopilot";
import { SceneClose } from "./scenes/SceneClose";
import { COLORS } from "./theme";

// 30fps. Re-timed to match a ~75s voiceover (founder narration).
// Beat map:
//  Hook        0.0s  — "8 tools to run one job… Thrive·IN replaces all of that."
//  Search      9.5s  — "Search your name…"
//  Profile    15.5s  — "creative passport — one link…"
//  Voice      22.5s  — "Drop any brief, or just a voice note…"
//  VideoCall  32.0s  — "Instead of switching between Notion, WhatsApp & Drive…"
//  Invoice    37.5s  — "generate an invoice and track payments…"
//  RollCall   46.5s  — "becomes a verified credit on your profile…"
//  Copilot    55.5s  — "Our Thrive·IN Copilot runs the workflow…"
//  Close      63.0s  — "Find the work. Do the work. Get paid. Prove it. One creative OS."
const SCENES = [
  { c: <SceneHook />, d: 285 },        //  9.5s
  { c: <SceneSearch />, d: 180 },      //  6.0s
  { c: <SceneProfile />, d: 210 },     //  7.0s
  { c: <SceneVoice />, d: 285 },       //  9.5s
  { c: <SceneVideoCall />, d: 165 },   //  5.5s
  { c: <SceneInvoice />, d: 270 },     //  9.0s
  { c: <SceneRollCall />, d: 270 },    //  9.0s
  { c: <SceneCopilot />, d: 225 },     //  7.5s
  { c: <SceneClose />, d: 360 },       // 12.0s
];

export const SCENE_PLAN = SCENES;
export const TOTAL_FRAMES = SCENES.reduce((s, x) => s + x.d, 0); // 2250 frames = 75s @30fps

export const MainVideo = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {SCENES.map((s, i) => {
        const start = from;
        from += s.d;
        return (
          <Sequence key={i} from={start} durationInFrames={s.d}>
            {s.c}
          </Sequence>
        );
      })}
      <Audio src={staticFile("audio/vo.mp3")} />
    </AbsoluteFill>
  );
};
