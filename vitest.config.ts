import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  // `tests/store-kontrakt.ts` zámerne nemá `.test.` v názve — nie je to sada
  // testov, ale funkcia, ktorú si volajú iné súbory (dnes lokálne úložisko,
  // o chvíľu Supabase), aby sa obe implementácie merali tým istým metrom.
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
