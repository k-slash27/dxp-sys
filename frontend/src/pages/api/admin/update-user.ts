import type { NextApiRequest, NextApiResponse } from 'next';
import { managementFetch, mapToAuth0Role, assignRole } from '@/lib/auth0-management';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { username, role, primaryArea, workspaces } = req.body;

    if (!username) return res.status(400).json({ message: 'ユーザー名が必要です' });
    if (!role) return res.status(400).json({ message: 'ユーザー属性が必要です' });

    try {
        const auth0Role = mapToAuth0Role(role);
        const finalWorkspaces = role === 'admin' ? '*' : (workspaces || primaryArea || '');
        const finalPrimaryArea = role === 'admin' ? 'national' : (primaryArea || '');

        // app_metadata を更新
        await managementFetch(`users/${encodeURIComponent(username)}`, {
            method: 'PATCH',
            body: JSON.stringify({
                app_metadata: {
                    role: auth0Role,
                    workspaces: finalWorkspaces,
                    primary_area: finalPrimaryArea,
                },
            }),
        });

        // Auth0 ロールも更新（パーミッション反映のために必要）
        await assignRole(username, auth0Role);

        res.status(200).json({ message: 'ユーザー情報が正常に更新されました', user: { username, role, primaryArea: finalPrimaryArea, workspaces: finalWorkspaces } });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'ユーザー情報の更新に失敗しました' });
    }
}
