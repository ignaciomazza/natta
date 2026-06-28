import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public/images/logo/IMG_2036.PNG");
const publicIconsDir = path.join(root, "public/icons");
const faviconPath = path.join(root, "src/app/favicon.ico");

const colors = {
  background: "#403a37",
  foreground: "#f5f3f1",
};

const iconSizes = [16, 32, 48, 180, 192, 512];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function findInkBounds(data, info) {
  const columnCounts = new Array(info.width).fill(0);

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const alpha = data[index + 3];

      if (alpha > 10 && (r < 245 || g < 245 || b < 245)) {
        columnCounts[x] += 1;
      }
    }
  }

  const threshold = Math.max(2, info.height * 0.002);
  const allowedGap = Math.max(12, Math.round(info.width * 0.012));
  const spans = [];
  let start = null;
  let last = null;
  let gap = 0;

  for (let x = 0; x < info.width; x += 1) {
    if (columnCounts[x] > threshold) {
      start ??= x;
      last = x;
      gap = 0;
    } else if (start !== null) {
      gap += 1;
      if (gap > allowedGap) {
        spans.push([start, last]);
        start = null;
        last = null;
        gap = 0;
      }
    }
  }

  if (start !== null) {
    spans.push([start, last]);
  }

  const [firstStart, firstEnd] = spans[0];
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = firstStart; x <= firstEnd; x += 1) {
      const index = (y * info.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const alpha = data[index + 3];

      if (alpha > 10 && (r < 245 || g < 245 || b < 245)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function createGlyph() {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bounds = findInkBounds(data, info);
  const padding = Math.round(Math.max(bounds.width, bounds.height) * 0.06);

  const crop = {
    left: clamp(bounds.left - padding, 0, info.width - 1),
    top: clamp(bounds.top - padding, 0, info.height - 1),
    width: clamp(bounds.width + padding * 2, 1, info.width - bounds.left),
    height: clamp(bounds.height + padding * 2, 1, info.height - bounds.top),
  };

  const { data: cropData, info: cropInfo } = await sharp(source)
    .extract(crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [r, g, b] = colors.foreground
    .match(/\w\w/g)
    .map((value) => Number.parseInt(value, 16));

  for (let index = 0; index < cropData.length; index += 4) {
    const luminance =
      cropData[index] * 0.2126 +
      cropData[index + 1] * 0.7152 +
      cropData[index + 2] * 0.0722;
    const alpha =
      luminance < 248 ? 255 : clamp(Math.round((255 - luminance) * 16), 0, 255);

    cropData[index] = r;
    cropData[index + 1] = g;
    cropData[index + 2] = b;
    cropData[index + 3] = alpha < 8 ? 0 : alpha;
  }

  return sharp(cropData, {
    raw: {
      width: cropInfo.width,
      height: cropInfo.height,
      channels: 4,
    },
  }).png().toBuffer();
}

async function renderIcon(glyphBuffer, size, { maskable = false } = {}) {
  const glyphSize = Math.round(size * (maskable ? 0.56 : 0.68));
  const glyph = await sharp(glyphBuffer)
    .resize({
      height: glyphSize,
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
  const metadata = await sharp(glyph).metadata();
  const left = Math.round((size - metadata.width) / 2);
  const top = Math.round((size - metadata.height) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: colors.background,
    },
  })
    .composite([{ input: glyph, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

function createIco(images) {
  const headerSize = 6;
  const directorySize = images.length * 16;
  let offset = headerSize + directorySize;
  const header = Buffer.alloc(offset);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  for (const [index, image] of images.entries()) {
    const entryOffset = 6 + index * 16;
    header.writeUInt8(image.size >= 256 ? 0 : image.size, entryOffset);
    header.writeUInt8(image.size >= 256 ? 0 : image.size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(image.buffer.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += image.buffer.length;
  }

  return Buffer.concat([header, ...images.map((image) => image.buffer)]);
}

async function main() {
  await fs.mkdir(publicIconsDir, { recursive: true });

  const glyph = await createGlyph();
  const icons = new Map();

  for (const size of iconSizes) {
    icons.set(size, await renderIcon(glyph, size));
  }

  const maskableIcon = await renderIcon(glyph, 512, { maskable: true });

  await Promise.all([
    fs.writeFile(path.join(publicIconsDir, "favicon-16x16.png"), icons.get(16)),
    fs.writeFile(path.join(publicIconsDir, "favicon-32x32.png"), icons.get(32)),
    fs.writeFile(path.join(publicIconsDir, "icon-192.png"), icons.get(192)),
    fs.writeFile(path.join(publicIconsDir, "icon-512.png"), icons.get(512)),
    fs.writeFile(
      path.join(publicIconsDir, "apple-touch-icon.png"),
      icons.get(180),
    ),
    fs.writeFile(path.join(publicIconsDir, "maskable-icon-512.png"), maskableIcon),
    fs.writeFile(
      faviconPath,
      createIco([16, 32, 48].map((size) => ({ size, buffer: icons.get(size) }))),
    ),
  ]);

  console.log(`Generated ${iconSizes.length + 1} brand icon assets`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
