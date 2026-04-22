import React, { useState } from 'react';
import { Lock } from 'lucide-react';

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

    const styles = {
        overlay: {
            position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)',
        },
        modal: {
            backgroundColor: 'white', borderRadius: '8px', padding: '24px',
            width: '90%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto' as const
        },
        header: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '20px', paddingBottom: '12px', color: '#333',
        },
        title: { margin: 0, fontSize: '18px', fontWeight: '600' as const, display: 'flex', alignItems: 'center', gap: '8px' },
        closeButton: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' },
        form: { display: 'flex', flexDirection: 'column' as const, gap: '16px' },
        formGroup: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
        label: { fontSize: '14px', fontWeight: '500' as const, color: '#374151' },
        input: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' },
        error: { color: '#ef4444', fontSize: '14px', marginTop: '4px' },
        helpText: { fontSize: '12px', color: '#6b7280', marginTop: '2px' },
        buttonGroup: { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' },
        button: {
            padding: '10px 20px', borderRadius: '8px', border: 'none', fontSize: '14px',
            fontWeight: '500' as const, cursor: 'pointer', minWidth: '120px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
        },
        cancelButton: { backgroundColor: '#f3f4f6', color: '#374151' },
        submitButton: { backgroundColor: '#3b82f6', color: 'white' },
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}><Lock size={20} />パスワード変更</h3>
                    <button style={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <form style={styles.form} onSubmit={handleSubmit}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>現在のパスワード *</label>
                        <input type="password" style={styles.input} value={formData.currentPassword}
                            onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                            placeholder="現在のパスワードを入力" />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>新しいパスワード *</label>
                        <input type="password" style={styles.input} value={formData.newPassword}
                            onChange={(e) => handleInputChange('newPassword', e.target.value)}
                            placeholder="新しいパスワードを入力" />
                        <div style={styles.helpText}>8文字以上、英数字を含む</div>
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>新しいパスワード（確認） *</label>
                        <input type="password" style={styles.input} value={formData.confirmPassword}
                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                            placeholder="新しいパスワードを再入力" />
                    </div>

                    {error && <div style={styles.error}>{error}</div>}

                    <div style={styles.buttonGroup}>
                        <button type="button" style={{ ...styles.button, ...styles.cancelButton }} onClick={onClose}
                            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
                            onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}>
                            キャンセル
                        </button>
                        <button type="submit"
                            style={{ ...styles.button, ...styles.submitButton, ...(isLoading ? { backgroundColor: '#9ca3af', cursor: 'not-allowed' } : {}) }}
                            disabled={isLoading}
                            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                            onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#3b82f6'; }}>
                            {isLoading ? '変更中...' : 'パスワード変更'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
