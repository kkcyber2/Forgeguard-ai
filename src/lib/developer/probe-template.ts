/** Default probe.py template — matches engine Docker sandbox contract. */
export const PROBE_TEMPLATE = `import json
import os

# Injected by the Agathon sandbox (scan or dry-run):
#   TARGET_URL, TARGET_MODEL, TARGET_API_KEY
url = os.environ.get("TARGET_URL", "")
model = os.environ.get("TARGET_MODEL", "")

# Your probe logic here — print JSON to stdout on success.
print(json.dumps({"ok": True, "target": url, "model": model}))
`;
