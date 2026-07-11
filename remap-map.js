/**
 * Pixel-level color remapper: Map.jpg → Map-futuristic.png
 * Remaps every pixel to the website palette: #000000 + #D7FF00 + #FFFFFF
 */
const sharp = require('sharp');
const path = require('path');

const INPUT  = path.join(__dirname, 'public/Map.jpg');
const OUTPUT = path.join(__dirname, 'public/Map-futuristic.png');

// ── Website palette (0-255) ──
const ACCENT   = [0xD7, 0xFF, 0x00];  // #D7FF00  — parks, highway, borders
const BLK_FILL = [0x0d, 0x11, 0x18];  // #0d1118  — block interior fills
const ROAD     = [0x07, 0x09, 0x0f];  // #07090F  — road surfaces
const SPECIAL  = [0x12, 0x18, 0x26];  // #121826  — special buildings (University, Hotel)
const BLACK    = [0x00, 0x00, 0x00];  // #000000  — true black (unused / fallback)
const WHITE    = [0xFF, 0xFF, 0xFF];  // #FFFFFF  — outlines, text, highway

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0, s = 0, v = max;
  if (delta > 0.001) {
    s = delta / max;
    if      (max === r) h = ((g - b) / delta + 6) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else                h = (r - g) / delta + 4;
    h *= 60; // 0-360
  }
  return [h, s, v];
}

function remap(r, g, b) {
  const [h, s, v] = rgbToHsv(r, g, b);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // perceptual

  // ── Chromatic pixels ──

  // Green parks & roundabout circles → D7FF00
  if (h >= 78 && h <= 168 && s > 0.18 && lum > 0.18 && lum < 0.82) {
    return ACCENT;
  }

  // Red/orange highway markings → WHITE (distinct from parks)
  if ((h < 22 || h > 332) && s > 0.32 && lum > 0.18) {
    return WHITE;
  }

  // ── Achromatic pixels (s < 0.12) ──

  // Dark outlines / text / plot borders → WHITE
  if (lum < 0.10) {
    return WHITE;
  }

  // Dark-medium gray: special building fills (University, Hotel, service area)
  if (lum < 0.48) {
    return SPECIAL;
  }

  // Road surface (medium-light gray)
  if (lum < 0.72) {
    return ROAD;
  }

  // Block interior fills (near-white / light gray)
  return BLK_FILL;
}

async function processImage() {
  console.log('Reading image...');
  const { data, info } = await sharp(INPUT)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  console.log(`Processing ${width}×${height} image (${channels} channels)...`);

  const out = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const [nr, ng, nb] = remap(r, g, b);
    out[i]     = nr;
    out[i + 1] = ng;
    out[i + 2] = nb;
    if (channels === 4) out[i + 3] = 255; // keep alpha opaque
  }

  console.log('Saving result...');
  await sharp(out, { raw: { width, height, channels } })
    .sharpen({ sigma: 0.8 })
    .png()
    .toFile(OUTPUT);

  console.log(`Done! → ${OUTPUT}`);
}

processImage().catch(console.error);
