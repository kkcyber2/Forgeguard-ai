import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(
  process.argv[2] ??
    "C:/Users/ksk80/.cursor/projects/c-Users-ksk80-OneDrive-Dokumen-Kimi-Agent-ForgeGuard-AI-Full-Stack-App/agent-tools/371a5951-69b7-4072-a5dc-f498d1e128f3.txt",
);
const dest = path.resolve(__dirname, "../src/types/supabase.ts");

const j = JSON.parse(fs.readFileSync(src, "utf8"));
const aliases = `

// Convenience row aliases
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
export type UserWalletRow = Database["public"]["Tables"]["user_wallets"]["Row"]
export type BazaarScriptRow = Database["public"]["Tables"]["bazaar_scripts"]["Row"]
export type BazaarPurchaseRow = Database["public"]["Tables"]["bazaar_purchases"]["Row"]
export type MissionRow = Database["public"]["Tables"]["missions"]["Row"]
export type MissionProposalRow = Database["public"]["Tables"]["mission_proposals"]["Row"]
export type MissionApplicationRow = Database["public"]["Tables"]["mission_applications"]["Row"]
export type LegalSignatureRow = Database["public"]["Tables"]["legal_signatures"]["Row"]
export type PlatformTransactionRow = Database["public"]["Tables"]["platform_transactions"]["Row"]
export type BountyEscrowRow = Database["public"]["Tables"]["bounty_escrow"]["Row"]
export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"]
export type ScanRow = Database["public"]["Tables"]["scans"]["Row"]
`;

fs.writeFileSync(dest, j.types + aliases);
console.log("Wrote", dest);
