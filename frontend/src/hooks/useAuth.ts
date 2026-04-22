import { AVAILABLE_AREAS } from "@/constants/areas";

// カスタムフック: 認証とワークスペース管理
// userInfo は { username, role, workspaces, primaryArea } 形式（localStorage から復元）
export const useAuth = (userInfo: any) => {
    const userRole: string = userInfo?.role || 'viewer';
    const userWorkspaces: string = userInfo?.workspaces || '*';
    const primaryArea: string = userInfo?.primaryArea || '';

    // ワークスペースアクセスチェック
    const hasWorkspaceAccess = (workspace: string) => {
        if (userRole === 'admin' || userWorkspaces === '*') return true;

        if (userWorkspaces && userWorkspaces.trim()) {
            return userWorkspaces.split(',').map((ws: string) => ws.trim()).includes(workspace);
        }

        if (primaryArea && primaryArea.trim()) {
            return primaryArea.trim() === workspace;
        }

        return false;
    };

    // アクセス可能なワークスペースリスト取得
    const getAccessibleWorkspaces = () => {
        if (userRole === 'admin' || userWorkspaces === '*') {
            return [...AVAILABLE_AREAS, 'national'];
        }

        if (userWorkspaces && userWorkspaces.trim()) {
            return userWorkspaces.split(',').map((ws: string) => ws.trim()).filter((ws: string) => ws);
        }

        if (primaryArea && primaryArea.trim()) {
            return [primaryArea.trim()];
        }

        return [];
    };

    // GeoServerエンドポイント生成（ワークスペース制御付き）
    const getGeoServerUrl = (baseUrl: string, workspace: string, service: string) => {
        if (!hasWorkspaceAccess(workspace)) {
            console.warn(`ワークスペース '${workspace}' へのアクセス権限がありません`);
            return null;
        }
        return `${baseUrl}/${workspace}/${service}`;
    };

    return {
        userRole,
        userWorkspaces,
        primaryArea,
        hasWorkspaceAccess,
        getAccessibleWorkspaces,
        getGeoServerUrl
    };
};
