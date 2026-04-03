/**
 * Generates PWA icons for all required sizes from an inline SVG.
 * The SVG uses Gamesync's brand colours (indigo + teal accent).
 */
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '../public/icons');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

/**
 * Inline SVG – a dark indigo square with a rounded gamepad controller icon
 * and "GS" wordmark in the bottom-right corner.
 */
function buildSvg(size) {
  const pad = Math.round(size * 0.1);
  const iconSize = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.12;          // button radius
  const bodyW = iconSize * 0.7;
  const bodyH = iconSize * 0.42;
  const bx = cx - bodyW / 2;
  const by = cy - bodyH / 2;

  // D-pad cross
  const dw = bodyW * 0.18;
  const dh = bodyH * 0.55;
  const dcx = cx - bodyW * 0.26;
  const dcy = cy + bodyH * 0.05;

  // ABXY buttons
  const bRadius = r * 0.55;
  const bOffX = cx + bodyW * 0.26;
  const bOffY = cy + bodyH * 0.05;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a237e"/>
      <stop offset="100%" stop-color="#283593"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${size * 0.18}" ry="${size * 0.18}" fill="url(#bg)"/>

  <!-- Controller body -->
  <rect x="${bx}" y="${by}" width="${bodyW}" height="${bodyH}"
        rx="${bodyH * 0.35}" ry="${bodyH * 0.35}"
        fill="#3949ab" stroke="#5c6bc0" stroke-width="${size * 0.012}"/>

  <!-- Grips (lower protrusions) -->
  <ellipse cx="${cx - bodyW * 0.28}" cy="${by + bodyH + bodyH * 0.06}"
           rx="${bodyW * 0.18}" ry="${bodyH * 0.22}" fill="#3949ab"/>
  <ellipse cx="${cx + bodyW * 0.28}" cy="${by + bodyH + bodyH * 0.06}"
           rx="${bodyW * 0.18}" ry="${bodyH * 0.22}" fill="#3949ab"/>

  <!-- D-pad -->
  <rect x="${dcx - dw / 2}" y="${dcy - dh / 2}" width="${dw}" height="${dh}"
        rx="${dw * 0.2}" fill="#1a237e"/>
  <rect x="${dcx - dh / 2}" y="${dcy - dw / 2}" width="${dh}" height="${dw}"
        rx="${dw * 0.2}" fill="#1a237e"/>

  <!-- ABXY buttons -->
  <circle cx="${bOffX}"                   cy="${bOffY - bRadius * 2}" r="${bRadius}" fill="#e53935"/>
  <circle cx="${bOffX + bRadius * 2}"     cy="${bOffY}"               r="${bRadius}" fill="#43a047"/>
  <circle cx="${bOffX}"                   cy="${bOffY + bRadius * 2}" r="${bRadius}" fill="#fdd835"/>
  <circle cx="${bOffX - bRadius * 2}"     cy="${bOffY}"               r="${bRadius}" fill="#1e88e5"/>

  <!-- Start/Select buttons -->
  <rect x="${cx - bodyW * 0.08}" y="${by + bodyH * 0.35}"
        width="${bodyW * 0.06}" height="${bodyH * 0.18}"
        rx="${size * 0.02}" fill="#5c6bc0"/>
  <rect x="${cx + bodyW * 0.03}" y="${by + bodyH * 0.35}"
        width="${bodyW * 0.06}" height="${bodyH * 0.18}"
        rx="${size * 0.02}" fill="#5c6bc0"/>

  <!-- "GS" wordmark -->
  <text x="${size * 0.93}" y="${size * 0.97}"
        text-anchor="end" dominant-baseline="auto"
        font-family="Arial Black, sans-serif"
        font-weight="900"
        font-size="${size * 0.15}px"
        fill="#00e5ff"
        opacity="0.9">GS</text>
</svg>`;
}

for (const size of SIZES) {
  const svg = buildSvg(size);
  const outPath = `${iconsDir}/icon-${size}x${size}.png`;
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log(`Generated ${outPath}`);
}

console.log('All icons generated.');
