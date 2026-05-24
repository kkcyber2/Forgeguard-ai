import { GET as engineHealth } from "../health/engine/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health — delegates to engine handshake probe */
export async function GET() {
  return engineHealth();
}
