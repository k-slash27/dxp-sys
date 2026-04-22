import type { NextApiRequest, NextApiResponse } from 'next';

const NAMESPACE = 'https://dxp/';

// 表示用ロールマッピング（Auth0 app_metadata → UI表示名）
function mapRole(auth0Role: string): string {
  if (auth0Role === 'ADMIN') return 'admin';
  if (auth0Role === 'USER_manager' || auth0Role === 'USER_staff') return 'editor';
  if (auth0Role === 'USER') return 'viewer';
  return 'viewer';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください' });
  }

  try {
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
      return res.status(401).json({ error: msg });
    }

    const tokens = await tokenRes.json();

    // ID トークンからユーザー情報・カスタムクレームを取得
    const [, idPayloadB64] = tokens.id_token.split('.');
    const claims = JSON.parse(Buffer.from(idPayloadB64, 'base64url').toString());

    // Access Token から permissions を取得（Auth0 RBAC が自動付与）
    const accessParts = (tokens.access_token as string).split('.');
    if (accessParts.length < 3) {
      return res.status(500).json({ error: 'Access Token の取得に失敗しました。AUTH0_AUDIENCE を確認してください。' });
    }
    const accessClaims = JSON.parse(Buffer.from(accessParts[1], 'base64url').toString());

    const auth0Role = claims[`${NAMESPACE}role`] || '';
    const permissions: string[] = accessClaims.permissions ?? [];

    // frontend:access パーミッションがない場合は拒否
    if (!permissions.includes('frontend:access')) {
      return res.status(403).json({ error: 'このサービスへのアクセス権限がありません' });
    }

    return res.status(200).json({
      username: claims.email || claims.nickname || username,
      role: mapRole(auth0Role),
      permissions,
      workspaces: claims[`${NAMESPACE}workspaces`] || '*',
      primaryArea: claims[`${NAMESPACE}primary_area`] || '',
    });
  } catch {
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
