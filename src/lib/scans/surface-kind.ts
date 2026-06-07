/** Map UI / CI aliases → scan_surface_kind enum values. */
export const SURFACE_KINDS = ["llm", "web", "code", "mobile"] as const;

export type SurfaceKind = (typeof SURFACE_KINDS)[number];

const SURFACE_ALIASES: Record<string, SurfaceKind> = {
  llm: "llm",
  web: "web",
  code: "code",
  mobile: "mobile",
  api: "code",
  bot: "mobile",
  gateway: "code",
  chatbot: "mobile",
};

export function normalizeSurfaceKind(
  raw: string | null | undefined,
): SurfaceKind {
  const key = String(raw ?? "llm").trim().toLowerCase();
  return SURFACE_ALIASES[key] ?? "llm";
}
