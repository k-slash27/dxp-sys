import { NextRequest, NextResponse } from 'next/server';

const REGISTER_SERVICE_URL = process.env.REGISTER_SERVICE_URL || 'http://journal:8000';

/**
 * GeoTiff ファイルを受け取り、api 経由で GeoServer に登録する。
 *
 * bodyParser を無効化し、リクエストボディをストリームのまま api に転送する。
 * これにより 2.5GB 超の TIF でもメモリに全展開せず処理できる。
 */

// Next.js のボディパーサーを無効化（ストリーム転送のために必要）
export const config = {
  api: { bodyParser: false },
};

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'multipart/form-data が必要です' }, { status: 400 });
    }

    // リクエストボディをストリームのまま api に転送
    const res = await fetch(`${REGISTER_SERVICE_URL}/webhook/upload-file`, {
      method: 'POST',
      headers: {
        'content-type': contentType,  // boundary を含む multipart ヘッダをそのまま転送
      },
      body: request.body,             // ReadableStream をそのまま流す
      // @ts-ignore: Node.js fetch での duplex 設定
      duplex: 'half',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      return NextResponse.json(
        { error: err.detail || '登録に失敗しました' },
        { status: res.status }
      );
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (err) {
    console.error('upload error:', err);
    return NextResponse.json({ error: `アップロードに失敗しました: ${err}` }, { status: 500 });
  }
}
