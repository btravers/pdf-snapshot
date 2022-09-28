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

  const compositePng = new PNG({
    width: imageWidth * 3,
    height: imageHeight,
  });

  [snapshotPng, diffPng, receivedPng].forEach((png, index) => {
    png.bitblt(
      compositePng,
      0,
      0,
      imageWidth,
      imageHeight,
      imageWidth * index,
      0,
    );
  });

  const diffImage = await toBuffer(compositePng);

  return {
    pass,
    diffRatio,
    newPage: receivedImage.toString('base64'),
    diffImage: diffImage.toString('base64'),
  };
}

async function toRawPng(image: Buffer): Promise<PNG> {
  return new Promise<PNG>((resolve, reject) =>
    new PNG().parse(image, (err, rawImage) => {
      if (err) return reject(err);
      resolve(rawImage);
    }),
  );
}

async function toBuffer(image: PNG): Promise<Buffer> {
  const imageStream = image.pack();
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    imageStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    imageStream.on('error', (err) => reject(err));
    imageStream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
