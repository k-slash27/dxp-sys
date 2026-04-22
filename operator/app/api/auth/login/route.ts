import { NextRequest, NextResponse } from 'next/server';

const NAMESPACE = 'https://dxp/';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'ユーザー名とパスワードを入力してください' }, { status: 400 });
    }

    const tokenRes = await fetch(`${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
        realm: 'Username-Password-Authentication',
        username,
        password,
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: process.env.AUTH0_AUDIENCE,
        scope: 'openid profile email',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json();
      const msg = err.error === 'invalid_grant'
        ? 'ユーザー名またはパスワードが正しくありません'
        : 'ログインに失敗しました';
      return NextResponse.json({ error: msg }, { status: 401 });
    }

    const tokens = await tokenRes.json();

    // ID トークンからユーザー情報を取得
    const [, idPayloadB64] = tokens.id_token.split('.');
    const claims = JSON.parse(Buffer.from(idPayloadB64, 'base64url').toString());

    // Access Token から permissions を取得（Auth0 RBAC が自動付与）
    const accessParts = (tokens.access_token as string).split('.');
    if (accessParts.length < 3) {
      return NextResponse.json({ error: 'Access Token の取得に失敗しました。AUTH0_AUDIENCE を確認してください。' }, { status: 500 });
    }
    const accessClaims = JSON.parse(Buffer.from(accessParts[1], 'base64url').toString());

    const permissions: string[] = accessClaims.permissions ?? [];

    // operator:access パーミッションがない場合は拒否
    if (!permissions.includes('operator:access')) {
      return NextResponse.json({ error: 'このサービスへのアクセス権限がありません' }, { status: 403 });
    }

    return NextResponse.json({
      user: {
        id: claims.sub,
        username: claims.email || claims.nickname || username,
      }
    });
  } catch {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
