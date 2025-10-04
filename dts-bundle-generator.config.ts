const config = {
  entries: [
    {
      filePath: './src/index.ts',
      outFile: './build/hono-openapi-middlewares.d.ts',
      noCheck: true, // Skip checking due to issues in Hono's type definitions
      libraries: {
        inlinedLibraries: [],
      },
    },
  ],
  compilationOptions: {
    preferredConfigPath: './tsconfig.dts.json',
  },
};

module.exports = config;
