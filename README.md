# PDF Snapshot

[![NPM version][npm-badge-url]][npm-url]
[![code style: prettier][prettier-badge-url]][prettier-url]
![Pull Request CI/CD](https://github.com/btravers/pdf-snapshot/workflows/Pull%20Request%20CI/CD/badge.svg?branch=master)

Jest matcher for visual regression testing of PDF documents. 
Behaves just like [Jest snapshots](https://facebook.github.io/jest/docs/snapshot-testing.html) do.

Under the hood, it uses [pdf.js](https://github.com/mozilla/pdf.js) for conversion of a pdf to png. 
In node, pdf.js depends on [canvas](https://github.com/Automattic/node-canvas).
Finally, the comparison is happening via [pixelmatch](https://github.com/mapbox/pixelmatch.

In order to be platform agnostic, the png conversion and png comparison is performed by a small server running aside, available as a [Docker image](https://hub.docker.com/r/btravers/pdf-snapshot) and communicating with Jest matcher using [tRCP](https://github.com/trpc/trpc). 

## Usage

### Prerequisites

Before you begin, ensure you have met the following requirements:

- You have installed the latest version of Docker.

### Installation

First pull the Docker image of the main service.
```sh
docker pull btravers/pdf-snapshot
```

Then install Jest matcher in the dev dependencies of your project.

```sh
npm install --save-dev @btravers/pdf-snapshot-jest
```

Please note that Jest 28 is a peerDependency. 

Declare `toMatchPdfSnapshot` matcher in your Jest configuration.

```json
"jest": {
  "setupFilesAfterEnv": [
    "@btravers/pdf-snapshot-jest/dist/toMatchPdfSnapshot"
  ]
}
```

If you are using **Typescript** add `import('@btravers/pdf-snapshot-jest/dist/toMatchPdfSnapshot');` to your typings.

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
