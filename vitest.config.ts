import { defineConfig, configDefaults } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // `store-kontrakt.test.ts` nie je sada testov, ale funkcia, ktorú si
    // volajú iné súbory (dnes lokálne úložisko, v ďalšom kroku Supabase).
    // Sama o sebe žiadny test nespúšťa a vitest by na nej padol hláškou
    // „No test suite found in file".
    exclude: [...configDefaults.exclude, "tests/store-kontrakt.test.ts"],
  },
});
