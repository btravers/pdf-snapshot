module.exports = {
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '\\.ts$': 'ts-jest',
  },
  expand: true,
  setupFilesAfterEnv: ['<rootDir>/dist/toMatchPdfSnapshot'],
};
