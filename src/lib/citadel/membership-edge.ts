/** Edge-safe Citadel membership checks (middleware). */

export const DEFAULT_COMPARTMENT_ID =
  "00000000-0000-4000-8000-000000000001" as const;

export async function isAgencyMemberService(
  userId: string,
  compartmentId: string = DEFAULT_COMPARTMENT_ID,
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const res = await fetch(
    `${url}/rest/v1/agency_members?compartment_id=eq.${compartmentId}&user_id=eq.${userId}&select=id&limit=1`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

export async function ensureSovereignCitadelBootstrap(
  userId: string,
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const existing = await fetch(
    `${url}/rest/v1/agency_members?compartment_id=eq.${DEFAULT_COMPARTMENT_ID}&user_id=eq.${userId}&select=id&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    },
  );
  if (existing.ok) {
    const rows = (await existing.json()) as unknown[];
    if (Array.isArray(rows) && rows.length > 0) return true;
  }

  const res = await fetch(`${url}/rest/v1/agency_members`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      compartment_id: DEFAULT_COMPARTMENT_ID,
      user_id: userId,
      role: "commander",
      invited_by: userId,
    }),
  });
  return res.ok || res.status === 409;
}
