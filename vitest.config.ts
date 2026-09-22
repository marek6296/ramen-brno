import { defineConfig } from "vitest/config";
import path from "node:path";
import { config } from "dotenv";

// Testy proti Supabase potrebujú prístupové údaje z .env.local. Ten je mimo
// gitu, takže na cudzom stroji jednoducho nebudú a test sa preskočí.
config({ path: path.resolve(__dirname, ".env.local"), quiet: true });

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  // `tests/store-kontrakt.ts` zámerne nemá `.test.` v názve — nie je to sada
  // testov, ale funkcia, ktorú si volajú iné súbory, aby sa obe implementácie
  // merali tým istým metrom.
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
