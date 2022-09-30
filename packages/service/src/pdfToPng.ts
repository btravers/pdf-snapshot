import * as path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';
import { createCanvas } from 'canvas';

export type PdfToPngOptions = {
  scale?: number;
};

const DEFAULT_SCALE = 1;

/**
 * Transform a PDF content as Buffer to an array of PNG contents as array of Buffer,
 * each PNG representing a page of the initial PDF.
 *
 * @param pdf PDF content as Buffer.
 * @param options Options of the PNG transformation.
 */
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

  console.log('Pdf document interpreted');

  return await Promise.all(
    Array.from({ length: pdfDocument.numPages }, (_, index) => index + 1).map(
      async (pageNumber) =>
        pdfDocument
          .getPage(pageNumber)
          .then((page) => pdfPageToPng(page, options)),
    ),
  );
}

/**
 * Transform one PDF page to a PNG content as Buffer.
 *
 * @param page The PDF page.
 * @param options Options of the PNG transformation.
 */
async function pdfPageToPng(
  page: pdfjs.PDFPageProxy,
  options?: PdfToPngOptions,
): Promise<Buffer> {
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
