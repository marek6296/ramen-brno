import { defineConfig } from "vitest/config";
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, ".env.local"), quiet: true });

// `supabase-store.test.ts` je zámerne MIMO bežného `npm test`: potrebuje
// prázdnu tabuľku, takže pred každým testom zmaže všetky obrazovky. Spúšťa
// sa výhradne cez `npm run test:db`, ktorý si o to povie premennou nižšie —
// aby nikoho nenapadlo pustiť ho omylom nad databázou, kde niečo beží.
//
// `tests/store-kontrakt.ts` zámerne nemá `.test.` v názve: nie je to sada
// testov, ale funkcia, ktorú si volajú iné súbory, aby sa obe implementácie
// merali tým istým metrom.
const chceDatabazu = process.env.VITEST_DB === "1";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: chceDatabazu
      ? ["node_modules/**"]
      : ["tests/supabase-store.test.ts", "node_modules/**"],
  },
});
