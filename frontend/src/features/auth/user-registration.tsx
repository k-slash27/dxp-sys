import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AVAILABLE_AREAS } from '@/constants/areas';
import { UserPlus } from 'lucide-react';

interface UserRegistrationProps {
    userInfo: any;
    onClose: () => void;
    onSuccess: () => void;
}

interface UserFormData {
    email: string; // username と email を統合
    temporaryPassword: string;
    role: 'admin' | 'editor' | 'viewer';
    workspaces: string;
    primaryArea: string;
}

export default function UserRegistration({ userInfo, onClose, onSuccess }: UserRegistrationProps) {
    const { getAccessibleWorkspaces } = useAuth(userInfo);

    const canAdmin    = (userInfo?.permissions ?? []).includes('frontend:admin');
    const canManageArea = (userInfo?.permissions ?? []).includes('frontend:manage_area');
    // admin でない manage_area 保持者 = editor
    const isEditor = canManageArea && !canAdmin;

    // エリア担当者の場合のデフォルト値設定
    const currentUserArea = userInfo?.primaryArea || '';
    const defaultPrimaryArea = isEditor ? currentUserArea : '';

    const [formData, setFormData] = useState<UserFormData>({
        email: '',
        temporaryPassword: '',
        role: 'viewer',
        workspaces: defaultPrimaryArea,
        primaryArea: defaultPrimaryArea
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 利用可能なワークスペース取得
    const availableWorkspaces = getAccessibleWorkspaces();

    // 新規登録するユーザーの属性に応じて選択可能なエリアを取得
    const getSelectableWorkspaces = (targetUserRole: string) => {
        if (targetUserRole === 'admin') {
            return [... AVAILABLE_AREAS, 'national'];
        }
        // 利用者とエリア担当者はnationalを選択不可
        if (canAdmin) {
            return AVAILABLE_AREAS; // 管理者が利用者/エリア担当者を作成する場合
        }
        // エディターはnationalを除外した自分の担当エリアのみ
        return availableWorkspaces.filter(ws => ws !== 'national');
    };

    // ワークスペース名の日本語マッピング
    const workspaceNames: { [key: string]: string } = {
        'minobu': '身延町',
        'minami_alpus': '南アルプス市',
        'kofu': '甲府市',
        'demo': 'デモ',
        'national': '全エリア'
    };

    const handleInputChange = (field: keyof UserFormData, value: string) => {
        setFormData(prev => {
            const updated = {
                ...prev,
                [field]: value
            };

            // ユーザー属性がadministratorの場合、自動的にnationalと*を設定
            if (field === 'role' && value === 'admin') {
                updated.primaryArea = 'national';
                updated.workspaces = '*';
            }
            // ユーザー属性がadministrator以外の場合、primaryAreaとworkspacesをリセット
            else if (field === 'role' && value !== 'admin') {
                if (isEditor) {
                    // エリア担当者の場合は自分の担当エリアを設定
                    updated.primaryArea = currentUserArea;
                    updated.workspaces = currentUserArea;
                } else {
                    updated.primaryArea = '';
                    updated.workspaces = '';
                }
            }
            // primary_areaが変更された場合、workspacesも同じ値に自動設定
            else if (field === 'primaryArea' && value) {
                updated.workspaces = value;
            }

            return updated;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // バリデーション
            if (!formData.email || !formData.temporaryPassword) {
                throw new Error('すべての必須項目を入力してください');
            }

            // より詳細なメールアドレスのバリデーション
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                throw new Error('有効なメールアドレスを入力してください（例: user@example.com, user@company.co.jp）');
            }

            if (formData.temporaryPassword.length < 8) {
                throw new Error('仮パスワードは8文字以上である必要があります');
            }

            // パスワード要件チェック（緩和された要件）
            // 8文字以上で、数字と文字を含む（大文字小文字区別なし、特殊文字は任意）
            const hasNumber = /\d/.test(formData.temporaryPassword);
            const hasLetter = /[a-zA-Z]/.test(formData.temporaryPassword);

            if (!hasNumber || !hasLetter) {
                throw new Error('仮パスワードは英数字を含む必要があります');
            }

            // workspacesが空の場合はprimaryAreaをデフォルトにする
            const finalWorkspaces = formData.workspaces || formData.primaryArea || '';

            // エディターの権限チェック
            if (isEditor && finalWorkspaces) {
                const selectedWorkspaces = finalWorkspaces.split(',').map(w => w.trim());
                const hasInvalidWorkspace = selectedWorkspaces.some((ws: string) => !availableWorkspaces.includes(ws));

                if (hasInvalidWorkspace) {
                    const availableNames = availableWorkspaces.map(ws => workspaceNames[ws] || ws).join(', ');
                    throw new Error(`担当エリア外のワークスペースは指定できません。利用可能: ${availableNames}`);
                }
            }

            // usernameはemailと同じ値を使用
            const username = formData.email;


            // ユーザー作成API呼び出し
            const response = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    email: formData.email,
                    temporaryPassword: formData.temporaryPassword,
                    role: formData.role,
                    primaryArea: formData.primaryArea,
                    workspaces: finalWorkspaces
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'ユーザー作成に失敗しました');
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'エラーが発生しました');
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
            maxWidth: '500px',
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
        input: {
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px'
        },
        select: {
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px',
            backgroundColor: 'white'
        },
        textarea: {
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px',
            minHeight: '60px',
            resize: 'vertical' as const
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

    // frontend:manage_area パーミッションがない場合は非表示
    if (!canManageArea) {
        return null;
    }

    return (
        <div style={styles.overlay}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}>
                        <UserPlus size={20} />
                        新規ユーザー登録
                    </h3>
                    <button style={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <form style={styles.form} onSubmit={handleSubmit}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>メールアドレス（ユーザー名） *</label>
                        <input
                            type="email"
                            style={styles.input}
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            placeholder="user@example.com または user@company.co.jp"
                        />
                        <div style={styles.helpText}>
                            メールアドレスがユーザー名としても使用されます（独自ドメイン対応）
                        </div>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>仮パスワード *</label>
                        <input
                            type="password"
                            style={styles.input}
                            value={formData.temporaryPassword}
                            onChange={(e) => handleInputChange('temporaryPassword', e.target.value)}
                            placeholder="8文字以上の仮パスワード"
                        />
                        <div style={styles.helpText}>初回ログイン時にパスワード変更が必要です</div>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>ユーザー属性 *</label>
                        <select
                            style={styles.select}
                            value={formData.role}
                            onChange={(e) => handleInputChange('role', e.target.value)}
                        >
                            <option value="viewer">利用者</option>
                            <option value="editor">エリア担当者</option>
                            {canAdmin && <option value="admin">管理者</option>}
                        </select>
                    </div>

                    {/* 管理者以外の場合のみ閲覧可能エリア選択を表示 */}
                    {formData.role !== 'admin' && (
                        <div style={styles.formGroup}>
                            <label style={styles.label}>閲覧可能エリア {formData.role !== 'viewer' && '*'}</label>
                            <select
                                style={styles.select}
                                value={formData.primaryArea}
                                onChange={(e) => handleInputChange('primaryArea', e.target.value)}
                                required={formData.role !== 'viewer'}
                                disabled={isEditor}
                            >
                                <option value="">選択してください</option>
                                {(isEditor ? [currentUserArea] : getSelectableWorkspaces(formData.role)).map((workspace: string) => (
                                    <option key={workspace} value={workspace}>
                                        {workspaceNames[workspace] || workspace}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}


                    {error && <div style={styles.error}>{error}</div>}

                    <div style={styles.buttonGroup}>
                        <button
                            type="button"
                            style={{ ...styles.button, ...styles.cancelButton }}
                            onClick={onClose}
                            onMouseEnter={(e) => {
                                if (!isLoading) e.currentTarget.style.backgroundColor = '#e5e7eb';
                            }}
                            onMouseLeave={(e) => {
                                if (!isLoading) e.currentTarget.style.backgroundColor = '#f3f4f6';
                            }}
                        >
                            キャンセル
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
                            {isLoading ? '作成中...' : 'ユーザー作成'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
