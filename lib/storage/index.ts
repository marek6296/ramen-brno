import path from "node:path";
import { createLocalStore } from "./local";
import type { Store } from "./types";

let instance: Store | null = null;

/**
 * Jediné miesto, kde sa rozhoduje, kam sa dáta ukladajú. V 2. etape tu
 * pribudne vetva na Supabase; volajúci kód o tom nebude vedieť.
 */
export function getStore(): Store {
  if (!instance) {
    instance = createLocalStore(
      process.env.TV_DATA_DIR ?? path.join(process.cwd(), ".data"),
    );
  }
  return instance;
}
