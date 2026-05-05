import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outDir = path.join(process.cwd(), "public", "images");

function seededDots(count, width, height, seed = 7) {
  let value = seed;
  const next = () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };

  return Array.from({ length: count }, (_, index) => {
    const x = Math.round(next() * width);
    const y = Math.round(next() * height);
    const r = Math.round(2 + next() * 14);
    const opacity = (0.12 + next() * 0.28).toFixed(2);
    const color = index % 3 === 0 ? "#6f3f2e" : index % 3 === 1 ? "#c5864a" : "#f1d79e";

    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" />`;
  }).join("");
}

function shellTexture(width, height, seed) {
  return seededDots(140, width, height, seed);
}

const hero = `
<svg width="1600" height="2000" viewBox="0 0 1600 2000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="cream" cx="48%" cy="45%" r="58%">
      <stop offset="0%" stop-color="#fff3be"/>
      <stop offset="45%" stop-color="#f0c16b"/>
      <stop offset="78%" stop-color="#a95f32"/>
      <stop offset="100%" stop-color="#4b2720"/>
    </radialGradient>
    <radialGradient id="center" cx="42%" cy="38%" r="62%">
      <stop offset="0%" stop-color="#fff7c8"/>
      <stop offset="70%" stop-color="#e2a45a"/>
      <stop offset="100%" stop-color="#7a3a2a"/>
    </radialGradient>
    <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#fff8eb"/>
      <stop offset="100%" stop-color="#e7d7c5"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="2000" fill="#f5eee4"/>
  <path d="M-240 1460 C200 1260 390 1510 740 1320 C1120 1115 1320 1200 1810 900 L1810 2050 L-240 2050 Z" fill="#d9dfd4"/>
  <path d="M1100 135 C1310 285 1530 610 1480 935 C1422 1308 1072 1536 700 1488 C380 1447 124 1213 86 897 C42 531 298 246 606 129 C760 70 943 64 1100 135 Z" fill="url(#cream)"/>
  <path d="M1044 254 C1225 386 1354 620 1311 869 C1266 1135 1011 1291 728 1246 C477 1206 272 1036 242 800 C210 544 392 332 628 250 C765 203 916 207 1044 254 Z" fill="url(#center)" opacity="0.94"/>
  ${shellTexture(1500, 1350, 3)}
  <ellipse cx="770" cy="795" rx="530" ry="430" fill="none" stroke="#5d2f28" stroke-width="42" opacity="0.34"/>
  <path d="M236 845 C306 1110 510 1268 803 1286 C1048 1301 1247 1190 1344 1006 C1280 1295 1020 1510 684 1480 C386 1454 126 1248 91 913 C71 720 124 550 225 420 C181 560 187 712 236 845 Z" fill="#3d211d" opacity="0.18"/>
  <rect x="118" y="1285" width="560" height="190" rx="22" fill="#53342f"/>
  <text x="184" y="1398" fill="#f6efe4" font-family="Georgia, serif" font-size="104" font-style="italic">natta</text>
  <text x="184" y="1448" fill="#f6efe4" font-family="Arial, sans-serif" font-size="34" opacity="0.8">tartas vascas de queso</text>
</svg>`;

const latta = `
<svg width="1100" height="1400" viewBox="0 0 1100 1400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="tinCream" cx="45%" cy="35%" r="58%">
      <stop offset="0%" stop-color="#fff7cc"/>
      <stop offset="72%" stop-color="#efd383"/>
      <stop offset="100%" stop-color="#9a5032"/>
    </radialGradient>
  </defs>
  <rect width="1100" height="1400" fill="#f8f2e8"/>
  <circle cx="550" cy="620" r="420" fill="#d7d9cd"/>
  <circle cx="550" cy="620" r="380" fill="#8a8376"/>
  <circle cx="550" cy="620" r="330" fill="url(#tinCream)"/>
  ${shellTexture(1000, 950, 11)}
  <path d="M280 675 C390 590 485 760 610 655 C720 562 795 630 872 585" fill="none" stroke="#fff2c2" stroke-width="48" stroke-linecap="round" opacity="0.48"/>
  <rect x="302" y="1035" width="496" height="120" rx="60" fill="#513530"/>
  <text x="394" y="1117" fill="#fbf8f2" font-family="Georgia, serif" font-size="68">latta</text>
</svg>`;

const slice = `
<svg width="1100" height="1400" viewBox="0 0 1100 1400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sliceTop" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#6b3429"/>
      <stop offset="50%" stop-color="#b46d3c"/>
      <stop offset="100%" stop-color="#fff0a9"/>
    </linearGradient>
    <linearGradient id="sliceSide" x1="0" x2="1">
      <stop offset="0%" stop-color="#fff1b6"/>
      <stop offset="100%" stop-color="#d99055"/>
    </linearGradient>
  </defs>
  <rect width="1100" height="1400" fill="#e8ece3"/>
  <ellipse cx="560" cy="690" rx="430" ry="430" fill="#171514"/>
  <path d="M284 398 L870 610 L362 1002 Z" fill="url(#sliceTop)"/>
  <path d="M362 1002 L870 610 L770 804 C680 972 545 1057 362 1002 Z" fill="url(#sliceSide)"/>
  ${shellTexture(980, 980, 21)}
  <path d="M414 880 C515 820 610 905 731 780" fill="none" stroke="#fff7c9" stroke-width="34" stroke-linecap="round" opacity="0.5"/>
  <text x="282" y="1175" fill="#513530" font-family="Georgia, serif" font-size="72">cremosa</text>
</svg>`;

const box = `
<svg width="1100" height="1400" viewBox="0 0 1100 1400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="boxTop" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#ded7ce"/>
    </linearGradient>
    <linearGradient id="ribbon" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#67443e"/>
      <stop offset="100%" stop-color="#2f1d1a"/>
    </linearGradient>
  </defs>
  <rect width="1100" height="1400" fill="#f4eee5"/>
  <path d="M220 380 L810 270 L950 940 L348 1052 Z" fill="url(#boxTop)"/>
  <path d="M530 330 L690 300 L830 970 L668 1000 Z" fill="url(#ribbon)"/>
  <text x="578" y="562" fill="#f6efe4" font-family="Georgia, serif" font-size="118" font-style="italic" transform="rotate(-10 578 562)">natta</text>
  <text x="594" y="634" fill="#f6efe4" font-family="Arial, sans-serif" font-size="30" opacity="0.75" transform="rotate(-10 594 634)">amantes de las tartas de queso</text>
  <circle cx="275" cy="932" r="175" fill="#a8683d"/>
  <circle cx="275" cy="932" r="132" fill="#e0ae62"/>
  ${shellTexture(470, 360, 31)}
  <text x="248" y="1190" fill="#513530" font-family="Georgia, serif" font-size="68">Devoto</text>
</svg>`;

await mkdir(outDir, { recursive: true });

await Promise.all([
  sharp(Buffer.from(hero)).png().toFile(path.join(outDir, "natta-hero.png")),
  sharp(Buffer.from(latta)).png().toFile(path.join(outDir, "natta-latta.png")),
  sharp(Buffer.from(slice)).png().toFile(path.join(outDir, "natta-slice.png")),
  sharp(Buffer.from(box)).png().toFile(path.join(outDir, "natta-box.png")),
]);

console.log("Generated placeholder product assets in public/images");
