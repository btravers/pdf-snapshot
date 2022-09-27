import * as path from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import _ from 'lodash';
import dedent from 'dedent';
import * as process from 'process';

import type { AppRouter } from '@btravers/pdf-snapshot-service';
import fs from 'node:fs';
import rimraf from 'rimraf';

type Options = {
  scale?: number;
  failureThreshold?: number;
};

type Result = {
  pass: boolean;
  message: () => string;
};

const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.PDF_SNAPSHOT_SERVER_URL}`,
    }),
  ],
});

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

    function snapshotIdentifier(pageNumber: number) {
      return `${pageNumber.toString().padStart(2, '0')}${_.kebabCase(
        currentTestName,
      )}-${pageNumber}-snap`;
    }

    const { results } = await trpc.matchPdfSnapshot.query({
      pdf: pdf.toString('base64'),
      snapshots: [''],
      options: {
        scale: options?.scale,
        failureThreshold: options?.failureThreshold,
      },
    });

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
            const snapshotPath = path.join(
              snapshotsDirectory,
              `${snapshotIdentifier(pageNumber)}.png`,
            );

            if ('deleted' in result && result.deleted) {
              await fs.promises.rm(snapshotPath);
              return;
            }

            if ('newPage' in result) {
              await fs.promises.writeFile(snapshotPath, result.newPage);
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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMatchPdfSnapshot(): Promise<R>;
    }
  }
}
