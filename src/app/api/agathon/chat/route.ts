import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildContextDigest,
  streamChatTurn,
  type ChatHistoryTurn,
} from "@/lib/agathon/live_brain_client";

/**
 * POST /api/agathon/chat
 * ----------------------
 *
 * The interactive Agathon chat endpoint. The user's dashboard sends:
 *
 *   { scanId: string, message: string, history?: [{role, content}] }
 *
 * and gets back a Server-Sent-Events stream of `data: {kind, ...}` frames.
 * The shape of those frames matches `ChatChunk` from live_brain_client.ts —
 * the client just needs to JSON.parse each `data:` line.
 *
 * Why nodejs runtime (not edge):
 *   - The Anthropic SDK + Supabase SSR client both rely on Node APIs we
 *     don't want to polyfill. Edge would be marginally faster on the
 *     first byte but we're CPU-bound on the Brain anyway.
 *
 * Auth:
 *   - We call createServerSupabase() to get the cookie-bound client. RLS
 *     does the work — if the user can't see the scan, the digest builder
 *     throws and we return 404. We never pass the raw user_id from the
 *     client; everything is gated through the session.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  scanId: z.string().uuid(),
  message: z.string().min(1).max(4_000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8_000),
      }),
    )
    .max(20)
    .optional(),
});

export async function POST(req: Request): Promise<Response> {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: `bad request: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Build the digest *before* opening the SSE stream so we can return a
  // clean 404 / 403 if anything goes wrong. Once we start streaming we
  // can't change the status code.
  let digest;
  try {
    digest = await buildContextDigest({ scanId: body.scanId, supabase });
  } catch (err) {
    return NextResponse.json(
      { error: `cannot load scan: ${(err as Error).message}` },
      { status: 404 },
    );
  }

  const history: ChatHistoryTurn[] = body.history ?? [];
  const encoder = new TextEncoder();
  const ac = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Forward downstream cancellation.
      const signal = req.signal;
      const onAbort = () => ac.abort();
      signal.addEventListener("abort", onAbort);

      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      // Initial frame: tell the client what context we're answering against.
      send({
        kind: "context",
        rowsConsidered: digest.rowsConsidered,
        severityCounts: digest.severityCounts,
      });

      try {
        for await (const chunk of streamChatTurn({
          digest,
          userMessage: body.message,
          history,
          signal: ac.signal,
        })) {
          send(chunk);
          if (chunk.kind === "done") break;
        }
      } catch (err) {
        send({ kind: "error", message: (err as Error).message });
      } finally {
        signal.removeEventListener("abort", onAbort);
        controller.close();
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable buffering on Vercel + nginx-fronted deployments.
      "X-Accel-Buffering": "no",
    },
  });
}
