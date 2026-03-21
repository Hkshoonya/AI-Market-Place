import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nextDir = path.resolve(__dirname, "..", ".next");

if (existsSync(nextDir)) {
  console.log(`[build] Removing stale Next build output at ${nextDir}`);
  rmSync(nextDir, { recursive: true, force: true });
}
