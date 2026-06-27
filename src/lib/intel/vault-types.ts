export const VAULT_QUERY_TYPES = [
  "dns",
  "whois",
  "certs",
  "ct_logs",
  "subdomains",
  "robots",
  "security_txt",
  "headers",
] as const;

export type VaultQueryType = (typeof VAULT_QUERY_TYPES)[number];

export const VAULT_QUERY_LABELS: Record<VaultQueryType, string> = {
  dns: "DNS records",
  whois: "WHOIS (RDAP)",
  certs: "TLS certificate",
  ct_logs: "Certificate Transparency (crt.sh)",
  subdomains: "Subdomains (from CT)",
  robots: "robots.txt",
  security_txt: "security.txt",
  headers: "Security headers",
};
