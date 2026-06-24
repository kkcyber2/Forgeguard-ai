/**
 * Request budgets per scan intensity — mirrors AI-red-team attack_tier_logic.BUDGETS.
 * Used for pre-launch UI estimates (not runtime enforcement; engine owns ceilings).
 */

export type DbIntensity = "recon" | "standard" | "aggressive" | "greasy";

export type UiIntensity = "standard" | "high" | "nuclear";

export interface IntensityBudget {
  dbIntensity: DbIntensity;
  label: string;
  maxAttacks: number;
  maxWallMinutes: number;
  maxToolCalls: number;
  maxCustomTools: number;
  maxBrainInputTokens: number;
  maxBrainOutputTokens: number;
  estimatedLlmCalls: { low: number; high: number };
  costBandUsd: { low: number; high: number };
}

/** UI strike power → DB intensity */
export function uiIntensityToDb(ui: UiIntensity): DbIntensity {
  if (ui === "high") return "aggressive";
  if (ui === "nuclear") return "greasy";
  return "standard";
}

const BUDGETS: Record<DbIntensity, IntensityBudget> = {
  recon: {
    dbIntensity: "recon",
    label: "Recon",
    maxAttacks: 4,
    maxWallMinutes: 2,
    maxToolCalls: 12,
    maxCustomTools: 0,
    maxBrainInputTokens: 20_000,
    maxBrainOutputTokens: 4_000,
    estimatedLlmCalls: { low: 8, high: 16 },
    costBandUsd: { low: 0.02, high: 0.08 },
  },
  standard: {
    dbIntensity: "standard",
    label: "Standard",
    maxAttacks: 25,
    maxWallMinutes: 15,
    maxToolCalls: 60,
    maxCustomTools: 0,
    maxBrainInputTokens: 120_000,
    maxBrainOutputTokens: 20_000,
    estimatedLlmCalls: { low: 40, high: 90 },
    costBandUsd: { low: 0.15, high: 0.65 },
  },
  aggressive: {
    dbIntensity: "aggressive",
    label: "High (Aggressive)",
    maxAttacks: 80,
    maxWallMinutes: 60,
    maxToolCalls: 200,
    maxCustomTools: 8,
    maxBrainInputTokens: 400_000,
    maxBrainOutputTokens: 80_000,
    estimatedLlmCalls: { low: 120, high: 280 },
    costBandUsd: { low: 0.8, high: 3.5 },
  },
  greasy: {
    dbIntensity: "greasy",
    label: "Nuclear (Greasy)",
    maxAttacks: 300,
    maxWallMinutes: 240,
    maxToolCalls: 800,
    maxCustomTools: 30,
    maxBrainInputTokens: 2_000_000,
    maxBrainOutputTokens: 400_000,
    estimatedLlmCalls: { low: 400, high: 1200 },
    costBandUsd: { low: 4, high: 18 },
  },
};

export function budgetForUiIntensity(ui: UiIntensity): IntensityBudget {
  return BUDGETS[uiIntensityToDb(ui)];
}

export function formatCostBand(band: { low: number; high: number }): string {
  if (band.low === band.high) return `$${band.low.toFixed(2)}`;
  return `$${band.low.toFixed(2)} – $${band.high.toFixed(2)}`;
}
