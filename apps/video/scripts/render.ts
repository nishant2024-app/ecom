/**
 * Render compositions with the Chromium already installed on the machine (no Remotion Lambda,
 * no AWS). Usage:
 *   pnpm --filter @dairy/video render                      # PantryReel → storefront public/video
 *   pnpm --filter @dairy/video render ProductReel out.mp4 '{"name":"...",...}'
 * Remotion is free for companies of up to 3 people; see docs/09-video.md for licensing.
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [id = 'PantryReel', outArg, propsArg] = process.argv.slice(2);
const out = outArg ?? path.resolve(here, '../../web/public/video/pantry-reel.mp4');
const inputProps = propsArg ? JSON.parse(propsArg) : {};
const browserExecutable =
  process.env.CHROME_PATH ?? ['/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'].find((p) => existsSync(p)) ?? null;

mkdirSync(path.dirname(out), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve(here, '../src/index.ts') });
const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable });
console.log(`rendering ${id} ${composition.width}×${composition.height}, ${composition.durationInFrames} frames`);
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  crf: 26,
  outputLocation: out,
  inputProps,
  browserExecutable,
  chromiumOptions: { gl: 'swangle' },
  onProgress: ({ progress }) => process.stdout.write(`\r${Math.round(progress * 100)}%`),
});
await renderStill({ composition, serveUrl, output: out.replace(/\.mp4$/, '.jpg'), frame: 120, inputProps, browserExecutable, imageFormat: 'jpeg', jpegQuality: 85 });
console.log(`\nwrote ${out}`);
