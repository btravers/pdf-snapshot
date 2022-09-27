import { pdfToPng, PdfToPngOptions } from './pdfToPng';
import {
  diffPngSnapshot,
  DiffPngSnapshotOptions,
  DiffPngSnapshotResult,
} from './diffPngSnapshot';

type Options = PdfToPngOptions & DiffPngSnapshotOptions;
type PageResult =
  | DiffPngSnapshotResult
  | { deleted: true }
  | { added: true; newPage: string };
type Result = {
  results: PageResult[];
};

export async function matchPdfSnapshot(
  pdf: Buffer,
  snapshots: Buffer[] = [],
  options?: Options,
): Promise<Result> {
  const pages = await pdfToPng(pdf, options);

  const results = await Promise.all<PageResult>(
    Array.from(
      { length: Math.max(pages.length, snapshots.length ?? 0) },
      (_, index) => index,
    ).map((index) => {
      if (index >= pages.length) {
        return {
          deleted: true,
        };
      }

      const page = pages[index];

      if (index >= snapshots.length) {
        return {
          added: true,
          newPage: page.toString('base64'),
        };
      }

      const snapshot = snapshots[index];

      return diffPngSnapshot(page, snapshot, options);
    }),
  );

  return {
    results,
  };
}
