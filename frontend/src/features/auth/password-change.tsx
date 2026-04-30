import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import {
  MODAL_OVERLAY, MODAL_CONTAINER, MODAL_HEADER, MODAL_TITLE, MODAL_CLOSE_BUTTON,
  MODAL_FORM, FORM_GROUP, FORM_LABEL, FORM_INPUT, FORM_HELP_TEXT, FORM_ERROR,
  BUTTON_GROUP, BUTTON_BASE, BUTTON_CANCEL, BUTTON_SUBMIT, BUTTON_DISABLED,
} from '@/styles/modal-form-constants';
import { useButtonHoverState } from '@/hooks/useButtonHoverState';

interface PasswordChangeProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function PasswordChange({ onClose, onSuccess }: PasswordChangeProps) {
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cancelHover = useButtonHoverState('#f3f4f6', '#e5e7eb', isLoading);
    const submitHover = useButtonHoverState('#3b82f6', '#2563eb', isLoading);

    const handleInputChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
                throw new Error('すべての項目を入力してください');
            }
            if (formData.newPassword !== formData.confirmPassword) {
                throw new Error('新しいパスワードと確認用パスワードが一致しません');
            }
            if (formData.newPassword.length < 8) {
                throw new Error('新しいパスワードは8文字以上である必要があります');
            }
            const hasNumber = /\d/.test(formData.newPassword);
            const hasLetter = /[a-zA-Z]/.test(formData.newPassword);
            if (!hasNumber || !hasLetter) {
                throw new Error('新しいパスワードは英数字を含む必要があります');
            }

            const stored = localStorage.getItem('dxp_user');
            const userInfo = stored ? JSON.parse(stored) : null;
            if (!userInfo?.username) throw new Error('ユーザー情報が見つかりません');

            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: userInfo.username,
                    currentPassword: formData.currentPassword,
                    newPassword: formData.newPassword,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'パスワード変更に失敗しました');
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message || 'パスワード変更に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={MODAL_OVERLAY}>
            <div style={{ ...MODAL_CONTAINER, maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                <div style={MODAL_HEADER}>
                    <h3 style={MODAL_TITLE}><Lock size={20} />パスワード変更</h3>
                    <button style={MODAL_CLOSE_BUTTON} onClick={onClose}>×</button>
                </div>

                <form style={MODAL_FORM} onSubmit={handleSubmit}>
                    <div style={FORM_GROUP}>
                        <label style={FORM_LABEL}>現在のパスワード *</label>
                        <input type="password" style={FORM_INPUT} value={formData.currentPassword}
                            onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                            placeholder="現在のパスワードを入力" />
                    </div>
                    <div style={FORM_GROUP}>
                        <label style={FORM_LABEL}>新しいパスワード *</label>
                        <input type="password" style={FORM_INPUT} value={formData.newPassword}
                            onChange={(e) => handleInputChange('newPassword', e.target.value)}
                            placeholder="新しいパスワードを入力" />
                        <div style={FORM_HELP_TEXT}>8文字以上、英数字を含む</div>
                    </div>
                    <div style={FORM_GROUP}>
                        <label style={FORM_LABEL}>新しいパスワード（確認） *</label>
                        <input type="password" style={FORM_INPUT} value={formData.confirmPassword}
                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                            placeholder="新しいパスワードを再入力" />
                    </div>

                    {error && <div style={FORM_ERROR}>{error}</div>}

                    <div style={BUTTON_GROUP}>
                        <button type="button"
                            style={{ ...BUTTON_BASE, ...BUTTON_CANCEL }}
                            onClick={onClose}
                            {...cancelHover}>
                            キャンセル
                        </button>
                        <button type="submit"
                            style={{ ...BUTTON_BASE, ...BUTTON_SUBMIT, ...(isLoading ? BUTTON_DISABLED : {}) }}
                            disabled={isLoading}
                            {...submitHover}>
                            {isLoading ? '変更中...' : 'パスワード変更'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
