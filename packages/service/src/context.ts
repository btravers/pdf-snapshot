import { inferAsyncReturnType } from '@trpc/server';

export function createContext() {
  return {};
}

export type Context = inferAsyncReturnType<typeof createContext>;
