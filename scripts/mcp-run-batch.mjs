#!/usr/bin/env node
/** Print batch SQL path + size for MCP execute_sql (stdout = path only) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const batch = process.argv[2];
if (!batch) {
  console.error("Usage: node scripts/mcp-run-batch.mjs batch_01.sql");
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, ".launch-batches", batch);
if (!fs.existsSync(file)) {
  console.error("Missing", file);
  process.exit(1);
}
const sql = fs.readFileSync(file, "utf8");
process.stdout.write(sql);
