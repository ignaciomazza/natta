import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { promisify } from "node:util";

const root = process.cwd();
const execFileAsync = promisify(execFile);

const instagramDir = path.join(root, "public/images/Instagram_files");
const instagramOutputDir = path.join(root, "public/images/optimized/instagram");
const heroOutputDir = path.join(root, "public/images/optimized/hero-pieces");
const menuDir = path.join(root, "public/images/menu");
const menuOutputDir = path.join(root, "public/images/menu/optimized");

const menuSources = [
  {
    slug: "argenta",
    cropFocusY: 0.43,
    enhance: { brightness: 1.02, contrast: 1.08, saturation: 1.08 },
    file: "argenta.heic",
  },
  {
    slug: "blanca",
    enhance: { brightness: 0.99, contrast: 1.1, saturation: 1.1 },
    file: "blanca.heic",
    position: "center",
  },
  {
    slug: "brulee",
    enhance: { brightness: 1.01, contrast: 1.07, saturation: 1.06 },
    file: "brulee.HEIC",
    position: "center",
  },
  { slug: "choco", file: "choco.jpg", position: "center" },
  {
    slug: "duo",
    enhance: { brightness: 1.01, contrast: 1.06, saturation: 1.05 },
    file: "duo.png",
    position: "center",
  },
  {
    slug: "limu",
    enhance: { brightness: 1.01, contrast: 1.05, saturation: 1.04 },
    file: "limu.heic",
    position: "center",
  },
  {
    slug: "mocha",
    enhance: { brightness: 0.99, contrast: 1.09, saturation: 1.08 },
    file: "mocha.HEIC",
    position: "attention",
  },
  { slug: "natta", file: "natta.jpg", position: "attention" },
  {
    slug: "tachio",
    enhance: { brightness: 1, contrast: 1.08, saturation: 1.03 },
    file: "tachio.heic",
    position: "center",
  },
  {
    slug: "tella",
    enhance: { brightness: 1.01, contrast: 1.07, saturation: 1.08 },
    file: "tella.HEIC",
    position: "center",
  },
];

const transparentPieces = ["1", "2", "3", "4", "5", "6", "7", "8"].map(
  (name) => ({
    input: path.join(root, `public/images/transparent-images/${name}.png`),
    output: path.join(heroOutputDir, `${name}.webp`),
    resize: { height: 1400 },
    format: "webp",
  }),
);

const illustrationPieces = ["IMG_5332", "IMG_5333"].map((name) => ({
  input: path.join(root, `public/images/ilustration/${name}.PNG`),
  output: path.join(heroOutputDir, `${name}.webp`),
  resize: null,
  format: "webp",
}));

async function getInstagramJobs() {
  const files = await fs.readdir(instagramDir);

  return files
    .filter((file) => /\.(jpe?g|png)$/i.test(file))
    .map((file) => ({
      input: path.join(instagramDir, file),
      output: path.join(
        instagramOutputDir,
        `${path.basename(file, path.extname(file))}.jpg`,
      ),
      preserveSmallerOriginal: true,
      resize: { height: 1600 },
      format: "jpeg",
    }));
}

async function getMenuJobs() {
  return menuSources.map(
    ({ cropFocusX, cropFocusY, enhance, slug, file, position }) => ({
      cropFocusX,
      cropFocusY,
      enhance,
      input: path.join(menuDir, file),
      output: path.join(menuOutputDir, `${slug}.jpg`),
      resize: {
        width: 900,
        height: 1000,
        fit: "cover",
        position,
        withoutEnlargement: false,
      },
      format: "jpeg",
      isMenuImage: true,
    }),
  );
}

async function createQuickLookThumbnail(input) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "natta-assets-"));
  await execFileAsync("qlmanage", ["-t", "-s", "1800", "-o", tempDir, input]);
  return {
    cleanup: () => fs.rm(tempDir, { force: true, recursive: true }),
    input: path.join(tempDir, `${path.basename(input)}.png`),
  };
}

async function createPipeline(input) {
  try {
    await sharp(input).rotate().resize({ width: 1, height: 1 }).toBuffer();
    return {
      cleanup: async () => {},
      input,
      pipeline: sharp(input).rotate(),
    };
  } catch (error) {
    if (!/\.hei[cf]$/i.test(input)) {
      throw error;
    }

    const thumbnail = await createQuickLookThumbnail(input);
    return {
      cleanup: thumbnail.cleanup,
      input: thumbnail.input,
      pipeline: sharp(thumbnail.input),
    };
  }
}

