import path from 'node:path';
import fs from 'node:fs';

describe('Jest extension', () => {
  it('should perform a snapshot test of a dummy pdf', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const pdfPath = path.join(__dirname, '__fixtures__/dummy.pdf');
    const pdf = await fs.promises.readFile(pdfPath);

    await expect(pdf).toMatchPdfSnapshot();
  });
});
