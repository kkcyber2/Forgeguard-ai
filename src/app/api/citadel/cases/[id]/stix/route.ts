import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";
import { hasCitadelAccess } from "@/lib/citadel/access";
import { fetchCaseDetail } from "@/lib/citadel/queries";

export const dynamic = "force-dynamic";

/** STIX 2.1 bundle export for a Citadel case. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || !(await hasCitadelAccess(user.id))) {
    return new NextResponse(null, { status: 404 });
  }

  const { id } = await context.params;
  const { case: caseRow, entities } = await fetchCaseDetail(id);
  if (!caseRow) return new NextResponse(null, { status: 404 });

  const now = new Date().toISOString();
  const bundle = {
    type: "bundle",
    id: `bundle--${id}`,
    spec_version: "2.1",
    objects: [
      {
        type: "report",
        spec_version: "2.1",
        id: `report--${id}`,
        created: now,
        modified: now,
        name: caseRow.title,
        published: now,
        object_refs: entities.map((e) => `indicator--${e.id}`),
        labels: ["citadel", caseRow.status],
      },
      ...entities.map((e) => ({
        type: "indicator",
        spec_version: "2.1",
        id: `indicator--${e.id}`,
        created: e.created_at,
        modified: e.created_at,
        name: e.value,
        pattern: `[${e.entity_type}:value = '${e.value.replace(/'/g, "\\'")}']`,
        pattern_type: "stix",
        valid_from: e.created_at,
        labels: [e.entity_type, e.source],
        confidence: Math.round(e.confidence * 100),
      })),
    ],
  };

  return NextResponse.json(bundle, {
    headers: {
      "Content-Type": "application/stix+json;version=2.1",
      "Content-Disposition": `attachment; filename="citadel-case-${id}.json"`,
    },
  });
}
