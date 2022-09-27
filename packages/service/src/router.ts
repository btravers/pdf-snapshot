import { z } from 'zod';
import { matchPdfSnapshot } from './process';
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();

export const appRouter = t.router({
  matchPdfSnapshot: t.procedure
    .input(
      z.object({
        pdf: z.string(),
        snapshots: z.string().array().optional(),
        options: z
          .object({
            scale: z.number().min(1).max(10).optional(),
            failureThreshold: z.number().min(0).max(1).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async (req) => {
      const { pdf, snapshots, options } = req.input;

      const pdfBuffer = Buffer.from(pdf, 'base64');
      const snapshotBuffers = snapshots?.map((snapshot) =>
        Buffer.from(snapshot, 'base64'),
      );

      return matchPdfSnapshot(pdfBuffer, snapshotBuffers, options);
    }),
});

export type AppRouter = typeof appRouter;
