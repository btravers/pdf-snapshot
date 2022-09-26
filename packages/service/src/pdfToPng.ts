import * as path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';
import { createCanvas } from 'canvas';

export type PdfToPngOptions = {
  scale?: number;
};

const DEFAULT_SCALE = 1;

export async function pdfToPng(
  pdf: Buffer,
  options?: PdfToPngOptions,
): Promise<Buffer[]> {
  const pdfDocument = await pdfjs.getDocument({
    data: new Uint8Array(pdf),
    cMapUrl: path.join(__dirname, '../node_modules/pdfjs-dist/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: path.join(
      __dirname,
      '../node_modules/pdfjs-dist/standard_fonts/',
    ),
  }).promise;

  async function pdfPageToPng(pageNumber: number): Promise<Buffer> {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({
      scale: options?.scale ?? DEFAULT_SCALE,
    });

    const canvas = createCanvas(viewport.width, viewport.height);

    await page.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
    }).promise;

    return canvas.toBuffer('image/png');
  }

  return await Promise.all(
    Array.from({ length: pdfDocument.numPages }, (_, index) => index + 1).map(
      (pageNumber) => pdfPageToPng(pageNumber),
    ),
  );
}
