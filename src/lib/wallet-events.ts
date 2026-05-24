/** Cross-component wallet refresh after purchases / top-ups. */
export const WALLET_REFRESH_EVENT = "forgeguard:wallet-refresh";

export function notifyWalletRefresh(balance?: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(WALLET_REFRESH_EVENT, { detail: { balance } }),
  );
}
