import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AVAILABLE_AREAS } from '@/constants/areas';
import { UserPlus } from 'lucide-react';
import {
  MODAL_OVERLAY, MODAL_CONTAINER, MODAL_HEADER, MODAL_TITLE, MODAL_CLOSE_BUTTON,
  MODAL_FORM, FORM_GROUP, FORM_LABEL, FORM_INPUT, FORM_SELECT, FORM_ERROR, FORM_HELP_TEXT,
  BUTTON_GROUP, BUTTON_BASE, BUTTON_CANCEL, BUTTON_SUBMIT, BUTTON_DISABLED,
} from '@/styles/modal-form-constants';
import { useButtonHoverState } from '@/hooks/useButtonHoverState';

interface UserRegistrationProps {
    userInfo: any;
    onClose: () => void;
    onSuccess: () => void;
}

interface UserFormData {
    email: string;
    temporaryPassword: string;
    role: 'admin' | 'editor' | 'viewer';
    workspaces: string;
    primaryArea: string;
}

export default function UserRegistration({ userInfo, onClose, onSuccess }: UserRegistrationProps) {
    const { getAccessibleWorkspaces } = useAuth(userInfo);

    const canAdmin    = (userInfo?.permissions ?? []).includes('frontend:admin');
    const canManageArea = (userInfo?.permissions ?? []).includes('frontend:manage_area');
    const isEditor = canManageArea && !canAdmin;

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

    const cancelHover = useButtonHoverState('#f3f4f6', '#e5e7eb', isLoading);
    const submitHover = useButtonHoverState('#3b82f6', '#2563eb', isLoading);

    const availableWorkspaces = getAccessibleWorkspaces();

    const getSelectableWorkspaces = (targetUserRole: string) => {
        if (targetUserRole === 'admin') {
            return [... AVAILABLE_AREAS, 'national'];
        }
        if (canAdmin) {
            return AVAILABLE_AREAS;
        }
        return availableWorkspaces.filter(ws => ws !== 'national');
    };

    const workspaceNames: { [key: string]: string } = {
        'minobu': '身延町',
        'minami_alpus': '南アルプス市',
        'kofu': '甲府市',
        'demo': 'デモ',
        'national': '全エリア'
    };

    const handleInputChange = (field: keyof UserFormData, value: string) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };

            if (field === 'role' && value === 'admin') {
                updated.primaryArea = 'national';
                updated.workspaces = '*';
            } else if (field === 'role' && value !== 'admin') {
                if (isEditor) {
                    updated.primaryArea = currentUserArea;
                    updated.workspaces = currentUserArea;
                } else {
                    updated.primaryArea = '';
                    updated.workspaces = '';
                }
            } else if (field === 'primaryArea' && value) {
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
            if (!formData.email || !formData.temporaryPassword) {
                throw new Error('すべての必須項目を入力してください');
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                throw new Error('有効なメールアドレスを入力してください（例: user@example.com, user@company.co.jp）');
            }

            if (formData.temporaryPassword.length < 8) {
                throw new Error('仮パスワードは8文字以上である必要があります');
            }

            const hasNumber = /\d/.test(formData.temporaryPassword);
            const hasLetter = /[a-zA-Z]/.test(formData.temporaryPassword);
            if (!hasNumber || !hasLetter) {
                throw new Error('仮パスワードは英数字を含む必要があります');
            }

            const finalWorkspaces = formData.workspaces || formData.primaryArea || '';

            if (isEditor && finalWorkspaces) {
                const selectedWorkspaces = finalWorkspaces.split(',').map(w => w.trim());
                const hasInvalidWorkspace = selectedWorkspaces.some((ws: string) => !availableWorkspaces.includes(ws));
                if (hasInvalidWorkspace) {
                    const availableNames = availableWorkspaces.map(ws => workspaceNames[ws] || ws).join(', ');
                    throw new Error(`担当エリア外のワークスペースは指定できません。利用可能: ${availableNames}`);
                }
            }

            const username = formData.email;

            const response = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    const infoBox: React.CSSProperties = {
        backgroundColor: '#f3f4f6',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#4b5563',
        lineHeight: 1.5,
        minHeight: '100px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
    };

    if (!canManageArea) return null;

    return (
        <div style={MODAL_OVERLAY}>
            <div style={{ ...MODAL_CONTAINER, maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
                <div style={MODAL_HEADER}>
                    <h3 style={MODAL_TITLE}>
                        <UserPlus size={20} />
                        新規ユーザー登録
                    </h3>
                    <button style={MODAL_CLOSE_BUTTON} onClick={onClose}>×</button>
                </div>

                <form style={MODAL_FORM} onSubmit={handleSubmit}>
                    <div style={FORM_GROUP}>
                        <label style={FORM_LABEL}>メールアドレス（ユーザー名） *</label>
                        <input
                            type="email"
                            style={FORM_INPUT}
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            placeholder="user@example.com または user@company.co.jp"
                        />
                        <div style={FORM_HELP_TEXT}>
                            メールアドレスがユーザー名としても使用されます（独自ドメイン対応）
                        </div>
                    </div>

                    <div style={FORM_GROUP}>
                        <label style={FORM_LABEL}>仮パスワード *</label>
                        <input
                            type="password"
                            style={FORM_INPUT}
                            value={formData.temporaryPassword}
                            onChange={(e) => handleInputChange('temporaryPassword', e.target.value)}
                            placeholder="8文字以上の仮パスワード"
                        />
                        <div style={FORM_HELP_TEXT}>初回ログイン時にパスワード変更が必要です</div>
                    </div>

                    <div style={FORM_GROUP}>
                        <label style={FORM_LABEL}>ユーザー属性 *</label>
                        <select
                            style={FORM_SELECT}
                            value={formData.role}
                            onChange={(e) => handleInputChange('role', e.target.value)}
                        >
                            <option value="viewer">利用者</option>
                            <option value="editor">エリア担当者</option>
                            {canAdmin && <option value="admin">管理者</option>}
                        </select>
                    </div>

                    {formData.role !== 'admin' && (
                        <div style={FORM_GROUP}>
                            <label style={FORM_LABEL}>閲覧可能エリア {formData.role !== 'viewer' && '*'}</label>
                            <select
                                style={FORM_SELECT}
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

                    {error && <div style={FORM_ERROR}>{error}</div>}

                    <div style={BUTTON_GROUP}>
                        <button
                            type="button"
                            style={{ ...BUTTON_BASE, ...BUTTON_CANCEL }}
                            onClick={onClose}
                            {...cancelHover}
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            style={{ ...BUTTON_BASE, ...BUTTON_SUBMIT, ...(isLoading ? BUTTON_DISABLED : {}) }}
                            disabled={isLoading}
                            {...submitHover}
                        >
                            {isLoading ? '作成中...' : 'ユーザー作成'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
