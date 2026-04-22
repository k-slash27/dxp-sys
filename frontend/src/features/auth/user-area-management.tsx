import { AVAILABLE_AREAS } from '@/constants/areas';
import { display } from 'html2canvas/dist/types/css/property-descriptors/display';
import { textAlign } from 'html2canvas/dist/types/css/property-descriptors/text-align';
import { User } from 'lucide-react';
import React, { useState, useEffect } from 'react';

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

    // ワークスペース名の日本語マッピング
    const workspaceNames: { [key: string]: string } = {
        'minobu': '身延町',
        'minami_alpus': '南アルプス市',
        'kofu': '甲府市',
        'demo': 'デモ',
        'national': '全エリア'
    };

    // ユーザー属性名の日本語マッピング
    const roleNames: { [key: string]: string } = {
        'viewer': '利用者',
        'editor': 'エリア担当者',
        'admin': '管理者'
    };

    const availableWorkspaces = [ ...AVAILABLE_AREAS, 'national' ];
    const availableRoles = ['viewer', 'editor', 'admin'];

    // ユーザー属性に応じて選択可能なエリアを取得
    const getSelectableWorkspaces = (userRole: string) => {
        if (userRole === 'admin') {
            return availableWorkspaces;
        }
        // 利用者とエリア担当者はnationalを選択不可
        return availableWorkspaces.filter(ws => ws !== 'national');
    };

    // エリア担当者用：管理可能なロールを取得
    const getSelectableRoles = () => {
        if (canAdmin) {
            return availableRoles;
        }
        if (isEditor) {
            // エリア担当者は利用者とエリア担当者を管理可能
            return ['viewer', 'editor'];
        }
        return [];
    };

    // エリア担当者の場合、管理可能なユーザーをフィルタリング
    const getManageableUsers = (allUsers: User[]) => {
        if (canAdmin) {
            return allUsers;
        }
        if (isEditor) {
            // 自分の担当エリアのユーザーのみ管理可能
            return allUsers.filter(user => user.primaryArea === currentUserArea);
        }
        return [];
    };

    // ユーザー一覧を取得
    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const response = await fetch('/api/admin/list-users');
            if (!response.ok) {
                throw new Error('ユーザー一覧の取得に失敗しました');
            }
            const data = await response.json();
            const allUsers = data.users || [];
            // エリア担当者の場合は管理可能なユーザーのみ表示
            setUsers(getManageableUsers(allUsers));
        } catch (err: any) {
            setError(err.message || 'ユーザー一覧の取得中にエラーが発生しました');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleUserSelect = (user: User) => {
        setSelectedUser(user);
        setNewRole(user.role || 'viewer');
        // エリア担当者の場合は元のエリアを維持
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
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: selectedUser.username,
                    role: newRole,
                    ...(canAdmin ? {
                        primaryArea: newPrimaryArea,
                        workspaces: newPrimaryArea
                    } : {})
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'ユーザー情報の変更に失敗しました');
            }

            // ユーザー一覧を再読み込み
            await loadUsers();

            // 選択をリセット
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

    const styles = {
        overlay: {
            position: 'fixed' as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
        },
        modal: {
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflowY: 'auto' as const
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '12px',
            color: '#333',
        },
        title: {
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        },
        closeButton: {
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#6b7280'
        },
        content: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            alignItems: 'start'
        },
        userList: {
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            maxHeight: '400px',
            overflowY: 'auto' as const
        },
        userItem: {
            padding: '12px',
            borderBottom: '1px solid #e5e7eb',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            color: '#6b7280'
        },
        userItemSelected: {
            backgroundColor: '#eff6ff',
        },
        userItemHover: {
            backgroundColor: '#f3f4f6'
        },
        form: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '16px'
        },
        formGroup: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '4px'
        },
        label: {
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151'
        },
        select: {
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px',
            backgroundColor: 'white'
        },
        input: {
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px'
        },
        error: {
            color: '#ef4444',
            fontSize: '14px',
            marginTop: '4px'
        },
        buttonGroup: {
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            marginTop: '20px'
        },
        button: {
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
            minWidth: '120px',
            justifyContent: 'center'
        },
        cancelButton: {
            backgroundColor: '#f3f4f6',
            color: '#374151',
        },
        submitButton: {
            backgroundColor: '#3b82f6',
            color: 'white',
        },
        submitButtonDisabled: {
            backgroundColor: '#9ca3af',
            cursor: 'not-allowed'
        },
        loading: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px',
            color: '#6b7280'
        },
        helpText: {
            fontSize: '12px',
            color: '#6b7280',
            lineHeight: '1.6',
            marginBottom: '16px'
        },
        infoBox: {
            backgroundColor: '#f3f4f6',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#4b5563',
            lineHeight: '1.5',
            minHeight: '100px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center' as const
        },
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}>
                        <User size={20} />
                        ユーザー管理
                    </h3>
                    <button style={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div style={styles.content}>
                    {/* ユーザー一覧 */}
                    <div>
                        {/* <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px', color: '#333', }}>
                            ユーザー 一覧
                        </h4> */}

                        {isLoadingUsers ? (
                            <div style={styles.loading}>ユーザー読み込み中...</div>
                        ) : (
                            <div style={styles.userList}>
                                {users.map((user) => (
                                    <div
                                        key={user.username}
                                        style={{
                                            ...styles.userItem,
                                            ...(selectedUser?.username === user.username ? styles.userItemSelected : {})
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
                                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>
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
                            <form style={styles.form} onSubmit={handleSubmit}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>選択中のユーザー</label>
                                    <div style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#f3f4f6',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        color: '#6b7280'
                                    }}>
                                        {selectedUser.email}
                                    </div>
                                </div>

                                <div style={styles.formGroup}>
                                    <label style={styles.label}>ユーザー属性 *</label>
                                    <select
                                        style={styles.select}
                                        value={newRole}
                                        onChange={(e) => {
                                            setNewRole(e.target.value);
                                            // 管理者の場合、自動的にnationalを設定
                                            if (e.target.value === 'admin') {
                                                setNewPrimaryArea('national');
                                            } else {
                                                // 管理者以外の場合、nationalが選択されていたらリセット
                                                if (newPrimaryArea === 'national') {
                                                    setNewPrimaryArea('');
                                                }
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

                                <div style={styles.formGroup}>
                                    <label style={styles.label}>担当エリア *</label>
                                    <select
                                        style={styles.select}
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
                                    <div style={styles.helpText}>
                                        {newRole === 'admin'
                                            ? '管理者は自動的に全エリアが設定されます'
                                            : isEditor
                                                ? 'エリア担当者は自分の担当エリアのユーザーのみ管理できます'
                                                : 'アクセス可能ワークスペースは担当エリアと同じになります'
                                        }
                                    </div>
                                </div>

                                {error && <div style={styles.error}>{error}</div>}

                                <div style={styles.buttonGroup}>
                                    <button
                                        type="button"
                                        style={{...styles.button, ...styles.cancelButton}}
                                        onClick={() => {
                                            setSelectedUser(null);
                                            setNewPrimaryArea('');
                                            setNewRole('');
                                            setError(null);
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isLoading) e.currentTarget.style.backgroundColor = '#e5e7eb';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isLoading) e.currentTarget.style.backgroundColor = '#f3f4f6';
                                        }}
                                    >
                                        選択解除
                                    </button>
                                    <button
                                        type="submit"
                                        style={{
                                            ...styles.button,
                                            ...styles.submitButton,
                                            ...(isLoading ? styles.submitButtonDisabled : {})
                                        }}
                                        disabled={isLoading}
                                        onMouseEnter={(e) => {
                                            if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isLoading) e.currentTarget.style.backgroundColor = '#3b82f6';
                                        }}
                                    >
                                        {isLoading ? '変更中...' : 'ユーザー情報変更'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div style={styles.infoBox}>
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
