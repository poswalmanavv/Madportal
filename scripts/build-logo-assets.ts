/**
 * Generates the site's logo assets from the two source PNGs in assets/.
 *
 *   pnpm logo:build
 *
 * The sources are mostly empty canvas -- the mark sits in the middle of a large transparent
 * area -- so every output is trimmed to the artwork's real bounding box first. Skip that and
 * the logo renders as a tiny speck inside a huge invisible box.
 *
 * Outputs:
 *   public/logo-black.png      the mark, trimmed. Used on light backgrounds.
 *   public/logo-white.png      the mark, trimmed. Used on dark backgrounds (and the sidebar).
 *   public/og-image.png        1200x630 social preview card.
 *   src/app/icon.png           512x512 browser tab icon (Next.js serves this as the favicon).
 *   src/app/apple-icon.png     180x180 iOS home-screen icon.
 *
 * The tab icon is the WHITE mark on a dark tile: at 16px a thin black outline on a
 * transparent background disappears against dark browser chrome, whereas a solid tile stays
 * legible in both light and dark themes.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const BLACK_SRC = process.argv[2] ?? "assets/mad-logo-black.png";
const WHITE_SRC = process.argv[3] ?? "assets/mad-logo-white.png";

const root = process.cwd();
const publicDir = path.join(root, "public");
const appDir = path.join(root, "src", "app");

// The tile behind the tab icon: the theme's "ink".
const TILE = { r: 17, g: 24, b: 39, alpha: 1 };

async function trimmed(src: string) {
  if (!fs.existsSync(src)) throw new Error(`Source image not found: ${src}`);
  return sharp(src).trim({ threshold: 10 }).toBuffer();
}

async function tile(mark: Buffer, size: number, scale: number, out: string) {
  const inner = await sharp(mark)
    .resize({ width: Math.round(size * scale), height: Math.round(size * scale), fit: "inside" })
    .toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background: TILE } })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile(out);
}

async function main() {
  fs.mkdirSync(publicDir, { recursive: true });

  const black = await trimmed(BLACK_SRC);
  const white = await trimmed(WHITE_SRC);

  const meta = await sharp(black).metadata();
  console.log(`trimmed artwork: ${meta.width}x${meta.height}`);

  // In-app logos. Height-capped; width follows the aspect ratio.
  await sharp(black).resize({ height: 512 }).png().toFile(path.join(publicDir, "logo-black.png"));
  await sharp(white).resize({ height: 512 }).png().toFile(path.join(publicDir, "logo-white.png"));

  await tile(white, 512, 0.66, path.join(appDir, "icon.png"));
  await tile(white, 180, 0.66, path.join(appDir, "apple-icon.png"));

  // Social preview card.
  const ogInner = await sharp(white).resize({ height: 400, fit: "inside" }).toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: TILE } })
    .composite([{ input: ogInner, gravity: "center" }])
    .png()
    .toFile(path.join(publicDir, "og-image.png"));

  console.log("\nWrote:");
  console.log("  public/logo-black.png");
  console.log("  public/logo-white.png");
  console.log("  public/og-image.png");
  console.log("  src/app/icon.png");
  console.log("  src/app/apple-icon.png");
}

main().catch((error) => {
  console.error("Logo build failed:", error);
  process.exit(1);
});