function getCropOffset(extraSpace, focus) {
  return Math.min(
    extraSpace,
    Math.max(0, Math.round(extraSpace * (focus ?? 0.5))),
  );
}

async function applyManualCoverCrop(pipeline, input, resize, focusX, focusY) {
  const metadata = await sharp(input).metadata();
  const targetRatio = resize.width / resize.height;
  const sourceRatio = metadata.width / metadata.height;

  if (sourceRatio < targetRatio) {
    const scaledHeight = Math.round(
      (metadata.height * resize.width) / metadata.width,
    );
    const top = getCropOffset(scaledHeight - resize.height, focusY);

    return pipeline
      .resize({ width: resize.width, withoutEnlargement: false })
      .extract({
        height: resize.height,
        left: 0,
        top,
        width: resize.width,
      });
  }

  const scaledWidth = Math.round(
    (metadata.width * resize.height) / metadata.height,
  );
  const left = getCropOffset(scaledWidth - resize.width, focusX);

  return pipeline
    .resize({ height: resize.height, withoutEnlargement: false })
    .extract({
      height: resize.height,
      left,
      top: 0,
      width: resize.width,
    });
}

function applyEnhancement(pipeline, enhance) {
  const contrast = enhance?.contrast ?? 1;
  const contrastOffset = Math.round(128 * (1 - contrast));

  return pipeline
    .linear(contrast, contrastOffset)
    .modulate({
      brightness: enhance?.brightness ?? 1,
      saturation: enhance?.saturation ?? 1,
    })
    .sharpen({ sigma: enhance ? 0.55 : 0.45 });
}

async function optimizeImage(job) {
  await fs.mkdir(path.dirname(job.output), { recursive: true });

  const prepared = await createPipeline(job.input);
  let pipeline = prepared.pipeline;

  if (
    job.resize &&
    (job.cropFocusX !== undefined || job.cropFocusY !== undefined)
  ) {
    pipeline = await applyManualCoverCrop(
      pipeline,
      prepared.input ?? job.input,
      job.resize,
      job.cropFocusX,
      job.cropFocusY,
    );
  } else if (job.resize) {
    pipeline = pipeline.resize({
      fit: "inside",
      withoutEnlargement: true,
      ...job.resize,
    });
  }

  if (job.isMenuImage) {
    pipeline = applyEnhancement(pipeline, job.enhance);
  }

  if (job.format === "jpeg") {
    pipeline = pipeline.jpeg({
      mozjpeg: true,
      progressive: true,
      quality: 78,
    });
  } else if (job.format === "webp") {
    pipeline = pipeline.webp({
      effort: 6,
      quality: 82,
    });
  }

  const tempOutput = `${job.output}.tmp`;
  try {
    await pipeline.toFile(tempOutput);
  } finally {
    await prepared.cleanup();
  }

  const [inputStat, tempStat] = await Promise.all([
    fs.stat(job.input),
    fs.stat(tempOutput),
  ]);

  if (
    job.preserveSmallerOriginal &&
    job.format === "jpeg" &&
    tempStat.size >= inputStat.size
  ) {
    await fs.copyFile(job.input, job.output);
    await fs.rm(tempOutput);
  } else {
    await fs.rename(tempOutput, job.output);
  }

  const outputStat = await fs.stat(job.output);
  const metadata = await sharp(job.output).metadata();
  const saved = inputStat.size - outputStat.size;

  return {
    input: path.relative(root, job.input),
    output: path.relative(root, job.output),
    width: metadata.width,
    height: metadata.height,
    inputKb: inputStat.size / 1024,
    outputKb: outputStat.size / 1024,
    savedKb: saved / 1024,
  };
}

async function main() {
  const jobs = [
    ...(await getInstagramJobs()),
    ...(await getMenuJobs()),
    ...transparentPieces,
    ...illustrationPieces,
  ];

  const results = [];

  for (const job of jobs) {
    results.push(await optimizeImage(job));
  }

  const totalInput = results.reduce((sum, result) => sum + result.inputKb, 0);
  const totalOutput = results.reduce((sum, result) => sum + result.outputKb, 0);

  for (const result of results) {
    console.log(
      `${result.output} ${result.width}x${result.height} ` +
        `${result.inputKb.toFixed(1)} KB -> ${result.outputKb.toFixed(1)} KB`,
    );
  }

  console.log(
    `Optimized ${results.length} images: ${totalInput.toFixed(1)} KB -> ` +
      `${totalOutput.toFixed(1)} KB`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
