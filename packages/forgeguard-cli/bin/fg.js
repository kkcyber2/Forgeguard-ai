#!/usr/bin/env node
/**
 * ForgeGuard CLI — scan start, report pull, aegis export.
 * Usage: fg <command> [options]
 */
const args = process.argv.slice(2);

const API_BASE = process.env.FORGEGUARD_API_URL ?? "https://www.forgeguard-ai.com";
const API_KEY = process.env.FORGEGUARD_API_KEY ?? "";

function usage() {
  console.log(`ForgeGuard CLI v0.2.0

Commands:
  scan start --target <url> --model <name> [--intensity standard|aggressive|greasy]
  scan status --id <scan-id>
  aegis export --format json
  citadel cases (requires session cookie — use browser)
  demo scan (public metadata)

Environment:
  FORGEGUARD_API_URL   API base (default: ${API_BASE})
  FORGEGUARD_API_KEY   Enterprise or session bearer token
`);
}

async function main() {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    usage();
    process.exit(0);
  }

  const [cmd, sub, ...rest] = args;

  if (cmd === "demo" && sub === "scan") {
    const res = await fetch(`${API_BASE}/api/demo/scan`);
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
    return;
  }

  if (cmd === "scan" && sub === "start") {
    const targetIdx = rest.indexOf("--target");
    const modelIdx = rest.indexOf("--model");
    const intensityIdx = rest.indexOf("--intensity");
    const target = targetIdx >= 0 ? rest[targetIdx + 1] : null;
    const model = modelIdx >= 0 ? rest[modelIdx + 1] : "gpt-4";
    const intensity = intensityIdx >= 0 ? rest[intensityIdx + 1] : "standard";
    if (!target) {
      console.error("Missing --target");
      process.exit(1);
    }
    if (!API_KEY) {
      console.error("Set FORGEGUARD_API_KEY or use the dashboard to start scans.");
      process.exit(1);
    }
    const res = await fetch(`${API_BASE}/api/v1/scans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "X-ForgeGuard-API-Key": API_KEY,
      },
      body: JSON.stringify({ target_url: target, target_model: model, intensity }),
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
    if (!res.ok) process.exit(1);
    return;
  }

  if (cmd === "aegis" && sub === "export") {
    console.log(JSON.stringify({ ok: true, note: "Use /dashboard/aegis export in UI or wire enterprise key." }));
    return;
  }

  if (cmd === "citadel" && sub === "cases") {
    console.log("Citadel cases require browser session — visit /citadel");
    return;
  }

  console.error(`Unknown command: ${args.join(" ")}`);
  usage();
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
