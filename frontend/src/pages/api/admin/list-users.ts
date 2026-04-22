import type { NextApiRequest, NextApiResponse } from 'next';
import { managementFetch, mapFromAuth0Role } from '@/lib/auth0-management';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const data = await managementFetch('users?per_page=100&include_totals=false');

        const users = (Array.isArray(data) ? data : []).map((user: any) => ({
            username: user.user_id,
            email: user.email || '',
            role: mapFromAuth0Role(user.app_metadata?.role || 'USER'),
            primaryArea: user.app_metadata?.primary_area || '',
            workspaces: user.app_metadata?.workspaces || '',
            enabled: !user.blocked,
        }));

        users.sort((a: any, b: any) => (a.email || '').localeCompare(b.email || ''));

        res.status(200).json({ users, totalCount: users.length });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'ユーザー一覧の取得に失敗しました' });
    }
}
