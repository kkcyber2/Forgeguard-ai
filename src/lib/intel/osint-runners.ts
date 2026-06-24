/**
 * Legal OSINT query runners — passive public data only.
 * See CITADEL_LAUNCH_VAULT/INTEL_VAULT_SCOPE.md
 */

import dns from "node:dns/promises";
import tls from "node:tls";
import type { VaultQueryType } from "@/lib/intel/vault-types";

const FETCH_TIMEOUT_MS = 8_000;
const BLOCKED_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1|\[::1\])/i;

/** Strip protocol / path → hostname */
export function normaliseDomain(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  try {
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    return new URL(url).hostname.replace(/\.$/, "");
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0]?.replace(/\.$/, "") ?? trimmed;
  }
}

export function assertPublicDomain(domain: string): void {
  if (!domain || domain.length > 253) throw new Error("Invalid domain.");
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(domain) && !/^[a-z0-9]$/.test(domain)) {
    throw new Error("Invalid domain format.");
  }
  if (BLOCKED_HOST_RE.test(domain)) {
    throw new Error("Internal or reserved targets are not allowed.");
  }
}

async function fetchPublic(path: string, domain: string): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://${domain}${path}`, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "ForgeGuard-IntelVault/1.0 (+legal-osint)" },
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const body = await res.text();
    return { status: res.status, body: body.slice(0, 32_000), headers };
  } finally {
    clearTimeout(timer);
  }
}

async function runDns(domain: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { domain };
  const types: Array<[string, () => Promise<unknown>]> = [
    ["A", () => dns.resolve4(domain)],
    ["AAAA", () => dns.resolve6(domain)],
    ["MX", () => dns.resolveMx(domain)],
    ["NS", () => dns.resolveNs(domain)],
    ["TXT", () => dns.resolveTxt(domain)],
    ["CNAME", () => dns.resolveCname(domain)],
  ];
  const records: Record<string, unknown> = {};
  for (const [label, fn] of types) {
    try {
      records[label] = await fn();
    } catch (e) {
      records[label] = { error: e instanceof Error ? e.message : "lookup failed" };
    }
  }
  out.records = records;
  return out;
}

async function runWhois(domain: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: controller.signal,
      headers: { Accept: "application/rdap+json" },
    });
    if (!res.ok) {
      return { domain, error: `RDAP HTTP ${res.status}`, source: "rdap.org" };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      domain,
      source: "rdap.org",
      handle: data.handle,
      ldhName: data.ldhName,
      status: data.status,
      events: data.events,
      nameservers: data.nameservers,
      entities: data.entities,
    };
  } finally {
    clearTimeout(timer);
  }
}

function runCerts(domain: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let socket: tls.TLSSocket | undefined;
    const timer = setTimeout(() => {
      socket?.destroy();
      resolve({ domain, error: "TLS handshake timeout" });
    }, FETCH_TIMEOUT_MS);

    socket = tls.connect(
      { host: domain, port: 443, servername: domain, rejectUnauthorized: false },
      () => {
        clearTimeout(timer);
        const s = socket;
        if (!s) {
          resolve({ domain, error: "TLS connection lost" });
          return;
        }
        const cert = s.getPeerCertificate();
        s.end();
        if (!cert || !cert.subject) {
          resolve({ domain, error: "No certificate returned" });
          return;
        }
        resolve({
          domain,
          subject: cert.subject,
          issuer: cert.issuer,
          valid_from: cert.valid_from,
          valid_to: cert.valid_to,
          serialNumber: cert.serialNumber,
          fingerprint256: cert.fingerprint256,
          subjectaltname: cert.subjectaltname,
        });
      },
    );
    socket.on("error", (e) => {
      clearTimeout(timer);
      resolve({ domain, error: e.message });
    });
  });
}

async function runRobots(domain: string): Promise<Record<string, unknown>> {
  const { status, body } = await fetchPublic("/robots.txt", domain);
  return { domain, path: "/robots.txt", http_status: status, content: body };
}

async function runSecurityTxt(domain: string): Promise<Record<string, unknown>> {
  const { status, body } = await fetchPublic("/.well-known/security.txt", domain);
  return { domain, path: "/.well-known/security.txt", http_status: status, content: body };
}

const SECURITY_HEADER_KEYS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "server",
];

async function runHeaders(domain: string): Promise<Record<string, unknown>> {
  const { status, headers } = await fetchPublic("/", domain);
  const security: Record<string, string> = {};
  for (const key of SECURITY_HEADER_KEYS) {
    if (headers[key]) security[key] = headers[key];
  }
  return { domain, http_status: status, security_headers: security, all_headers: headers };
}

export async function executeOsintQuery(
  queryType: VaultQueryType,
  domain: string,
): Promise<Record<string, unknown>> {
  assertPublicDomain(domain);
  switch (queryType) {
    case "dns":
      return runDns(domain);
    case "whois":
      return runWhois(domain);
    case "certs":
      return runCerts(domain);
    case "robots":
      return runRobots(domain);
    case "security_txt":
      return runSecurityTxt(domain);
    case "headers":
      return runHeaders(domain);
    default:
      throw new Error("Unsupported query type.");
  }
}
