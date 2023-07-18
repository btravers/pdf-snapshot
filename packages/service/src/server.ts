import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createContext } from './context';
import { appRouter, type AppRouter } from './router';

const app = express();

app.use(
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.listen(3000);

export { type AppRouter };
