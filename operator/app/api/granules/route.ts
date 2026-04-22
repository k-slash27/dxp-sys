import { NextRequest, NextResponse } from 'next/server';

const REGISTER_SERVICE_URL = process.env.REGISTER_SERVICE_URL || 'http://register-service:8000';

export async function GET(request: NextRequest) {
  const workspace = request.nextUrl.searchParams.get('workspace');
  if (!workspace) return NextResponse.json({ error: 'workspace が必要です' }, { status: 400 });

  const res = await fetch(`${REGISTER_SERVICE_URL}/webhook/granules/${workspace}`);
  if (!res.ok) return NextResponse.json({ error: '取得失敗' }, { status: res.status });
  return NextResponse.json(await res.json());
}

export async function DELETE(request: NextRequest) {
  const { workspace, granule_id } = await request.json();

  const res = await fetch(`${REGISTER_SERVICE_URL}/webhook/granule`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace, granule_id }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    return NextResponse.json({ error: err.detail }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}

export async function PATCH(request: NextRequest) {
  const { workspace, granule_id, new_filename } = await request.json();

  const res = await fetch(`${REGISTER_SERVICE_URL}/webhook/granule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace, granule_id, new_filename }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    return NextResponse.json({ error: err.detail }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
