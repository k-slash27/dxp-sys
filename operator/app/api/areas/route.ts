import { NextResponse } from 'next/server';

const REGISTER_SERVICE_URL = process.env.REGISTER_SERVICE_URL || 'http://journal:8000';

export async function GET() {
  try {
    const res = await fetch(`${REGISTER_SERVICE_URL}/webhook/areas`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `api への接続に失敗しました (${res.status})` },
        { status: 502 }
      );
    }

    const areas = await res.json();
    return NextResponse.json(areas);
  } catch (err) {
    return NextResponse.json(
      { error: `エリア情報の取得に失敗しました: ${err}` },
      { status: 500 }
    );
  }
}
