/**
 * OPTIONNEL — capture vidéo image par image de la cinématique (rendu parfait, sans saccade).
 *
 * Prérequis (une seule fois) :
 *   npm install --no-save playwright
 *   npx playwright install chromium
 *   + ffmpeg dans le PATH (https://ffmpeg.org) pour assembler la vidéo.
 *
 * Utilisation (le serveur Next doit tourner : npm run dev ou npm run start) :
 *   node scripts/capture-video.mjs                       -> captures/baobab-intro.mp4 (1920x1080, 60 i/s)
 *   node scripts/capture-video.mjs --fps 30 --width 1280 --height 720 --url http://localhost:3000/intro --hold 1000
 *
 * Principe : la page de démo expose window.__baobabSeek(ms) qui fige TOUTES les animations
 * à un instant donné. On photographie chaque image à t = i / fps, puis ffmpeg assemble.
 */
import { mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);

const url = args.url ?? "http://localhost:3000/intro";
const fps = Number(args.fps ?? 60);
const width = Number(args.width ?? 1920);
const height = Number(args.height ?? 1080);
const holdMs = Number(args.hold ?? 1000); // image finale tenue après 7 s
const outputDir = path.resolve("captures");
const framesDir = path.join(outputDir, "frames");

const { chromium } = await import("playwright").catch(() => {
  console.error("Playwright est absent. Lancez : npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
});

await rm(framesDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => document.querySelector("[data-baobab-intro]")?.dataset.state !== "idle");

const totalMs = Number(await page.evaluate(() => document.querySelector("[data-baobab-intro]").dataset.totalMs));
const frameCount = Math.round(((totalMs + holdMs) / 1000) * fps);

for (let frame = 0; frame <= frameCount; frame += 1) {
  const time = Math.min((frame / fps) * 1000, totalMs + holdMs);
  await page.evaluate((ms) => window.__baobabSeek(ms), time);
  await page.screenshot({ path: path.join(framesDir, `frame-${String(frame).padStart(5, "0")}.png`) });
  if (frame % fps === 0) process.stdout.write(`\r${frame}/${frameCount} images`);
}
await browser.close();
console.log(`\nImages écrites dans ${framesDir}`);

const video = path.join(outputDir, `baobab-intro-${width}x${height}.mp4`);
const ffmpeg = spawnSync(
  "ffmpeg",
  ["-y", "-framerate", String(fps), "-i", path.join(framesDir, "frame-%05d.png"),
   "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", video],
  { stdio: "inherit" },
);
if (ffmpeg.status === 0) console.log(`Vidéo : ${video}`);
else console.log("ffmpeg introuvable ou en erreur : les images PNG restent utilisables dans n'importe quel monteur.");
