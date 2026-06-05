import { NextResponse, type NextRequest } from "next/server";
import { verifyBunkerPowChain } from "@/lib/bunker/bunker-pow";
import { BUNKER_CLEARED_COOKIE } from "@/services/fortress-perimeter.service";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  let body: { seed?: string; proof?: string };
  try {
    body = (await req.json()) as { seed?: string; proof?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const seed = body.seed?.trim();
  const proof = body.proof?.trim().toLowerCase();
  if (!seed || !proof || seed.length < 16) {
    return NextResponse.json({ ok: false, error: "Missing seed or proof" }, { status: 400 });
  }

  const valid = await verifyBunkerPowChain(seed, proof);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Invalid proof" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, message: "Bunker challenge cleared." });
  res.cookies.set(BUNKER_CLEARED_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
