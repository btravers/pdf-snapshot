import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export type DiffPngSnapshotOptions = {
  failureThreshold?: number;
};
export type DiffPngSnapshotResult =
  | { pass: true; diffRatio: number }
  | { pass: false; diffRatio: number; newPage: string; diffImage: string };

const DEFAULT_PIXELMATCH_THRESHOLD = 0.01;
const DEFAULT_FAILURE_THRESHOLD = 0;

/**
 * Perform visual comparison between the PNG of the new page and the old version of this same page.
 *
 * @param receivedImage PNG content as Buffer representing a page of the PDF.
 * @param snapshotImage The corresponding snapshot of the page of the PDF.
 * @param options PNG comparison options.
 */
export async function diffPngSnapshot(
  receivedImage: Buffer,
  snapshotImage: Buffer,
  options?: DiffPngSnapshotOptions,
): Promise<DiffPngSnapshotResult> {
  const [receivedPng, snapshotPng] = await Promise.all([
    toRawPng(receivedImage),
    toRawPng(snapshotImage),
  ]);

  const sizeMissMatch =
    receivedPng.height !== snapshotPng.height ||
    receivedPng.width !== snapshotPng.width;

  if (sizeMissMatch) {
    // todo create specific error and handle it
    throw new Error('Received pdf and snapshot pdf have different sizes');
  }

  const imageWidth = receivedPng.width;
  const imageHeight = receivedPng.height;

  const diffPng = new PNG({ width: imageWidth, height: imageHeight });

  const diffPixelCount = pixelmatch(
    receivedPng.data,
    snapshotPng.data,
    diffPng.data,
    imageWidth,
    imageHeight,
    {
      threshold: DEFAULT_PIXELMATCH_THRESHOLD,
    },
  );
  const totalPixels = imageWidth * imageHeight;
  const diffRatio = diffPixelCount / totalPixels;

  const pass =
    diffRatio <= (options?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD);

  if (pass) {
    return {
      pass,
      diffRatio,
    };
  }

  const compositePng = await createCompositePng(
    receivedPng,
    snapshotPng,
    diffPng,
  );
  const diffImage = await toBuffer(compositePng);

  return {
    pass,
    diffRatio,
    newPage: receivedImage.toString('base64'),
    diffImage: diffImage.toString('base64'),
  };
}

/**
 * Create a new PNG putting side by side the old version of the page, differences between the two pages
 * and the new version of the page.
 *
 * @param receivedPng PNG of the new page.
 * @param snapshotPng PNG of the old page.
 * @param diffPng PNG showing differences between the two PNGs.
 */
async function createCompositePng(
  receivedPng: PNG,
  snapshotPng: PNG,
  diffPng: PNG,
): Promise<PNG> {
  const compositePng = new PNG({
    width: receivedPng.width * 3,
    height: receivedPng.height,
  });

  [snapshotPng, diffPng, receivedPng].forEach((png, index) => {
    png.bitblt(
      compositePng,
      0,
      0,
      receivedPng.width,
      receivedPng.height,
      receivedPng.width * index,
      0,
    );
  });

  return compositePng;
}

/**
 * Transform PNG content as Buffer to ONG object.
 *
 * @param image PNG content as Buffer.
 */
async function toRawPng(image: Buffer): Promise<PNG> {
  return new Promise<PNG>((resolve, reject) =>
    new PNG().parse(image, (err, rawImage) => {
      if (err) return reject(err);
      resolve(rawImage);
    }),
  );
}

/**
 * Transform PNG image to PNG content as Buffer.
 *
 * @param image PNG object.
 */
async function toBuffer(image: PNG): Promise<Buffer> {
  const imageStream = image.pack();
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    imageStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    imageStream.on('error', (err) => reject(err));
    imageStream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
