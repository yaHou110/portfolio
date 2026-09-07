/**
 * Generates the PWA icon set (PNG) from the source SVG in src/app/icon.svg.
 *
 * Outputs to public/icons/:
 *   - icon-192.png      (standard install icon)
 *   - icon-512.png      (standard install icon, also used as fallback)
 *   - icon-maskable.png (maskable — safe zone is the inner 80% of the SVG)
 *   - apple-touch-icon.png (180px, iOS home screen)
 *
 * Run with: pnpm icons
 */
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcSvg = join(root, "src", "app", "icon.svg");
const outDir = join(root, "public", "icons");

const svg = await readFile(srcSvg, "utf8");

// Maskable icons must have the artwork inside the inner 80% "safe zone";
// we drop the rounded background rect, bleed the brand color to the full
// canvas, and scale the artwork to 80% so the outer ring acts as the
// browser-shaped crop area.
const inner = svg
  .replace(/<svg xmlns="[^"]*" viewBox="0 0 64 64">/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace(/<rect width="64" height="64" rx="14" fill="#047857"\/>/, "");

const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#047857"/>
  <g transform="translate(6.4 6.4) scale(0.8)">${inner}</g>
</svg>`;

await mkdir(outDir, { recursive: true });

const jobs = [
  { name: "icon-192.png", size: 192, data: svg },
  { name: "icon-512.png", size: 512, data: svg },
  { name: "icon-maskable.png", size: 512, data: maskableSvg },
  { name: "apple-touch-icon.png", size: 180, data: svg },
];

for (const { name, size, data } of jobs) {
  await sharp(Buffer.from(data)).resize(size, size).png().toFile(join(outDir, name));
  console.log(`✓ ${name} (${size}×${size})`);
}
