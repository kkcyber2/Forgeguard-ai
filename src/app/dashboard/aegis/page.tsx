import AegisClientPage from "./aegis-client";
import { AegisDefenseStats } from "./aegis-defense-stats";

export const metadata = { title: "Aegis Shield" };

export default function AegisPage() {
  return (
    <>
      <AegisDefenseStats />
      <AegisClientPage />
    </>
  );
}
