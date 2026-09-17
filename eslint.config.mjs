import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
  {
    ignores: ["convex/_generated/**"],
  },
  {
    extends: [...nextCoreWebVitals],
  },
  {
    // The bundled eslint-plugin-react-hooks v7 flags any setState call inside
    // a useEffect, including the cancelled-flag fetch-on-mount pattern from
    // React's own docs (https://react.dev/learn/synchronizing-with-effects#fetching-data)
    // — which is exactly what every flagged call site here does. Downgraded
    // rather than rewriting those components' data-fetching to a
    // Suspense/`use()` model, which is out of scope for a dependency upgrade.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);