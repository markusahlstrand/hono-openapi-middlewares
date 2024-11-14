import path from "path";
import { defineConfig } from "vite";

const getPackageName = () => {
  return "hono-openapi-middlewares";
};

const getPackageNameCamelCase = () => {
  try {
    return getPackageName().replace(/-./g, (char) => char[1].toUpperCase());
  } catch (err: unknown) {
    const error  = err as Error;
    throw new Error("Name property in package.json is missing: " + error.message);
  }
};

const fileName = {
  es: `${getPackageName()}.mjs`,
  cjs: `${getPackageName()}.cjs`,  
};

module.exports = defineConfig({
  base: "./",
  build: {
    outDir: "./build",
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: getPackageNameCamelCase(),
      formats: ["es", "cjs"],
      fileName: (format) => fileName[format],
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      { find: "@@", replacement: path.resolve(__dirname) },
    ],
  },
});
