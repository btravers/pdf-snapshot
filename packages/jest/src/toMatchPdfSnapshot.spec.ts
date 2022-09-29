import * as path from 'node:path';
import * as fs from 'node:fs';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

describe('Jest extension', () => {
  let container: StartedTestContainer | undefined;

  beforeAll(async () => {
    const buildContext = path.resolve(__dirname, '../../..');
    const builtImage = await GenericContainer.fromDockerfile(
      buildContext,
    ).build();
    const container = await builtImage.withExposedPorts(3000).start();

    const containerHost = container.getHost();
    const containerPort = container.getMappedPort(3000);

    process.env.PDF_SNAPSHOT_SERVER_URL = `http://${containerHost}:${containerPort}`;
  }, 300_000);

  afterAll(async () => {
    if (container) {
      await container.stop();
    }
  });

  it('should perform a snapshot test of a dummy pdf', async () => {
    const pdfPath = path.join(__dirname, '__fixtures__/dummy.pdf');
    const pdf = await fs.promises.readFile(pdfPath);

    await expect(pdf).toMatchPdfSnapshot();
  });
});
