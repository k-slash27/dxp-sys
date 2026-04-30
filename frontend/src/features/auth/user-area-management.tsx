import { AVAILABLE_AREAS } from '@/constants/areas';
import { User } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import {
  MODAL_OVERLAY, MODAL_CONTAINER, MODAL_HEADER, MODAL_TITLE, MODAL_CLOSE_BUTTON,
  MODAL_FORM, FORM_GROUP, FORM_LABEL, FORM_SELECT, FORM_ERROR, FORM_HELP_TEXT,
  BUTTON_GROUP, BUTTON_BASE, BUTTON_CANCEL, BUTTON_SUBMIT, BUTTON_DISABLED,
} from '@/styles/modal-form-constants';
import { useButtonHoverState } from '@/hooks/useButtonHoverState';

interface UserManagementProps {
    onClose: () => void;
    onSuccess: () => void;
    userInfo: any;
}

interface User {
    username: string;
    email: string;
    role: string;
    primaryArea: string;
    workspaces: string;
    enabled: boolean;
}

export default function UserManagement({ onClose, onSuccess, userInfo }: UserManagementProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [newPrimaryArea, setNewPrimaryArea] = useState('');
    const [newRole, setNewRole] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const canAdmin      = (userInfo?.permissions ?? []).includes('frontend:admin');
    const canManageArea = (userInfo?.permissions ?? []).includes('frontend:manage_area');
    const isEditor      = canManageArea && !canAdmin;

    const currentUserArea = userInfo?.primaryArea || '';

    const cancelHover = useButtonHoverState('#f3f4f6', '#e5e7eb', isLoading);
    const submitHover = useButtonHoverState('#3b82f6', '#2563eb', isLoading);

    const workspaceNames: { [key: string]: string } = {
        'minobu': '身延町',
        'minami_alpus': '南アルプス市',
        'kofu': '甲府市',
        'demo': 'デモ',
        'national': '全エリア'
    };

    const roleNames: { [key: string]: string } = {
        'viewer': '利用者',
        'editor': 'エリア担当者',
        'admin': '管理者'
    };

    const availableWorkspaces = [ ...AVAILABLE_AREAS, 'national' ];
    const availableRoles = ['viewer', 'editor', 'admin'];

    const getSelectableWorkspaces = (userRole: string) => {
        if (userRole === 'admin') return availableWorkspaces;
        return availableWorkspaces.filter(ws => ws !== 'national');
    };

    const getSelectableRoles = () => {
        if (canAdmin) return availableRoles;
        if (isEditor) return ['viewer', 'editor'];
        return [];
    };

    const getManageableUsers = (allUsers: User[]) => {
        if (canAdmin) return allUsers;
        if (isEditor) return allUsers.filter(user => user.primaryArea === currentUserArea);
        return [];
    };

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const response = await fetch('/api/admin/list-users');
            if (!response.ok) throw new Error('ユーザー一覧の取得に失敗しました');
            const data = await response.json();
            setUsers(getManageableUsers(data.users || []));
        } catch (err: any) {
            setError(err.message || 'ユーザー一覧の取得中にエラーが発生しました');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleUserSelect = (user: User) => {
        setSelectedUser(user);
        setNewRole(user.role || 'viewer');
        setNewPrimaryArea(user.primaryArea || '');
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/admin/update-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: selectedUser.username,
                    role: newRole,
                    ...(canAdmin ? { primaryArea: newPrimaryArea, workspaces: newPrimaryArea } : {})
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'ユーザー情報の変更に失敗しました');
            }

            await loadUsers();
            setSelectedUser(null);
            setNewPrimaryArea('');
            setNewRole('');
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'ユーザー情報変更中にエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    /* ユーザーリスト固有スタイル（共有定数にない部分） */
    const local = {
        content: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            alignItems: 'start',
        } as React.CSSProperties,
        userList: {
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            maxHeight: '400px',
            overflowY: 'auto',
        } as React.CSSProperties,
        userItem: {
            padding: '12px',
            borderBottom: '1px solid #e5e7eb',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            color: '#6b7280',
        } as React.CSSProperties,
        userItemSelected: { backgroundColor: '#eff6ff' } as React.CSSProperties,
        loading: {
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '40px', color: '#6b7280',
        } as React.CSSProperties,
        infoBox: {
            backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '8px',
            fontSize: '13px', color: '#4b5563', lineHeight: 1.5, minHeight: '100px',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            textAlign: 'center',
        } as React.CSSProperties,
    };

    return (
        <div style={MODAL_OVERLAY}>
            <div style={{ ...MODAL_CONTAINER, maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
                <div style={MODAL_HEADER}>
                    <h3 style={MODAL_TITLE}>
                        <User size={20} />
                        ユーザー管理
                    </h3>
                    <button style={MODAL_CLOSE_BUTTON} onClick={onClose}>×</button>
                </div>

                <div style={local.content}>
                    {/* ユーザー一覧 */}
                    <div>
                        {isLoadingUsers ? (
                            <div style={local.loading}>ユーザー読み込み中...</div>
                        ) : (
                            <div style={local.userList}>
                                {users.map((user) => (
                                    <div
                                        key={user.username}
                                        style={{
                                            ...local.userItem,
                                            ...(selectedUser?.username === user.username ? local.userItemSelected : {})
                                        }}
                                        onClick={() => handleUserSelect(user)}
                                        onMouseEnter={(e) => {
                                            if (selectedUser?.username !== user.username) {
                                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedUser?.username !== user.username) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }
                                        }}
                                    >
                                        <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                                            {user.email}
                                        </div>
                                        <div style={{ fontSize: '12px' }}>
                                            ユーザー属性: {roleNames[user.role] || user.role} | エリア: {workspaceNames[user.primaryArea] || user.primaryArea || '未設定'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* エリア変更フォーム */}
                    <div>
                        <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px' }}>
                            ユーザー情報編集
                        </h4>

                        {selectedUser ? (
                            <form style={MODAL_FORM} onSubmit={handleSubmit}>
                                <div style={FORM_GROUP}>
                                    <label style={FORM_LABEL}>選択中のユーザー</label>
                                    <div style={{
                                        padding: '8px 12px', backgroundColor: '#f3f4f6',
                                        borderRadius: '4px', fontSize: '14px', color: '#6b7280',
                                    }}>
                                        {selectedUser.email}
                                    </div>
                                </div>

                                <div style={FORM_GROUP}>
                                    <label style={FORM_LABEL}>ユーザー属性 *</label>
                                    <select
                                        style={FORM_SELECT}
                                        value={newRole}
                                        onChange={(e) => {
                                            setNewRole(e.target.value);
                                            if (e.target.value === 'admin') {
                                                setNewPrimaryArea('national');
                                            } else if (newPrimaryArea === 'national') {
                                                setNewPrimaryArea('');
                                            }
                                        }}
                                        required
                                    >
                                        <option value="">選択してください</option>
                                        {getSelectableRoles().map(role => (
                                            <option key={role} value={role}>
                                                {roleNames[role] || role}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={FORM_GROUP}>
                                    <label style={FORM_LABEL}>担当エリア *</label>
                                    <select
                                        style={FORM_SELECT}
                                        value={newPrimaryArea}
                                        onChange={(e) => setNewPrimaryArea(e.target.value)}
                                        required
                                        disabled={newRole === 'admin' || isEditor}
                                    >
                                        <option value="">選択してください</option>
                                        {(isEditor ? [currentUserArea] : getSelectableWorkspaces(newRole)).map(workspace => (
                                            <option key={workspace} value={workspace}>
                                                {workspaceNames[workspace] || workspace}
                                            </option>
                                        ))}
                                    </select>
                                    <div style={FORM_HELP_TEXT}>
                                        {newRole === 'admin'
                                            ? '管理者は自動的に全エリアが設定されます'
                                            : isEditor
                                                ? 'エリア担当者は自分の担当エリアのユーザーのみ管理できます'
                                                : 'アクセス可能ワークスペースは担当エリアと同じになります'
                                        }
                                    </div>
                                </div>

                                {error && <div style={FORM_ERROR}>{error}</div>}

                                <div style={BUTTON_GROUP}>
                                    <button
                                        type="button"
                                        style={{ ...BUTTON_BASE, ...BUTTON_CANCEL }}
                                        onClick={() => {
                                            setSelectedUser(null);
                                            setNewPrimaryArea('');
                                            setNewRole('');
                                            setError(null);
                                        }}
                                        {...cancelHover}
                                    >
                                        選択解除
                                    </button>
                                    <button
                                        type="submit"
                                        style={{ ...BUTTON_BASE, ...BUTTON_SUBMIT, ...(isLoading ? BUTTON_DISABLED : {}) }}
                                        disabled={isLoading}
                                        {...submitHover}
                                    >
                                        {isLoading ? '変更中...' : 'ユーザー情報変更'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div style={local.infoBox}>
                                左のリストからユーザーを選択してください<br/>
                                ユーザーの権限（属性）・担当エリアが変更できます
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
