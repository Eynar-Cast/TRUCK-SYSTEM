import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // La regla del compilador de React marca los patrones legítimos de
      // fetch-on-mount (useEffect que llama a una función async) como error,
      // aunque el setState ocurra tras un await. Se baja a warning para no
      // bloquear el lint sin perder la visibilidad del aviso.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
