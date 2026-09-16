import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHUNK = parseInt(process.argv[2] ?? "0", 10); // 0,1,2 ...
const NUM_CHUNKS = parseInt(process.argv[3] ?? "3", 10);
const TMP = "/tmp/remotion-chunks";
fs.mkdirSync(TMP, { recursive: true });

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (config) => config,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({ serveUrl: bundled, id: "main", puppeteerInstance: browser });
const total = composition.durationInFrames;
const per = Math.ceil(total / NUM_CHUNKS);
const start = CHUNK * per;
const end = Math.min(total - 1, start + per - 1);

const out = path.join(TMP, `chunk-${CHUNK}.mp4`);
console.log(`Chunk ${CHUNK}/${NUM_CHUNKS}: frames ${start}-${end} of ${total} -> ${out}`);

await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation: out,
  puppeteerInstance: browser,
  muted: true,
  concurrency: 2,
  frameRange: [start, end],
  onProgress: ({ progress }) => {
    if (Math.floor(progress * 100) % 20 === 0) console.log(`  ${Math.floor(progress * 100)}%`);
  },
});

await browser.close({ silent: false });
console.log("Done chunk", CHUNK);
