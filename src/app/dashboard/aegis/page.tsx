import { SovereignProxyConfig } from "@/components/aegis/sovereign-proxy-config";
import AegisClientPage from "./aegis-client";
import { AegisDefenseStats } from "./aegis-defense-stats";

export const metadata = { title: "Aegis Shield" };

export default function AegisPage() {
  return (
    <div className="flex flex-col gap-6">
      <SovereignProxyConfig />
      <AegisDefenseStats />
      <AegisClientPage />
    </div>
  );
}
