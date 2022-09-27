import * as path from 'node:path';
import * as fs from 'node:fs';
import rimraf from 'rimraf';
import fetch from 'node-fetch-commonjs';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import _ from 'lodash';
import dedent from 'dedent';
import * as process from 'process';

import type { AppRouter } from '@btravers/pdf-snapshot-service/dist/router';

const globalAny = global as any;
globalAny.fetch = fetch;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMatchPdfSnapshot(options: Options): Promise<R>;
    }
  }
}

type Options = {
  scale?: number;
  failureThreshold?: number;
};

type Result = {
  pass: boolean;
  message: () => string;
};

expect.extend({
  async toMatchPdfSnapshot(pdf: Buffer, options?: Options): Promise<Result> {
    const { testPath, currentTestName, isNot, snapshotState } = this;

    if (isNot) {
      throw new Error(
        'Jest: `.not` cannot be used with `.toMatchPdfSnapshot()`.',
      );
    }

    const snapshotsDirectory = path.join(
      path.dirname(testPath ?? ''),
      '__pdf_snapshots__',
    );
    await fs.promises.mkdir(snapshotsDirectory, {
      recursive: true,
    });

    function snapshotIdentifier(pageNumber: number): string {
      return `${pageNumber.toString().padStart(2, '0')}_${_.kebabCase(
        currentTestName,
      )}-${pageNumber}-snap`;
    }

    async function writeSnapshot(
      newPageResult: string,
      pageNumber: number,
    ): Promise<void> {
      const snapshotPath = path.join(
        snapshotsDirectory,
        `${snapshotIdentifier(pageNumber)}.png`,
      );

      const page = Buffer.from(newPageResult, 'base64');

      await fs.promises.writeFile(snapshotPath, page);
    }

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

    const matchPdfSnapshotQuery = {
      pdf: pdf.toString('base64'),
      snapshots,
      options: {
        scale: options?.scale,
        failureThreshold: options?.failureThreshold,
      },
    };

    const { results } = await trpc.matchPdfSnapshot.mutate(
      matchPdfSnapshotQuery,
    );

    const updateSnapshot = snapshotState._updateSnapshot === 'all';

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
            await writeSnapshot(result.newPage, index + 1);
          }
        }),
      );

      return {
        pass: true,
        message: () => '',
      };
    }

    if (updateSnapshot) {
      snapshotState.updated++;
      await Promise.all(
        results
          .filter((result) => 'pass' in result && !result.pass)
          .map(async (result, index) => {
            const pageNumber = index + 1;

            if ('deleted' in result && result.deleted) {
              const snapshotPath = path.join(
                snapshotsDirectory,
                `${snapshotIdentifier(pageNumber)}.png`,
              );
              await fs.promises.rm(snapshotPath);
              return;
            }

            if ('newPage' in result) {
              await writeSnapshot(result.newPage, pageNumber);
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
        rimraf.sync(diffOutputPath);

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
          await fs.promises.writeFile(diffOutputPath, result.diffImage);
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
  },
});
