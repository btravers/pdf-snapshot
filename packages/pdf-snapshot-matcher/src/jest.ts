import { toMatchPdfSnapshot, type Options } from './toMatchPdfSnapshot';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMatchPdfSnapshot(options?: Options): Promise<R>;
    }
  }
}

export { toMatchPdfSnapshot };
