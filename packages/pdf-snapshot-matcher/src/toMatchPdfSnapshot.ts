import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import _ from 'lodash';
import dedent from 'dedent';
import type { MatcherContext, MatcherFunctionWithContext } from 'expect';

import type { AppRouter } from '@armandabric/pdf-snapshot-service/dist/router';

type Options = {
  scale?: number;
  failureThreshold?: number;
};

type Result = {
  pass: boolean;
  message: () => string;
};

/**
 * Expect matcher for visual regression testing of PDF document.
 * Behaves just like tradition Jest snapshots.
 *
 * @param pdf PDF content as Buffer.
 * @param options Comparison options.
 */
const toMatchPdfSnapshot: MatcherFunctionWithContext<
  MatcherContext & { snapshotState?: any },
  [Options | undefined]
> = async function (
  pdf?: Buffer | unknown,
  options?: Options,
): Promise<Result> {
  const { testPath, currentTestName, isNot, snapshotState } = this;

  if (isNot) {
    throw new Error(
      'Expect: `.not` cannot be used with `.toMatchPdfSnapshot()`.',
    );
  }

  if (!Buffer.isBuffer(pdf)) {
    throw new Error(
      '`.toMatchPdfSnapshot()` expect a PDF buffer as first arguments',
    );
  }

  const snapshotsDirectory = path.join(
    path.dirname(testPath ?? ''),
    '__pdf_snapshots__',
  );
  await fs.promises.mkdir(snapshotsDirectory, {
    recursive: true,
  });

  // remove old diff files
  const diffFilesToRemove = (
    await fs.promises.readdir(snapshotsDirectory)
  ).filter((file) => file.endsWith('-diff.png'));
  await Promise.all(
    diffFilesToRemove.map((file) =>
      fs.promises.rm(path.join(snapshotsDirectory, file)),
    ),
  );

  /**
   * Create snapshot file identifier.
   *
   * @param pageNumber The page of the pdf file.
   */
  function snapshotIdentifier(pageNumber: number): string {
    return `${pageNumber.toString().padStart(2, '0')}_${_.kebabCase(
      currentTestName,
    )}-snap`;
  }

  /**
   * Write file from base64 encoded content.
   *
   * @param data Base64 encoded data.
   * @param filePath File path.
   */
  async function writeFile(data: string, filePath: string): Promise<void> {
    const decodedData = Buffer.from(data, 'base64');

    await fs.promises.writeFile(filePath, decodedData);
  }

  /**
   * Get the list of existing snapshots.
   */
  async function getSnapshots(): Promise<Buffer[]> {
    const result: Buffer[] = [];

    let i = 1;
    do {
      const snapshotPath = path.join(
        snapshotsDirectory,
        `${snapshotIdentifier(i)}.png`,
      );
      try {
        result.push(await fs.promises.readFile(snapshotPath));
      } catch (e) {
        break;
      }
      i++;
    } while (true);

    return result;
  }

  const trpc = createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: process.env.PDF_SNAPSHOT_SERVER_URL ?? 'http://localhost:3000',
      }),
    ],
  });

  const snapshots = (await getSnapshots()).map((snapshot) =>
    snapshot.toString('base64'),
  );

  const { results } = await trpc.matchPdfSnapshot.mutate({
    pdf: pdf.toString('base64'),
    snapshots,
    options: {
      scale: options?.scale,
      failureThreshold: options?.failureThreshold,
    },
  });

  if (_.every(results, 'pass')) {
    snapshotState.matched++;
    return {
      pass: true,
      message: () => '',
    };
  }

  if (_.every(results, 'added')) {
    snapshotState.added++;

    await Promise.all(
      results.map(async (result, index) => {
        if ('newPage' in result) {
          const snapshotPath = path.join(
            snapshotsDirectory,
            `${snapshotIdentifier(index + 1)}.png`,
          );
          await writeFile(result.newPage, snapshotPath);
        }
      }),
    );

    return {
      pass: true,
      message: () => '',
    };
  }

  if (snapshotState._updateSnapshot === 'all') {
    snapshotState.updated++;
    await Promise.all(
      results.map(async (result, index) => {
        if ('pass' in result && result.pass) {
          return;
        }

        const pageNumber = index + 1;
        const snapshotPath = path.join(
          snapshotsDirectory,
          `${snapshotIdentifier(pageNumber)}.png`,
        );

        if ('deleted' in result && result.deleted) {
          await fs.promises.rm(snapshotPath);
          return;
        }

        if ('newPage' in result) {
          await writeFile(result.newPage, snapshotPath);
          return;
        }
      }),
    );
    return {
      pass: true,
      message: () => '',
    };
  }

  snapshotState.unmatched++;

  const resultDetails = await Promise.all(
    results.map(async (result, index) => {
      const pageNumber = index + 1;

      const diffOutputPath = path.join(
        snapshotsDirectory,
        `${snapshotIdentifier(pageNumber)}-diff.png`,
      );

      if ('added' in result && result.added) {
        return `[Page ${pageNumber}] - Added`;
      }

      if ('deleted' in result && result.deleted) {
        return `[Page ${pageNumber}] - Deleted`;
      }

      if ('pass' in result && result.pass) {
        return `[Page ${pageNumber}] - Pass - diffRatio ${result.diffRatio}`;
      }

      if ('pass' in result && !result.pass) {
        await writeFile(result.diffImage, diffOutputPath);
        return `[Page ${pageNumber}] - Does not match snapshot - diffRatio ${result.diffRatio}`;
      }

      return `[Page ${pageNumber}] - Unhandled result`;
    }),
  );

  return {
    pass: false,
    message: () => dedent`
      Does not match with snapshot.

      ${resultDetails.join('\n')}
      `,
  };
};

export { toMatchPdfSnapshot };
