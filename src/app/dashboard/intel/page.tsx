import { IntelHub } from "@/components/intel/intel-hub";
import { getExternalIntelStrip } from "@/lib/live-map/external-intel";

export const dynamic = "force-dynamic";

export default async function IntelPage() {
  const tickerItems = await getExternalIntelStrip();
  return <IntelHub tickerItems={tickerItems} />;
}
