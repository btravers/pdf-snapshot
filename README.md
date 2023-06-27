# PDF Snapshot

![GitHub Workflow Status (branch)](https://img.shields.io/github/workflow/status/btravers/pdf-snapshot/ci/main?logo=githubactions)
![npm](https://img.shields.io/npm/v/@armandbaric/pdf-snapshot-jest?color=g&label=version&logo=npm)
![Docker Image Version (latest semver)](https://img.shields.io/docker/v/btravers/pdf-snapshot?color=g&logo=docker)
![GitHub](https://img.shields.io/github/license/btravers/pdf-snapshot?color=g)

Jest matcher for visual regression testing of PDF documents.
Behaves just like [Jest snapshots](https://facebook.github.io/jest/docs/snapshot-testing.html) do.

Under the hood, it uses [pdf.js](https://github.com/mozilla/pdf.js) for conversion of a pdf to png.
In node, pdf.js depends on [canvas](https://github.com/Automattic/node-canvas).
Finally, the comparison is happening via [pixelmatch](https://github.com/mapbox/pixelmatch).

In order to be platform agnostic, the png conversion and png comparison is performed by a small server running aside, available as a [Docker image](https://hub.docker.com/r/btravers/pdf-snapshot) and communicating with Jest matcher using [tRCP](https://github.com/trpc/trpc).

## Usage

### Prerequisites

Before you begin, ensure you have met the following requirements:

- You have installed the latest version of Docker.

### Installation

First pull the Docker image of the main service.

```sh
docker pull armandabric/pdf-snapshot
```

Then install Jest matcher in the dev dependencies of your project.

```sh
npm install --save-dev @armandabric/pdf-snapshot-matcher
```

Please note that Jest 28 is a peerDependency.

Declare `toMatchPdfSnapshot` matcher in your Jest configuration.

```ts
import { toMatchPdfSnapshot } from '@armandabric/pdf-snapshot-matcher';

expect.extend({ toMatchPdfSnapshot });
```

<!-- If you are using **Typescript** add `import('@armandabric/pdf-snapshot-jest/dist/toMatchPdfSnapshot');` to your typings. -->

### Invocation

Start the container with the main service.

```sh
docker run -d -p 3000:3000 btravers/pdf-snapshot
```

In your test, export `PDF_SNAPSHOT_SERVER_URL` environment variable in order to link Jest matcher with the service running in the container.

```js
process.env.PDF_SNAPSHOT_SERVER_URL = 'http://localhost:3000'
```

Now, all you have to do in your tests is pass a pdf content as Buffer.

```ts
const pdfBuffer = await fs.promise.readFile('path to your pdf');
describe('test pdf report visual regression', () => {
  it('should match', () => expect(pdfBuffer).toMatchPdfSnapshot());
});
```

### Go further

You can rely on [testcontainers-node](https://github.com/testcontainers/testcontainers-node) and automate the container start before tests run.

## Credits

- [pdf-visual-diff](https://github.com/moshensky/pdf-visual-diff)
- [jest-image-snapshot](https://github.com/americanexpress/jest-image-snapshot)
