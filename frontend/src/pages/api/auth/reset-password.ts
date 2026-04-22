import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'メールアドレスを入力してください' });

    try {
        const response = await fetch(`${process.env.AUTH0_ISSUER_BASE_URL}/dbconnections/change_password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: process.env.AUTH0_CLIENT_ID,
                email,
                connection: 'Username-Password-Authentication',
            }),
        });

        // Auth0 returns 200 even if user doesn't exist (security measure)
        if (!response.ok) {
            return res.status(500).json({ error: 'パスワードリセットメールの送信に失敗しました' });
        }

        return res.status(200).json({ message: 'パスワードリセットメールを送信しました' });
    } catch {
        return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
}
