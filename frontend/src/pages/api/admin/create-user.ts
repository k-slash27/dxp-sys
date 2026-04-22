import type { NextApiRequest, NextApiResponse } from 'next';
import { managementFetch, mapToAuth0Role, assignRole } from '@/lib/auth0-management';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { username, email, temporaryPassword, role, workspaces, primaryArea } = req.body;

    if (!username || !email || !temporaryPassword) {
        return res.status(400).json({ message: '必須項目が不足しています' });
    }

    try {
        const auth0RoleName = mapToAuth0Role(role || 'viewer');
        const finalWorkspaces = role === 'admin' ? '*' : (workspaces || primaryArea || '');
        const finalPrimaryArea = role === 'admin' ? 'national' : (primaryArea || '');

        // 1. ユーザー作成
        const newUser = await managementFetch('users', {
            method: 'POST',
            body: JSON.stringify({
                connection: 'Username-Password-Authentication',
                email,
                password: temporaryPassword,
                app_metadata: {
                    role: auth0RoleName,
                    workspaces: finalWorkspaces,
                    primary_area: finalPrimaryArea,
                },
                email_verified: true,
            }),
        });

        // 2. Auth0 ロールを付与（Post-Login Action でパーミッションが正しく付与されるために必要）
        await assignRole(newUser.user_id, auth0RoleName);

        res.status(201).json({ message: 'ユーザーが正常に作成されました', user: { username, email, role } });
    } catch (error: any) {
        let message = 'ユーザー作成に失敗しました';
        if (error.message?.includes('already exists') || error.message?.includes('The user already exists')) {
            message = 'このメールアドレスは既に使用されています';
        } else if (error.message) {
            message = error.message;
        }
        res.status(500).json({ message });
    }
}
