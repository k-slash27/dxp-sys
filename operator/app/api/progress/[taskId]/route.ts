import { NextRequest } from 'next/server';

const REGISTER_SERVICE_URL = process.env.REGISTER_SERVICE_URL || 'http://journal:8000';

/**
 * api の SSE 進捗エンドポイントへのプロキシ。
 * EventSource は同一オリジンしか直接叩けないため、operator 経由で転送する。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const upstream = `${REGISTER_SERVICE_URL}/webhook/progress/${taskId}`;

  const res = await fetch(upstream, {
    headers: { Accept: 'text/event-stream' },
  });

  if (!res.ok || !res.body) {
    return new Response(`data: ${JSON.stringify({ status: 'failed', message: 'progress endpoint error' })}\n\n`, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
