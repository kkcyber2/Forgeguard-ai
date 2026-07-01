#!/usr/bin/env node
/**
 * ForgeGuard CLI stub — Phase 9 package placeholder.
 * Usage: node packages/forgeguard-cli/bin/fg.js --help
 */
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`ForgeGuard CLI (stub)
  fg scan --target <url>   Queue a kinetic scan (not wired)
  fg citadel cases       List agency cases (not wired)
`);
  process.exit(0);
}
console.log("ForgeGuard CLI stub — see packages/forgeguard-cli/README.md");
process.exit(0);
