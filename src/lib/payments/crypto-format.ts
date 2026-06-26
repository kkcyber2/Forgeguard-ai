export const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const USDT_TRC20_DECIMALS = 6;

/** Client-safe crypto amount helpers (no server-only). */

export function isUsdtStableCoin(payCurrency: string): boolean {
  const c = payCurrency.trim().toLowerCase();
  return (
    c === "usdt" ||
    c === "usdttrc20" ||
    c === "usdterc20" ||
    (c.startsWith("usdt") && !c.includes("btc"))
  );
}

/** Catalog USD price → payable USDT (1:1, no FX slippage in UI). */
export function resolveCatalogPayAmount(
  catalogUsd: number,
  payCurrency: string,
): number {
  if (!isUsdtStableCoin(payCurrency)) {
    return catalogUsd;
  }
  return Math.round(catalogUsd * 100) / 100;
}

/** Human-readable pay amount — whole USDT for stablecoins, decimals for BTC/SOL. */
export function formatCryptoPayAmount(
  amount: number,
  payCurrency: string,
): string {
  if (isUsdtStableCoin(payCurrency)) {
    const n = Math.round(amount * 100) / 100;
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }
  if (amount >= 1) return amount.toFixed(2);
  return amount.toFixed(6);
}
