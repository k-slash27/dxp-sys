import type { NextApiRequest, NextApiResponse } from 'next';
import { managementFetch } from '@/lib/auth0-management';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'すべての項目を入力してください' });
    }

    try {
        // 1. Verify current password via password grant
        const tokenRes = await fetch(`${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
                realm: 'Username-Password-Authentication',
                username,
                password: currentPassword,
                client_id: process.env.AUTH0_CLIENT_ID,
                client_secret: process.env.AUTH0_CLIENT_SECRET,
                scope: 'openid profile email',
            }),
        });

        if (!tokenRes.ok) {
            return res.status(401).json({ error: '現在のパスワードが正しくありません' });
        }

        const tokens = await tokenRes.json();
        const [, payloadB64] = tokens.id_token.split('.');
        const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
        const userId = claims.sub;

        // 2. Update password via Management API
        await managementFetch(`users/${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ password: newPassword, connection: 'Username-Password-Authentication' }),
        });

        return res.status(200).json({ message: 'パスワードを変更しました' });
    } catch (err: any) {
        return res.status(500).json({ error: err.message || 'パスワード変更に失敗しました' });
    }
}
