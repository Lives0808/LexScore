import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // eslint-config-next 的默认忽略项
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Capacitor 同步进安卓工程的 Web 产物，以及安卓原生代码
    "android/**",
  ]),
]);

export default eslintConfig;
