const ISSUER_BASE_URL = process.env.AUTH0_ISSUER_BASE_URL!;
const MANAGEMENT_CLIENT_ID = process.env.AUTH0_MANAGEMENT_CLIENT_ID!;
const MANAGEMENT_CLIENT_SECRET = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET!;

export async function getManagementToken(): Promise<string> {
    const res = await fetch(`${ISSUER_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: MANAGEMENT_CLIENT_ID,
            client_secret: MANAGEMENT_CLIENT_SECRET,
            audience: `${ISSUER_BASE_URL}/api/v2/`,
        }),
    });
    if (!res.ok) {
        throw new Error('Management API トークンの取得に失敗しました');
    }
    const data = await res.json();
    return data.access_token;
}

export async function managementFetch(path: string, options: RequestInit = {}): Promise<any> {
    const token = await getManagementToken();
    const res = await fetch(`${ISSUER_BASE_URL}/api/v2/${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Management API エラー: ${res.status}`);
    }
    // 204 No Content など空レスポンスの場合は null を返す
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

// Auth0ロール名 → 表示ロール
export function mapFromAuth0Role(auth0Role: string): string {
    if (auth0Role === 'ADMIN') return 'admin';
    if (auth0Role === 'USER_manager') return 'editor';
    // USER_staff / USER はいずれも viewer
    return 'viewer';
}

// 表示ロール → Auth0ロール名
export function mapToAuth0Role(displayRole: string): string {
    if (displayRole === 'admin') return 'ADMIN';
    if (displayRole === 'editor') return 'USER_manager';
    return 'USER_staff'; // viewer
}

// Auth0ロール名からロールIDを取得
export async function getRoleId(roleName: string): Promise<string> {
    const roles = await managementFetch(`roles?name_filter=${encodeURIComponent(roleName)}`);
    const role = roles.find((r: any) => r.name === roleName);
    if (!role) throw new Error(`Auth0 ロール "${roleName}" が見つかりません。Auth0 Dashboard でロールを作成してください。`);
    return role.id;
}

// ユーザーにロールを付与（既存ロールを削除してから付与）
export async function assignRole(userId: string, roleName: string): Promise<void> {
    // 現在のロールを取得して削除
    const currentRoles = await managementFetch(`users/${encodeURIComponent(userId)}/roles`);
    if (currentRoles?.length > 0) {
        await managementFetch(`users/${encodeURIComponent(userId)}/roles`, {
            method: 'DELETE',
            body: JSON.stringify({ roles: currentRoles.map((r: any) => r.id) }),
        });
    }
    // 新しいロールを付与
    const roleId = await getRoleId(roleName);
    await managementFetch(`users/${encodeURIComponent(userId)}/roles`, {
        method: 'POST',
        body: JSON.stringify({ roles: [roleId] }),
    });
}
